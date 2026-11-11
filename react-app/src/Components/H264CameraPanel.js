import React, { useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';

/**
 * Shows one camera's H.264 stream (ffmpeg_image_transport) decoded with WebCodecs.
 *
 * Uses the dashboard's shared rosbridge connection. The subscription and the
 * decoder are recreated every time the connection comes up, so a rosbridge
 * restart always starts clean from the next keyframe (same pattern as
 * /robot_state in useRobotState).
 *
 * H.264 frames depend on earlier frames, so the decoder is never fed a broken
 * sequence: it waits for a keyframe at start, after a pts gap, after a decoder
 * error, and after falling behind.
 *
 * Debug stats per topic are on window.__h264Stats in the browser console.
 */

const MESSAGE_TYPE = 'ffmpeg_image_transport_msgs/msg/FFMPEGPacket';
const KEY_FLAG = 1;            // FFmpeg AV_PKT_FLAG_KEY
const MAX_DECODE_QUEUE = 2;    // beyond this, skip to the next keyframe
const STALL_MS = 1000;         // no frame for this long counts as stalled
const STATUS_INTERVAL_MS = 250;
const PROBE_CODEC = 'avc1.42E01E'; // constrained baseline, level 3.0

const styles = {
  // The largest 3:2 box that fits the .camera-slot it sits in (a CSS size
  // container, so cqw/cqh are the slot's width and height).
  container: {
    position: 'relative',
    width: 'min(100cqw, 150cqh)',
    height: 'min(100cqh, 66.667cqw)',
    margin: '0 auto',
  },
  cameraContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'black',
    borderRadius: '8px',
    border: '6px solid #cccccc',
  },
  canvas: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', // never stretch: keep the camera's aspect ratio
    display: 'block',
  },
  status: {
    position: 'absolute',
    left: '10px',
    bottom: '10px',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: '6px',
    color: 'white',
    padding: '4px 8px',
    fontSize: '13px',
    pointerEvents: 'none',
    zIndex: 10,
  },
  message: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%',
    color: 'white',
    textAlign: 'center',
    fontSize: '15px',
    lineHeight: 1.4,
    pointerEvents: 'none',
  },
};

const STATUS_COLORS = {
  live: '#3ccf6e',
  stalled: '#ffcc00',
  error: '#ff5555',
  unsupported: '#ff5555',
};

// uint8[] arrives as a Uint8Array with CBOR, but accept the other encodings
// rosbridge can produce so a compression change does not break decoding.
function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data && data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

// Finds the SPS in an Annex B keyframe and builds the exact codec string
// (avc1.PPCCLL) from its profile, constraint flags and level. Returns null if
// the packet has no Annex B SPS.
function codecFromKeyframe(bytes) {
  const hex = (b) => b.toString(16).padStart(2, '0').toUpperCase();
  for (let i = 0; i + 6 < bytes.length; i++) {
    if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 1) {
      if ((bytes[i + 3] & 0x1f) === 7) {
        return `avc1.${hex(bytes[i + 4])}${hex(bytes[i + 5])}${hex(bytes[i + 6])}`;
      }
      i += 2;
    }
  }
  return null;
}

function stampToMicros(stamp, fallback) {
  if (!stamp) return fallback;
  return Number(stamp.sec) * 1e6 + Math.floor(Number(stamp.nanosec) / 1000);
}

export default function H264CameraPanel({ ros, isConnected, topic, label, index, isActive }) {
  const accentColor = index === '0' ? '#ff8c00' : index === '4' ? '#0088ff' : '#cccccc';
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(null); // null = still checking
  const [status, setStatus] = useState('disconnected');
  const [detail, setDetail] = useState('');
  const [fps, setFps] = useState(0);

  // WebCodecs and H.264 support, checked once.
  useEffect(() => {
    let cancelled = false;
    if (typeof window.VideoDecoder === 'undefined') {
      setSupported(false);
      setDetail(
        window.isSecureContext
          ? 'This browser has no WebCodecs video decoder. Use Chrome or Edge.'
          : 'Video needs a secure page. Open the dashboard at http://localhost:3000 or over HTTPS.'
      );
      return undefined;
    }
    window.VideoDecoder.isConfigSupported({ codec: PROBE_CODEC, optimizeForLatency: true })
      .then((result) => {
        if (cancelled) return;
        setSupported(result.supported);
        if (!result.supported) {
          setDetail('This browser cannot decode H.264. Use Chrome or Edge (some Linux Chromium builds lack H.264).');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSupported(false);
        setDetail(`H.264 support check failed: ${err.message}`);
      });
    return () => { cancelled = true; };
  }, []);

  // Subscription and decoder: recreated on every (re)connect.
  useEffect(() => {
    if (supported !== true) return undefined;
    if (!ros || !isConnected) {
      setStatus('disconnected');
      return undefined;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let disposed = false;
    let decoder = null;
    let codec = null;
    let needKeyframe = true;
    let lastPts = null;
    let ptsStep = null;
    let fallbackTs = 0;
    let lastFrameAt = 0;
    let framesInWindow = 0;
    let windowStart = performance.now();

    const stats = { topic, messages: 0, decoded: 0, dropped: 0, resets: 0, codec: null, lastReset: null };
    window.__h264Stats = window.__h264Stats || {};
    window.__h264Stats[topic] = stats;

    const closeDecoder = () => {
      if (decoder && decoder.state !== 'closed') {
        try { decoder.close(); } catch (e) { /* already closed */ }
      }
      decoder = null;
    };

    // Throw away decoder state and wait for the next keyframe.
    const resetToKeyframe = (reason) => {
      closeDecoder();
      needKeyframe = true;
      lastPts = null;
      stats.resets += 1;
      stats.lastReset = reason;
      console.info(`[H264 ${topic}] reset: ${reason}`);
    };

    const createDecoder = (codecString) => {
      const d = new window.VideoDecoder({
        output: (frame) => {
          try {
            if (!disposed && canvas.isConnected) {
              if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
                canvas.width = frame.displayWidth;
                canvas.height = frame.displayHeight;
              }
              ctx.drawImage(frame, 0, 0);
              lastFrameAt = performance.now();
              framesInWindow += 1;
              stats.decoded += 1;
            }
          } finally {
            frame.close(); // always, or the decoder stalls
          }
        },
        error: (err) => {
          if (disposed || d !== decoder) return; // a decoder we already replaced
          setDetail(`Decoder error: ${err.message}`);
          resetToKeyframe(`decoder error: ${err.message}`);
        },
      });
      // Annex B stream with SPS/PPS in keyframes, so no description.
      d.configure({ codec: codecString, optimizeForLatency: true });
      stats.codec = codecString;
      console.info(`[H264 ${topic}] decoder configured: ${codecString}`);
      return d;
    };

    const onMessage = (msg) => {
      if (disposed) return;
      stats.messages += 1;
      const bytes = toBytes(msg.data);
      if (!bytes || bytes.length === 0) return;
      const isKey = (Number(msg.flags) & KEY_FLAG) === KEY_FLAG;
      const pts = Number(msg.pts);

      // A missing frame corrupts every frame until the next keyframe.
      if (lastPts !== null && !needKeyframe) {
        const diff = pts - lastPts;
        if (diff <= 0) {
          resetToKeyframe(`pts went backwards (${lastPts} -> ${pts}), encoder restarted?`);
        } else if (ptsStep !== null && diff > ptsStep * 1.5) {
          resetToKeyframe(`pts gap (${lastPts} -> ${pts})`);
        } else {
          ptsStep = ptsStep === null ? diff : Math.min(ptsStep, diff);
        }
      }
      lastPts = pts;

      if (needKeyframe) {
        if (!isKey) {
          stats.dropped += 1;
          return;
        }
        const keyCodec = codecFromKeyframe(bytes);
        if (!keyCodec && !codec) {
          setDetail('Keyframe has no SPS header (stream is not Annex B). The decoder needs a description.');
          stats.dropped += 1;
          return;
        }
        if (!decoder || (keyCodec && keyCodec !== codec)) {
          closeDecoder();
          codec = keyCodec || codec;
          decoder = createDecoder(codec);
        }
        needKeyframe = false;
        setDetail('');
      }

      // Falling behind adds latency: skip to the next keyframe instead of
      // decoding the backlog.
      if (decoder.decodeQueueSize > MAX_DECODE_QUEUE) {
        if (isKey) {
          decoder.reset();
          decoder.configure({ codec, optimizeForLatency: true });
        } else {
          needKeyframe = true;
          stats.dropped += 1;
          return;
        }
      }

      try {
        fallbackTs += 66667;
        decoder.decode(new window.EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          timestamp: stampToMicros(msg.header && msg.header.stamp, fallbackTs),
          data: bytes,
        }));
      } catch (err) {
        setDetail(`Decode failed: ${err.message}`);
        resetToKeyframe(`decode threw: ${err.message}`);
      }
    };

    const rosTopic = new Topic({
      ros,
      name: topic,
      messageType: MESSAGE_TYPE,
      compression: 'cbor',
      queue_length: 1,
      // No throttle_rate: throttling drops frames, which breaks H.264.
      // This effect owns re-subscription, so roslib's own must be off.
      reconnect_on_close: false,
    });
    rosTopic.subscribe(onMessage);
    setStatus('connecting');

    // Status is computed a few times a second, not per frame, to avoid
    // re-rendering the dashboard 15 times a second per camera.
    const timer = setInterval(() => {
      const now = performance.now();
      let next;
      if (stats.messages === 0) next = 'connecting';
      else if (lastFrameAt === 0) next = 'waiting';
      else if (now - lastFrameAt > STALL_MS) next = 'stalled';
      else next = 'live';
      setStatus(next);

      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        setFps(Math.round((framesInWindow * 1000) / elapsed));
        framesInWindow = 0;
        windowStart = now;
      }
    }, STATUS_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      rosTopic.unsubscribe(onMessage);
      closeDecoder();
    };
  }, [ros, isConnected, topic, supported]);

  let statusText;
  let overlayMessage = null;
  if (supported === false) {
    statusText = 'Unsupported';
    overlayMessage = detail;
  } else if (supported === null) {
    statusText = 'Checking video support';
  } else {
    switch (status) {
      case 'disconnected':
        statusText = 'Not connected to rosbridge';
        break;
      case 'connecting':
        statusText = 'Waiting for video';
        overlayMessage = `No packets yet on ${topic}`;
        break;
      case 'waiting':
        statusText = 'Waiting for a keyframe';
        break;
      case 'live':
        statusText = `Live, ${fps} fps`;
        break;
      case 'stalled':
        statusText = 'Stalled: no frame for over 1 s';
        break;
      default:
        statusText = status;
    }
    if (detail) overlayMessage = detail;
  }
  const dotColor = supported === false ? STATUS_COLORS.unsupported : STATUS_COLORS[status] || '#aaaaaa';

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.cameraContainer,
          borderColor: accentColor,
          boxShadow: isActive ? `0 0 0 6px ${accentColor}, 0 0 24px rgba(0,0,0,0.35)` : 'none',
          transition: 'box-shadow 0.18s ease',
        }}
      >
        <canvas ref={canvasRef} style={styles.canvas} />
        {overlayMessage && <div style={styles.message}>{overlayMessage}</div>}
        <div style={styles.status}>
          <span style={{ color: dotColor }}>●</span> {label ? `${label}: ` : ''}{statusText}
        </div>
      </div>
    </div>
  );
}