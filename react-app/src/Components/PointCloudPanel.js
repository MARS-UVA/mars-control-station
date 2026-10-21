import React, { useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 3D view of the RTAB-Map point cloud, replacing the RViz window.
 *
 * Subscribes to the decompressed map cloud that the control station's
 * point_cloud_transport republisher produces from /rtabmap/cloud_map/draco
 * (see the Point Cloud Compression task). That topic is local to this machine,
 * so rosbridge to the browser never crosses the wireless link. cloud_map is in
 * the map frame, so no TF is needed. Drag to orbit, right-drag to pan, scroll
 * to zoom, double-click to reset the view.
 *
 * The map grows as the robot explores. Clouds larger than MAX_POINTS are
 * evenly subsampled (every Nth point) rather than truncated, so the whole map
 * stays visible.
 *
 * Rendered inside PointCloudWindow, a floating panel next to the cameras.
 *
 * Debug stats per topic are on window.__pointCloudStats in the browser console.
 *
 * Same connection pattern as the other rosbridge hooks: the subscription is
 * recreated whenever rosbridge reconnects.
 */

const MESSAGE_TYPE = 'sensor_msgs/msg/PointCloud2';
const MAX_POINTS = 300000;
const THROTTLE_MS = 500; // cloud_map updates about once a second anyway
const STALL_MS = 5000; // cloud_map only publishes when the map updates
const STATUS_INTERVAL_MS = 500;
const HOME_POSITION = new THREE.Vector3(-6, -6, 6); // above the map origin
const HOME_TARGET = new THREE.Vector3(0, 0, 0);

const styles = {
  // Fills its parent; PointCloudWindow sets the size.
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  viewport: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  mount: { position: 'absolute', inset: 0 },
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

const STATUS_COLORS = { live: '#3ccf6e', stalled: '#ffcc00' };

// Same decoding fallbacks as H264CameraPanel.
function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data && data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

// Copies a PointCloud2 into the preallocated geometry. Returns the point count.
function fillGeometry(msg, geometry) {
  const field = (name) => msg.fields.find((f) => f.name === name);
  const fx = field('x');
  const fy = field('y');
  const fz = field('z');
  const fc = field('rgb') || field('rgba');
  const bytes = toBytes(msg.data);
  if (!fx || !fy || !fz || !bytes) return 0;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = !msg.is_bigendian;
  const step = msg.point_step;
  const total = Math.min(msg.width * msg.height, Math.floor(bytes.byteLength / step));
  const stride = Math.max(1, Math.ceil(total / MAX_POINTS));
  const pos = geometry.attributes.position.array;
  const col = geometry.attributes.color.array;

  let n = 0;
  for (let i = 0; i < total && n < MAX_POINTS; i += stride) {
    const base = i * step;
    const x = view.getFloat32(base + fx.offset, little);
    const y = view.getFloat32(base + fy.offset, little);
    const z = view.getFloat32(base + fz.offset, little);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const j = 3 * n;
    pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    if (fc) {
      const c = view.getUint32(base + fc.offset, little);
      col[j] = ((c >> 16) & 255) / 255;
      col[j + 1] = ((c >> 8) & 255) / 255;
      col[j + 2] = (c & 255) / 255;
    } else {
      col[j] = 0.8; col[j + 1] = 0.8; col[j + 2] = 0.8;
    }
    n++;
  }
  geometry.setDrawRange(0, n);
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeBoundingSphere();
  return n;
}

export default function PointCloudPanel({ ros, isConnected, topic = '/rtabmap/cloud_map_decompressed', label = 'Map' }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [count, setCount] = useState(0);

  // three.js scene: created once, independent of the connection.
  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    camera.up.set(0, 0, 1); // ROS frames are z-up
    camera.position.copy(HOME_POSITION);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME_TARGET);
    controls.enableDamping = true;

    const grid = new THREE.GridHelper(20, 40, 0x555555, 0x2a2a2a);
    grid.rotation.x = Math.PI / 2; // into the x-y plane
    scene.add(grid, new THREE.AxesHelper(1));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({ size: 0.05, vertexColors: true });
    scene.add(new THREE.Points(geometry, material));
    sceneRef.current = { geometry };

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const resetView = () => {
      camera.position.copy(HOME_POSITION);
      controls.target.copy(HOME_TARGET);
    };
    renderer.domElement.addEventListener('dblclick', resetView);

    let frame;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('dblclick', resetView);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Subscription: recreated on every rosbridge (re)connect.
  useEffect(() => {
    if (!ros || !isConnected) {
      setStatus('disconnected');
      return undefined;
    }
    let lastMessageAt = 0;
    // Debug stats in the browser console: window.__pointCloudStats
    const stats = { messages: 0, lastWidth: 0, lastBytes: 0, lastStamp: null, lastAt: null, drawn: 0 };
    window.__pointCloudStats = { ...(window.__pointCloudStats || {}), [topic]: stats };
    const onMessage = (msg) => {
      const current = sceneRef.current;
      if (!current) return;
      lastMessageAt = performance.now();
      stats.messages += 1;
      stats.lastWidth = msg.width * msg.height;
      stats.lastBytes = msg.data ? msg.data.length : 0;
      stats.lastStamp = msg.header && msg.header.stamp;
      stats.lastAt = new Date().toLocaleTimeString();
      stats.drawn = fillGeometry(msg, current.geometry);
      setCount(stats.drawn);
    };

    const rosTopic = new Topic({
      ros,
      name: topic,
      messageType: MESSAGE_TYPE,
      compression: 'cbor', // binary data, about a third smaller than base64 JSON
      queue_length: 1,
      throttle_rate: THROTTLE_MS,
      // This effect owns re-subscription, so roslib's own must be off.
      reconnect_on_close: false,
    });
    rosTopic.subscribe(onMessage);
    setStatus('connecting');

    const timer = setInterval(() => {
      if (lastMessageAt === 0) setStatus('connecting');
      else setStatus(performance.now() - lastMessageAt > STALL_MS ? 'stalled' : 'live');
    }, STATUS_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      rosTopic.unsubscribe(onMessage);
    };
  }, [ros, isConnected, topic]);

  let statusText;
  let overlayMessage = null;
  switch (status) {
    case 'disconnected':
      statusText = 'Not connected to rosbridge';
      break;
    case 'connecting':
      statusText = 'Waiting for points';
      overlayMessage = `No clouds yet on ${topic}`;
      break;
    case 'live':
      statusText = `Live, ${count.toLocaleString()} points`;
      break;
    case 'stalled':
      statusText = 'No map update for over 5 s';
      break;
    default:
      statusText = status;
  }

  return (
    <div style={styles.container}>
      <div style={styles.viewport}>
        <div ref={mountRef} style={styles.mount} />
        {overlayMessage && <div style={styles.message}>{overlayMessage}</div>}
        <div style={styles.status}>
          <span style={{ color: STATUS_COLORS[status] || '#aaaaaa' }}>●</span> {label}: {statusText}
        </div>
      </div>
    </div>
  );
}
