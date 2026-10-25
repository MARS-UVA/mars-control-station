import React, { useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';
import useTfTree, { cleanFrame, lookupInRobotWorld, lookupRobotPose, yawOf } from '../ros/tf';
import { forEachPoint, POINT_CLOUD2_TYPE } from '../ros/pointCloud2';
import { ROBOT_GROUND_Z, ROBOT_LENGTH, ROBOT_WIDTH } from '../ros/robot';
import { ARENA, ROBOT_START_IN_ARENA } from '../arena';

/**
 * Bird's-eye minimap built from the live lidar scans (/unilidar/cloud).
 *
 * Every scan is placed in the world with TF and dropped into a 2.5D height
 * grid of CELL_SIZE cells: each cell keeps the lowest and highest point seen in
 * it. A scan overwrites the cells it hits, so moved obstacles update, while
 * cells out of view keep their last value, so the map fills in as the robot
 * drives. Clear empties it.
 *
 * Colours: terrain is shaded by height relative to the ground under the robot
 * (blue = lower, green = level, orange = higher), which shows hills and
 * craters. Cells with a sudden height step of OBSTACLE_STEP or more, within the
 * cell or to a neighbour, are drawn red as obstacles (rocks, walls, crater
 * edges). Unseen cells stay dark.
 *
 * The yellow arrow marks the driving end: the front normally, the rear when
 * the operator switches direction (directionSwitched).
 *
 * View: centred on the robot, heading-up by default (the robot always points
 * up) or map-up. Drag to pan away from the robot, scroll to zoom, double-click
 * or Recenter to go back.
 *
 * The grid covers GRID_EXTENT around the map origin, which is where the robot
 * starts. Points outside it are ignored.
 *
 * The arena zones and target berm area (arena.js) are drawn on top, placed from the robot's
 * starting pose in the arena (ROBOT_START_IN_ARENA), since the map frame
 * starts where the robot does. The Arena button hides them.
 */

const LIDAR_TOPIC = '/unilidar/cloud';
const THROTTLE_MS = 200;          // 5 scans per second
const MAX_INPUT_POINTS = 60000;   // per scan; the sim lidar sends about 11,500
const STALL_MS = 1000;
const STATUS_INTERVAL_MS = 500;

const CELL_SIZE = 0.1;            // metres per grid cell
const GRID_EXTENT = 40;           // metres per side, centred on the map origin
const GRID_CELLS = Math.round(GRID_EXTENT / CELL_SIZE);
const GRID_ORIGIN = -GRID_EXTENT / 2; // world x/y of the grid's first cell edge

const OBSTACLE_STEP = 0.2;        // metres of height jump that counts as an obstacle
const ELEVATION_RANGE = 0.3;      // +- metres mapped onto the terrain colours
const MAX_POINT_HEIGHT = 2.0;     // ignore returns this far above the ground (overhangs)
const BODY_MARGIN = 0.15;         // ignore returns this close to the robot's outline

// Default zoom: fit FIT_RADIUS metres around the robot into the panel's
// shorter side, so from the start pose the far end of the arena (5.9 m away)
// is in view whatever size the panel is. Scrolling overrides it until a
// double-click resets it.
const FIT_RADIUS = 6.2;
const DEFAULT_SCALE = 40;         // CSS pixels per metre, used until the panel is measured
const MIN_SCALE = 4;
const MAX_SCALE = 150;

const COLORS = {
  background: '#151515',
  obstacle: [225, 55, 55],
  robot: '#0088ff',
  robotEdge: '#ffffff',
  nose: '#ffcc00',
  arenaWall: 'rgba(255, 255, 255, 0.9)',
  zoneLine: 'rgba(255, 255, 255, 0.55)',
  startZone: '#8bd450',
  constructionZone: '#f2a33a',
  berm: '#ff4d4d',
  label: 'rgba(255, 255, 255, 0.85)',
};

// Arena zones in arena coordinates, with their label anchor points.
const ZONE_LABELS = [
  { text: 'Excavation', x: ARENA.zoneDivideX / 2, y: ARENA.height - 0.3 },
  { text: 'Obstacle', x: (ARENA.zoneDivideX + ARENA.width) / 2, y: ARENA.height - 0.3 },
  {
    text: 'Start',
    x: ARENA.startZone.x + ARENA.startZone.w / 2,
    y: ARENA.startZone.y + ARENA.startZone.h - 0.25,
    color: COLORS.startZone,
  },
  {
    text: 'Construction',
    x: ARENA.constructionZone.x + ARENA.constructionZone.w / 2,
    y: ARENA.constructionZone.y + ARENA.constructionZone.h - 0.25,
    color: COLORS.constructionZone,
  },
  { text: 'Berm', x: ARENA.berm.cx, y: ARENA.berm.cy, color: COLORS.berm },
];

// Draws the arena zones. ctx must already map world (map frame) metres to
// the screen; k is device pixels per metre, for line widths and dashes.
// Labels are drawn upright in screen space so they never appear mirrored or
// upside down when the view rotates.
function drawArena(ctx, k, dpr) {
  ctx.save();
  // map_T_arena = inverse(arena_T_start): rotate back by the start heading,
  // then shift so the start position sits at the map origin.
  ctx.rotate(-ROBOT_START_IN_ARENA.yaw);
  ctx.translate(-ROBOT_START_IN_ARENA.x, -ROBOT_START_IN_ARENA.y);
  const px = (n) => n / k; // n device pixels, in metres

  // Zone fills first, faint, so the terrain still shows through.
  const zones = [
    [ARENA.startZone, COLORS.startZone],
    [ARENA.constructionZone, COLORS.constructionZone],
  ];
  ctx.globalAlpha = 0.12;
  for (const [z, color] of zones) {
    ctx.fillStyle = color;
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }
  ctx.globalAlpha = 1;

  // Excavation / obstacle divide.
  ctx.strokeStyle = COLORS.zoneLine;
  ctx.lineWidth = px(1.5 * dpr);
  ctx.beginPath();
  ctx.moveTo(ARENA.zoneDivideX, 0);
  ctx.lineTo(ARENA.zoneDivideX, ARENA.height);
  ctx.stroke();

  // Starting and construction zones, dashed.
  ctx.setLineDash([px(6 * dpr), px(4 * dpr)]);
  ctx.lineWidth = px(2 * dpr);
  for (const [z, color] of zones) {
    ctx.strokeStyle = color;
    ctx.strokeRect(z.x, z.y, z.w, z.h);
  }
  ctx.setLineDash([]);

  // Target berm area: a solid outline with a light fill, so it reads as the
  // place to build rather than another zone.
  const berm = ARENA.berm;
  const bx = berm.cx - berm.w / 2;
  const by = berm.cy - berm.h / 2;
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = COLORS.berm;
  ctx.fillRect(bx, by, berm.w, berm.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLORS.berm;
  ctx.lineWidth = px(2 * dpr);
  ctx.strokeRect(bx, by, berm.w, berm.h);

  // Arena walls.
  ctx.strokeStyle = COLORS.arenaWall;
  ctx.lineWidth = px(3 * dpr);
  ctx.strokeRect(0, 0, ARENA.width, ARENA.height);

  // Labels: arena point -> screen point, then draw unrotated.
  const toScreen = ctx.getTransform();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const label of ZONE_LABELS) {
    const p = toScreen.transformPoint(new DOMPoint(label.x, label.y));
    ctx.fillStyle = label.color || COLORS.label;
    ctx.fillText(label.text, p.x / dpr, p.y / dpr);
  }
  ctx.restore();
}

// 256-step terrain palette: blue (low) -> green (level) -> orange (high).
const TERRAIN_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const h = (220 - t * 185) / 360;
    const [r, g, b] = hslToRgb(h, 0.55, 0.42);
    lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
  }
  return lut;
})();

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: COLORS.background },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' },
  buttons: { position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 },
  button: {
    padding: '3px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #666',
    background: 'rgba(0,0,0,0.6)', color: 'white', cursor: 'pointer',
  },
  status: {
    position: 'absolute', left: 8, bottom: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 6,
    color: 'white', padding: '3px 8px', fontSize: 12, pointerEvents: 'none',
  },
};

function createGrid() {
  const n = GRID_CELLS * GRID_CELLS;
  return {
    minZ: new Float32Array(n),
    maxZ: new Float32Array(n),
    scanOf: new Uint32Array(n),   // last scan that touched the cell; 0 = never seen
    scan: 0,
    // Bounding box of seen cells, so recolouring skips the empty grid.
    lo: [GRID_CELLS, GRID_CELLS],
    hi: [-1, -1],
    image: new ImageData(GRID_CELLS, GRID_CELLS),
    dirty: false,
  };
}

// Drops one scan into the grid. world (world_T_cloud) and robot (world_T_base)
// are Matrix4s. Returns the number of points used.
function addScan(grid, msg, world, robot) {
  const m = world.elements;
  const r = robot.elements;
  const rx = r[12];
  const ry = r[13];
  const groundZ = r[14] + ROBOT_GROUND_Z;
  const yaw = Math.atan2(r[1], r[0]);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const halfL = ROBOT_LENGTH / 2 + BODY_MARGIN;
  const halfW = ROBOT_WIDTH / 2 + BODY_MARGIN;
  const scan = ++grid.scan;
  let used = 0;

  forEachPoint(msg, MAX_INPUT_POINTS, (x, y, z) => {
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (wz - groundZ > MAX_POINT_HEIGHT) return false;
    // Skip returns off the robot itself.
    const dx = wx - rx;
    const dy = wy - ry;
    if (Math.abs(dx * cos + dy * sin) < halfL && Math.abs(-dx * sin + dy * cos) < halfW) return false;

    const i = Math.floor((wx - GRID_ORIGIN) / CELL_SIZE);
    const j = Math.floor((wy - GRID_ORIGIN) / CELL_SIZE);
    if (i < 0 || j < 0 || i >= GRID_CELLS || j >= GRID_CELLS) return false;
    const c = j * GRID_CELLS + i;
    if (grid.scanOf[c] !== scan) {
      // First hit in this scan: replace whatever the cell held before.
      grid.scanOf[c] = scan;
      grid.minZ[c] = wz;
      grid.maxZ[c] = wz;
    } else {
      if (wz < grid.minZ[c]) grid.minZ[c] = wz;
      if (wz > grid.maxZ[c]) grid.maxZ[c] = wz;
    }
    if (i < grid.lo[0]) grid.lo[0] = i;
    if (j < grid.lo[1]) grid.lo[1] = j;
    if (i > grid.hi[0]) grid.hi[0] = i;
    if (j > grid.hi[1]) grid.hi[1] = j;
    used++;
    return false;
  });
  grid.dirty = true;
  return used;
}

// Recolours the seen part of the grid into grid.image. groundZ is the height
// that counts as level (the ground under the robot now).
function paintGrid(grid, groundZ) {
  const { minZ, maxZ, scanOf, image } = grid;
  const px = image.data;
  const N = GRID_CELLS;
  const lut = TERRAIN_LUT;
  for (let j = grid.lo[1]; j <= grid.hi[1]; j++) {
    for (let i = grid.lo[0]; i <= grid.hi[0]; i++) {
      const c = j * N + i;
      const p = c * 4;
      if (!scanOf[c]) { px[p + 3] = 0; continue; }
      const top = maxZ[c];
      // Height step inside the cell, or from this cell's top down to the
      // lowest seen neighbour.
      let lowest = minZ[c];
      if (i > 0 && scanOf[c - 1] && minZ[c - 1] < lowest) lowest = minZ[c - 1];
      if (i < N - 1 && scanOf[c + 1] && minZ[c + 1] < lowest) lowest = minZ[c + 1];
      if (j > 0 && scanOf[c - N] && minZ[c - N] < lowest) lowest = minZ[c - N];
      if (j < N - 1 && scanOf[c + N] && minZ[c + N] < lowest) lowest = minZ[c + N];
      if (top - lowest >= OBSTACLE_STEP) {
        px[p] = COLORS.obstacle[0]; px[p + 1] = COLORS.obstacle[1]; px[p + 2] = COLORS.obstacle[2];
      } else {
        const t = (top - groundZ + ELEVATION_RANGE) / (2 * ELEVATION_RANGE);
        const k = Math.round(Math.min(1, Math.max(0, t)) * 255) * 3;
        px[p] = lut[k]; px[p + 1] = lut[k + 1]; px[p + 2] = lut[k + 2];
      }
      px[p + 3] = 255;
    }
  }
}

export default function MiniMapPanel({ ros, isConnected, directionSwitched = false }) {
  // Read by the render loop every frame.
  const directionRef = useRef(directionSwitched);
  directionRef.current = directionSwitched;
  const canvasRef = useRef(null);
  const gridRef = useRef(null);
  if (!gridRef.current) gridRef.current = createGrid();
  const tfTreeRef = useTfTree(ros, isConnected);

  // View state lives in a ref so the render loop and pointer handlers share it
  // without re-rendering; React state only mirrors what the buttons show.
  const viewRef = useRef({ scale: DEFAULT_SCALE, userZoomed: false, headingUp: true, pan: null, showArena: true });
  const [headingUp, setHeadingUp] = useState(true);
  const [showArena, setShowArena] = useState(true);
  const [panned, setPanned] = useState(false);
  const [status, setStatus] = useState('disconnected');

  // Lidar subscription: recreated on every rosbridge (re)connect.
  useEffect(() => {
    if (!ros || !isConnected) {
      setStatus('disconnected');
      return undefined;
    }
    let lastAt = 0;
    let missingTf = null;
    const onScan = (msg) => {
      lastAt = performance.now();
      const tree = tfTreeRef.current;
      const frame = cleanFrame(msg.header && msg.header.frame_id);
      const world = lookupInRobotWorld(tree, frame);
      const robot = lookupRobotPose(tree);
      if (!world || !robot) { missingTf = frame || '(none)'; return; }
      missingTf = null;
      addScan(gridRef.current, msg, world, robot.matrix);
    };
    const topic = new Topic({
      ros,
      name: LIDAR_TOPIC,
      messageType: POINT_CLOUD2_TYPE,
      compression: 'cbor',
      queue_length: 1,
      throttle_rate: THROTTLE_MS,
      reconnect_on_close: false,
    });
    topic.subscribe(onScan);
    setStatus('waiting');
    const timer = setInterval(() => {
      if (!lastAt) setStatus('waiting');
      else if (performance.now() - lastAt > STALL_MS) setStatus('stalled');
      else setStatus(missingTf ? `notf:${missingTf}` : 'live');
    }, STATUS_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      topic.unsubscribe(onScan);
    };
  }, [ros, isConnected, tfTreeRef]);

  // Canvas, render loop and pointer handling.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const offscreen = document.createElement('canvas');
    offscreen.width = GRID_CELLS;
    offscreen.height = GRID_CELLS;
    const offCtx = offscreen.getContext('2d');
    const view = viewRef.current;
    let robotX = 0;
    let robotY = 0;
    let robotYaw = 0;
    let viewYaw = Math.PI / 2;

    const fitScale = () => Math.min(MAX_SCALE, Math.max(MIN_SCALE,
      Math.min(canvas.clientWidth, canvas.clientHeight) / 2 / FIT_RADIUS));
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (!view.userZoomed) view.scale = fitScale();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame;
    const draw = () => {
      const grid = gridRef.current;
      const pose = lookupRobotPose(tfTreeRef.current);
      if (pose) {
        const e = pose.matrix.elements;
        robotX = e[12]; robotY = e[13]; robotYaw = yawOf(pose.matrix);
        if (grid.dirty) {
          paintGrid(grid, e[14] + ROBOT_GROUND_Z);
          offCtx.putImageData(grid.image, 0, 0);
          grid.dirty = false;
        }
      }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, w, h);

      // World -> screen: the view centre at the canvas centre, the view's "up"
      // direction (robot heading, or map +y) pointing up the screen.
      viewYaw = view.headingUp ? robotYaw : Math.PI / 2;
      const k = view.scale * dpr;
      const c = Math.cos(viewYaw);
      const s = Math.sin(viewYaw);
      const centerX = robotX + (view.pan ? view.pan.x : 0);
      const centerY = robotY + (view.pan ? view.pan.y : 0);
      const a = k * s; const b = -k * c; const cc = -k * c; const d = -k * s;
      ctx.setTransform(a, b, cc, d,
        w / 2 - (a * centerX + cc * centerY),
        h / 2 - (b * centerX + d * centerY));

      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.transform(CELL_SIZE, 0, 0, CELL_SIZE, GRID_ORIGIN, GRID_ORIGIN);
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();

      if (view.showArena) drawArena(ctx, k, dpr);

      // Robot: outline box plus a nose triangle at the front.
      ctx.save();
      ctx.translate(robotX, robotY);
      ctx.rotate(robotYaw);
      ctx.globalAlpha = pose ? 0.9 : 0.35;
      ctx.fillStyle = COLORS.robot;
      ctx.fillRect(-ROBOT_LENGTH / 2, -ROBOT_WIDTH / 2, ROBOT_LENGTH, ROBOT_WIDTH);
      ctx.lineWidth = 2 / k;
      ctx.strokeStyle = COLORS.robotEdge;
      ctx.strokeRect(-ROBOT_LENGTH / 2, -ROBOT_WIDTH / 2, ROBOT_LENGTH, ROBOT_WIDTH);
      // Arrow on the driving end: mirrored to the rear when switched.
      const end = directionRef.current ? -1 : 1;
      ctx.fillStyle = COLORS.nose;
      ctx.beginPath();
      ctx.moveTo(end * (ROBOT_LENGTH / 2 + 0.35), 0);
      ctx.lineTo(end * ROBOT_LENGTH / 2, ROBOT_WIDTH * 0.3);
      ctx.lineTo(end * ROBOT_LENGTH / 2, -ROBOT_WIDTH * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Scale bar (screen space): the largest round length under 80 px.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const metres = [0.5, 1, 2, 5, 10, 20].filter((len) => len * view.scale <= 80).pop() || 0.5;
      const barPx = metres * view.scale;
      const x0 = canvas.clientWidth - barPx - 12;
      const y0 = canvas.clientHeight - 14;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0); ctx.lineTo(x0 + barPx, y0); ctx.lineTo(x0 + barPx, y0 - 4);
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${metres} m`, x0 + barPx / 2, y0 - 6);

      frame = requestAnimationFrame(draw);
    };
    draw();

    // Drag to pan: screen movement converted to world movement for the
    // current zoom and rotation, so the map follows the pointer.
    let dragging = null;
    const onPointerDown = (event) => {
      canvas.setPointerCapture(event.pointerId);
      dragging = { x: event.clientX, y: event.clientY };
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      const du = (event.clientX - dragging.x) / view.scale;
      const dv = -(event.clientY - dragging.y) / view.scale;
      dragging = { x: event.clientX, y: event.clientY };
      const c = Math.cos(viewYaw);
      const s = Math.sin(viewYaw);
      const pan = view.pan || { x: 0, y: 0 };
      view.pan = { x: pan.x - (s * du + c * dv), y: pan.y - (-c * du + s * dv) };
      setPanned(true);
    };
    const onPointerUp = () => {
      dragging = null;
      canvas.style.cursor = 'grab';
    };
    const onWheel = (event) => {
      event.preventDefault();
      view.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * Math.exp(-event.deltaY * 0.001)));
      view.userZoomed = true;
    };
    const onDoubleClick = () => {
      view.pan = null;
      view.userZoomed = false;
      view.scale = fitScale();
      setPanned(false);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
    };
  }, [tfTreeRef]);

  const toggleHeadingUp = () => {
    viewRef.current.headingUp = !viewRef.current.headingUp;
    setHeadingUp(viewRef.current.headingUp);
  };
  const toggleArena = () => {
    viewRef.current.showArena = !viewRef.current.showArena;
    setShowArena(viewRef.current.showArena);
  };
  const recenter = () => {
    viewRef.current.pan = null;
    setPanned(false);
  };
  const clear = () => {
    const grid = createGrid();
    grid.dirty = true; // repaint so the old image is replaced by the empty one
    gridRef.current = grid;
  };

  let statusText;
  if (status === 'disconnected') statusText = 'Not connected to rosbridge';
  else if (status === 'waiting') statusText = `Waiting for ${LIDAR_TOPIC}`;
  else if (status === 'stalled') statusText = 'No scan for over 1 s';
  else if (status.startsWith('notf:')) statusText = `No transform for ${status.slice(5)}`;
  else statusText = null;

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={styles.buttons}>
        {panned && <button type="button" style={styles.button} onClick={recenter}>Recenter</button>}
        <button type="button" style={styles.button} onClick={toggleHeadingUp}>
          {headingUp ? 'Heading up' : 'Map up'}
        </button>
        <button type="button" style={styles.button} onClick={toggleArena}>
          {showArena ? 'Hide arena' : 'Show arena'}
        </button>
        <button type="button" style={styles.button} onClick={clear}>Clear</button>
      </div>
      {statusText && <div style={styles.status}>{statusText}</div>}
    </div>
  );
}
