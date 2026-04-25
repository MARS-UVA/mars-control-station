import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ChartNoAxesColumnDecreasing, Pause, Play } from "lucide-react";
import { flipPausedState, getPausedState } from "../robotState";
import Guidelines from "../gamepad/Guidelines";
import pauseImage from '../assets/touchedNpaused.png';

function WebcamPanel({ signalingPort, gamepadData, index }) {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const [isLive, setIsLive] = useState(false);

  // Change this to ip of signaling server if not on same computer
  const signalingUrl = `ws://localhost:${signalingPort}`;

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.addTransceiver('video', { direction: 'recvonly' });

    pcRef.current = pc;

    let candidateQueue = [];
    let isRemoteSet = false;

    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    // WebRTC Event Handlers
    pc.ontrack = (event) => {
      console.log(`[${signalingUrl}] Track received`);
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
        setIsLive(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ice: event.candidate }));
      }
    };

    // WebSocket Event Handlers
    ws.onopen = () => {
      console.log(`[Cam ${index}] Connected to ${signalingUrl}`);
      ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
    };

    ws.onmessage = async (event) => {
      let data = event.data;

      if (data instanceof Blob) {
        data = await data.text();
      }

      let msg;
      try {
        msg = JSON.parse(data);
      } catch (e) {
        console.error("JSON Parse Error:", e);
        return;
      }

      if (msg.cmd === 'HELLO_FROM_STREAMER') {
        ws.send(JSON.stringify({ cmd: 'HELLO_FROM_VIEWER' }));
      }
      else if (msg.sdp && msg.sdp.type === 'offer') {
        console.log("Received Offer - Setting Remote Description");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          isRemoteSet = true;

          // Add candidates that arrived while waiting
          console.log(`Processing ${candidateQueue.length} queued candidates`);
          while (candidateQueue.length > 0) {
            const c = candidateQueue.shift();
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ sdp: { type: 'answer', sdp: answer.sdp } }));
        } catch (e) {
          console.error(`[Cam ${index}] SDP Error:`, e);
        }
      }
      else if (msg.ice) {
        try {
          if (isRemoteSet) {
            console.log("Adding ICE Candidate directly");
            await pc.addIceCandidate(new RTCIceCandidate(msg.ice));
          } else {
            console.log("Queueing ICE Candidate (Remote not set yet)");
            candidateQueue.push(msg.ice);
          }
        } catch (e) {
          console.error(`[Cam ${index}] ICE Error:`, e);
        }
      }
    };

    // Cleanup
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (pc.signalingState !== 'closed') pc.close();
      setIsLive(false);
    };
  }, [signalingPort, index]);

  const cameraLabel = index === "0" ? "REAR" : index === "4" ? "FRONT" : `CAM ${index}`;
  const accentClass = index === "0" ? "webcam-card--rear" : index === "4" ? "webcam-card--front" : "";

  return (
    <div className={`webcam-card ${accentClass}`}>
      <video
        ref={videoRef}
        className="webcam-card__video"
        autoPlay
        playsInline
        muted
        controls={false}
      />
      {!isLive && (
        <div className="webcam-card__placeholder">
          <Camera size={36} strokeWidth={1.5} className="webcam-card__placeholder-icon" />
          <div className="webcam-card__placeholder-title">No Signal</div>
          <div className="webcam-card__placeholder-sub">{cameraLabel} • Port {signalingPort}</div>
        </div>
      )}
      <div className="webcam-card__overlay">
        <div className="webcam-card__badge">
          <Camera size={11} />
          <span>{cameraLabel}</span>
        </div>
        <div className={`webcam-card__live ${isLive ? "is-live" : ""}`}>
          <span className="webcam-card__live-dot" />
          <span>{isLive ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>
    </div>
  );
}

export default WebcamPanel;
