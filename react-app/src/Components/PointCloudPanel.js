import React, { useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';
import * as THREE from 'three';
import useTfTree, { MAP_FRAME, ROBOT_FRAME, cleanFrame, lookupInRobotWorld, lookupRobotPose } from '../ros/tf';
import { forEachPoint, POINT_CLOUD2_TYPE } from '../ros/pointCloud2';
import { ROBOT_GROUND_Z, ROBOT_HEIGHT, ROBOT_LENGTH, ROBOT_WIDTH } from '../ros/robot';

/**
 * Third-person 3D view of what the robot's lidar sees right now.
 *
 * Shows only the latest scan from /unilidar/cloud (the Unitree L2 on the real
 * robot, the gpu_lidar in Gazebo; RTAB-Map maps from the same topic). Nothing
 * is accumulated: each scan replaces the previous one, so the view is always
 * built around the robot's current location. Each scan is placed in the world
 * with the robot pose at the moment it arrives, so it stays put while the
 * robot moves until the next one replaces it.
 *
 * The view is a chase camera: behind and above the robot, looking along its
 * driving direction, with the robot kept in the middle. When the operator
 * switches direction (directionSwitched), the camera swings round to the other
 * end of the robot and the marker's nose moves to the rear, matching the rear
 * camera and the reversed drive. Scroll to change the follow
 * distance, double-click to reset it.
 *
 * Poses come from TF. The robot is base_link in map (base_link -> odom -> map;
 * without map -> odom it falls back to odom). The scan's own frame
 * (unilidar_link) hangs off base_link through a fixed joint, published on
 * /tf_static. The robot is drawn as a box for now; replace the children of the
 * `robot` group with the real model later (see makeRobotMarker).
 *
 * Points without colour are coloured by height in the world.
 *
 * Shown in the dashboard's middle column, under the camera, next to the minimap.
 * Debug stats per topic are on window.__pointCloudStats in the browser console.
 * Subscriptions are recreated whenever rosbridge reconnects.
 */

// Point budget. VOXEL_SIZE is the main knob: doubling it cuts the drawn points
// on surfaces about 4x. Thinning here saves browser decoding and drawing; it
// cannot shrink what rosbridge sends, which is the full cloud.
const VOXEL_SIZE = 0.05;           // metres; one point is kept per cube
const MAX_INPUT_POINTS = 400000;   // points read per cloud, at most
const MAX_POINTS = 100000;         // points drawn, at most
// Scans per second shown = 1000 / THROTTLE_MS. The lidar publishes at 10 Hz;
// each scan is a few hundred KB, and on the real robot it crosses the wireless
// link, so 5 Hz is the default. rosbridge drops the others before sending.
const THROTTLE_MS = 200;
const STALL_MS = 1000;
// Height colouring for clouds without rgb: blue at HEIGHT_MIN, red at HEIGHT_MAX.
const HEIGHT_MIN = -0.2;
const HEIGHT_MAX = 1.5;
const STATUS_INTERVAL_MS = 500;

const POSE_SMOOTHING_S = 0.12; // eases the 10-20 Hz TF updates into 60 fps motion
const VIEW_SWING_S = 0.15;     // time constant of the 180 degree swing on a direction switch

// Chase camera.
const FOLLOW_DISTANCE = 5;      // metres from the robot, along the view line
const FOLLOW_PITCH = THREE.MathUtils.degToRad(42); // how far it looks down
const MIN_FOLLOW_DISTANCE = 1.5;
const MAX_FOLLOW_DISTANCE = 25;

const styles = {
  // Fills its parent; the map card in App.js sets the size.
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

// Copies a PointCloud2 into the preallocated geometry, in the cloud's own
// frame, keeping one point per VOXEL_SIZE cube. worldMatrix (world_T_cloud) is
// only used for height colouring. Returns the point count.
function fillGeometry(msg, geometry, worldMatrix) {
  const m = worldMatrix.elements; // column-major: world z = m2 x + m6 y + m10 z + m14
  const fc = msg.fields.find((f) => f.name === 'rgb' || f.name === 'rgba');
  const little = !msg.is_bigendian;
  const pos = geometry.attributes.position.array;
  const col = geometry.attributes.color.array;
  const occupied = new Set(); // voxel keys already holding a point

  let n = 0;
  forEachPoint(msg, MAX_INPUT_POINTS, (x, y, z, view, base) => {
    // Integer voxel coordinates, offset to be non-negative and packed into one
    // number (exact up to about +-1.6 km per axis at 0.05 m).
    const key = ((Math.floor(x / VOXEL_SIZE) + 32768) * 65536
      + (Math.floor(y / VOXEL_SIZE) + 32768)) * 65536
      + (Math.floor(z / VOXEL_SIZE) + 32768);
    if (occupied.has(key)) return false;
    occupied.add(key);
    const j = 3 * n;
    pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    if (fc) {
      const c = view.getUint32(base + fc.offset, little);
      col[j] = ((c >> 16) & 255) / 255;
      col[j + 1] = ((c >> 8) & 255) / 255;
      col[j + 2] = (c & 255) / 255;
    } else {
      const zWorld = m[2] * x + m[6] * y + m[10] * z + m[14];
      const t = Math.min(1, Math.max(0, (zWorld - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)));
      heightColor.setHSL((1 - t) * 0.66, 1, 0.5); // blue (low) -> red (high)
      col[j] = heightColor.r; col[j + 1] = heightColor.g; col[j + 2] = heightColor.b;
    }
    n++;
    return n >= MAX_POINTS;
  });
  geometry.setDrawRange(0, n);
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeBoundingSphere();
  return n;
}

const heightColor = new THREE.Color();

// Placeholder robot: a box with a cone on the front so heading is obvious.
// Everything is a child of the returned group, which is what gets moved, so
// the real model can replace these children without touching the pose code.
function makeRobotMarker() {
  const robot = new THREE.Group();
  const bodyZ = ROBOT_GROUND_Z + ROBOT_HEIGHT / 2;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(ROBOT_LENGTH, ROBOT_WIDTH, ROBOT_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.8 }),
  );
  body.position.z = bodyZ;
  body.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  ));

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(ROBOT_WIDTH * 0.3, 0.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
  );
  nose.rotation.z = -Math.PI / 2; // cone points along +y; turn it to +x (forward)
  nose.position.set(ROBOT_LENGTH / 2 + 0.2, 0, bodyZ);

  robot.add(body, nose);
  robot.userData.nose = nose; // flipped to the rear by setNoseDirection
  robot.visible = false; // shown once the first pose arrives
  return robot;
}

// Puts the nose cone on the driving end: the front (+x) normally, the rear
// when the direction is switched.
function setNoseDirection(robot, reversed) {
  const nose = robot.userData.nose;
  const sign = reversed ? -1 : 1;
  nose.position.x = sign * (ROBOT_LENGTH / 2 + 0.2);
  nose.rotation.z = -sign * Math.PI / 2;
}

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

export default function PointCloudPanel({
  ros, isConnected, topic = '/unilidar/cloud', label = 'Lidar', directionSwitched = false,
}) {
  // Read by the render loop every frame, so it must not restart the scene.
  const directionRef = useRef(directionSwitched);
  directionRef.current = directionSwitched;
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const tfTreeRef = useTfTree(ros, isConnected);
  const [status, setStatus] = useState('disconnected');
  const [count, setCount] = useState(0);
  const [poseSource, setPoseSource] = useState(null); // null, 'map' or another root frame

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

    const grid = new THREE.GridHelper(20, 40, 0x555555, 0x2a2a2a);
    grid.rotation.x = Math.PI / 2; // into the x-y plane
    scene.add(grid, new THREE.AxesHelper(1));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({ size: VOXEL_SIZE, vertexColors: true });
    // The scan is drawn in its own frame; its matrix places it in the world.
    const points = new THREE.Points(geometry, material);
    points.matrixAutoUpdate = false;
    points.frustumCulled = false; // bounding sphere is in cloud frame, not world
    scene.add(points);
    sceneRef.current = { geometry, points };

    const robot = makeRobotMarker();
    scene.add(robot);

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

    // Scroll changes only the follow distance; the camera always stays behind
    // the robot.
    let followDistance = FOLLOW_DISTANCE;
    const onWheel = (event) => {
      event.preventDefault();
      followDistance = THREE.MathUtils.clamp(
        followDistance * Math.exp(event.deltaY * 0.001),
        MIN_FOLLOW_DISTANCE, MAX_FOLLOW_DISTANCE,
      );
    };
    const resetView = () => { followDistance = FOLLOW_DISTANCE; };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('dblclick', resetView);

    const targetPosition = new THREE.Vector3();
    const targetRotation = new THREE.Quaternion();
    const unitScale = new THREE.Vector3();
    const heading = new THREE.Vector3();
    let lastTime = performance.now();
    let viewOffset = 0; // eased 0 (forward) <-> PI (direction switched)

    let frame;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.25);
      lastTime = now;

      // Ease the robot marker toward the latest TF pose.
      const pose = lookupRobotPose(tfTreeRef.current);
      if (pose) {
        pose.matrix.decompose(targetPosition, targetRotation, unitScale);
        if (!robot.visible) {
          robot.position.copy(targetPosition);
          robot.quaternion.copy(targetRotation);
          robot.visible = true;
        } else {
          const alpha = 1 - Math.exp(-dt / POSE_SMOOTHING_S);
          robot.position.lerp(targetPosition, alpha);
          robot.quaternion.slerp(targetRotation, alpha);
        }
      }

      // Chase camera: behind the robot along its heading (yaw only, so the
      // view does not rock with pitch and roll), looking at the robot so it
      // stays centred.
      // Direction switch: swing the camera round to the other end over about
      // half a second rather than jumping, and move the nose with it.
      const reversed = Boolean(directionRef.current);
      setNoseDirection(robot, reversed);
      const targetOffset = reversed ? Math.PI : 0;
      viewOffset += (targetOffset - viewOffset) * (1 - Math.exp(-dt / VIEW_SWING_S));
      if (Math.abs(targetOffset - viewOffset) < 1e-3) viewOffset = targetOffset;

      heading.set(1, 0, 0).applyQuaternion(robot.quaternion);
      const yaw = Math.atan2(heading.y, heading.x) + viewOffset;
      const back = followDistance * Math.cos(FOLLOW_PITCH);
      camera.position.set(
        robot.position.x - back * Math.cos(yaw),
        robot.position.y - back * Math.sin(yaw),
        robot.position.z + followDistance * Math.sin(FOLLOW_PITCH),
      );
      camera.lookAt(robot.position);

      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('dblclick', resetView);
      disposeObject(robot);
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
    let missingTfFrame = null;
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

      // Place the scan with the latest known pose of its frame. It must share
      // the robot's root frame, or it would be drawn in the wrong place.
      const cloudFrame = cleanFrame(msg.header && msg.header.frame_id);
      const placement = lookupInRobotWorld(tfTreeRef.current, cloudFrame);
      if (!placement) {
        stats.missingTf = cloudFrame;
        missingTfFrame = cloudFrame;
        current.geometry.setDrawRange(0, 0); // never show a scan in the wrong place
        setCount(0);
        return;
      }
      missingTfFrame = null;
      current.points.matrix.copy(placement);
      current.points.matrixWorldNeedsUpdate = true;
      stats.drawn = fillGeometry(msg, current.geometry, placement);
      setCount(stats.drawn);
    };

    const rosTopic = new Topic({
      ros,
      name: topic,
      messageType: POINT_CLOUD2_TYPE,
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
      else if (performance.now() - lastMessageAt > STALL_MS) setStatus('stalled');
      else setStatus(missingTfFrame ? `notf:${missingTfFrame}` : 'live');
    }, STATUS_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      rosTopic.unsubscribe(onMessage);
    };
  }, [ros, isConnected, topic]);

  // Pose status for the status line (the render loop reads TF directly).
  useEffect(() => {
    const timer = setInterval(() => {
      const pose = lookupRobotPose(tfTreeRef.current);
      setPoseSource(pose ? pose.root : null);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tfTreeRef]);

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
      statusText = 'No scan for over 1 s';
      break;
    default:
      if (status.startsWith('notf:')) {
        statusText = 'Scan not shown';
        overlayMessage = `No transform from ${status.slice(5)} to the robot (check /tf_static)`;
      } else {
        statusText = status;
      }
  }

  let poseText;
  if (poseSource === MAP_FRAME) poseText = 'robot pose live';
  else if (poseSource) poseText = `robot pose from ${poseSource} only (no ${MAP_FRAME} frame)`;
  else poseText = `waiting for ${ROBOT_FRAME} on /tf`;

  return (
    <div style={styles.container}>
      <div style={styles.viewport}>
        <div ref={mountRef} style={styles.mount} />
        {overlayMessage && <div style={styles.message}>{overlayMessage}</div>}
        <div style={styles.status}>
          <span style={{ color: STATUS_COLORS[status] || '#aaaaaa' }}>●</span> {label}: {statusText}
          {status !== 'disconnected' && ` · ${poseText}`}
        </div>
      </div>
    </div>
  );
}
