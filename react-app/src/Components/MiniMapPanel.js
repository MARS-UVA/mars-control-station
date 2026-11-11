import React, { useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';
import useTfTree, {
  cleanFrame, lookupInRobotWorld, lookupRobotPose, MAP_FRAME, yawOf,
} from '../ros/tf';
import { ROBOT_WIDTH, robotFootprint } from '../ros/robot';
import { ARENA, ROBOT_START_IN_ARENA } from '../arena';
import usePlanPath from '../hooks/usePlanPath';
import { quaternionYaw } from '../ros/navPath';

/**
 * Bird's-eye minimap built from Nav2's costmaps on the robot, the same maps
 * the planner and controller use (mars-jetson robot_navigation/config):
 *
 * - Global costmap (/global_costmap/costmap, map frame, 1 Hz): RTAB-Map's
 *   lidar occupancy grid plus Nav2's inflation, covering the whole mapped
 *   arena. Drawn as the base layer: free space grey, obstacles red, the
 *   inflation margin as a fading red halo, unknown space left dark.
 * - Local costmap (/local_costmap/costmap, odom frame, 2 Hz): a 6 x 6 m window
 *   around the robot built from the RGB-D cameras. Drawn on top in orange,
 *   obstacles and inflation only, so live obstacles near the robot stand out
 *   and global obstacles outside the cameras' view stay visible. The window
 *   itself is not outlined: it is sized for the controller's 2.8 s horizon,
 *   much larger than the cameras' 2.5 m marking range, so its edge says
 *   little and would cover most of the arena.
 *
 * Both are nav_msgs/OccupancyGrid in Nav2's costmap scale: -1 unknown,
 * 0 free, 1-98 inflation, 99 the robot's footprint would touch an obstacle,
 * 100 obstacle. They are corrected on the robot (AprilTag fixes, loop
 * closures), so the minimap keeps no history of its own. They only exist
 * while Nav2 runs (enable_nav2:=true); otherwise the panel says it is
 * waiting for them.
 *
 * Arena: the zones from /arena/markers (arena_markers_node, published when
 * Nav2 is launched with arena_name), read once per connection. Without them
 * the built-in layout in arena.js is drawn instead and a note says so. RTAB-Map
 * anchors the map frame to the AprilTags, so map coordinates are arena
 * coordinates; with no map frame the pose falls back to odom, which starts at
 * the robot's starting pose, and the built-in layout is placed from
 * ROBOT_START_IN_ARENA.
 *
 * The yellow arrow marks the driving end: the front normally, the rear when
 * the operator switches direction (directionSwitched).
 *
 * View: centred on the robot, heading-up by default (the robot always points
 * up) or map-up. Drag to pan away from the robot, scroll to zoom, double-click
 * or Recenter to go back. The Global, Local and Arena buttons toggle layers.
 *
 * Path preview: Set goal arms a single pick. Click a spot to place the goal;
 * drag before releasing to choose the heading the robot should end at,
 * otherwise it faces away from the robot. Esc or Cancel goal disarms it. The
 * goal goes to Nav2's planner (/compute_path_to_pose, usePlanPath) and the
 * returned path is drawn in magenta, dashed where the robot would reverse.
 * This only plans: the robot does not move. Picking needs the map frame
 * (RTAB-Map running), since that is the planner's global frame.
 */

const GLOBAL_COSTMAP_TOPIC = '/global_costmap/costmap';
const LOCAL_COSTMAP_TOPIC = '/local_costmap/costmap';
const ARENA_MARKERS_TOPIC = '/arena/markers';
const OCCUPANCY_GRID_TYPE = 'nav_msgs/msg/OccupancyGrid';
const MARKER_ARRAY_TYPE = 'visualization_msgs/msg/MarkerArray';
const STALE_MS = 3000;            // the global costmap publishes at 1 Hz, the local at 2 Hz
const STATUS_INTERVAL_MS = 500;

// visualization_msgs/Marker types and actions the arena node uses.
const MARKER_LINE_STRIP = 4;
const MARKER_LINE_LIST = 5;
const MARKER_TEXT = 9;            // TEXT_VIEW_FACING
const MARKER_DELETE = 2;
const MARKER_DELETEALL = 3;

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
  globalCost: [225, 55, 55],
  globalFree: [46, 46, 46, 255],
  localCost: [255, 160, 40],
  robot: '#0088ff',
  robotEdge: '#ffffff',
  nose: '#ffcc00',
  path: '#e65cff',
  pathCasing: 'rgba(0, 0, 0, 0.7)',
  goalFailed: '#bdbdbd',
  arenaWall: 'rgba(255, 255, 255, 0.9)',
  zoneLine: 'rgba(255, 255, 255, 0.55)',
  startZone: '#8bd450',
  constructionZone: '#f2a33a',
  berm: '#ff4d4d',
  label: 'rgba(255, 255, 255, 0.85)',
};

// RGBA lookup for costmap values: entries 0-100 by value, 101 for unknown
// (left transparent). Free cells get freeRgba, or stay transparent when null.
// Inflation is a light halo that strengthens with cost, so free space still
// reads; 99 (the footprint would touch) is half opaque, 100 fully.
function buildPalette(rgb, freeRgba) {
  const lut = new Uint8ClampedArray(102 * 4);
  if (freeRgba) lut.set(freeRgba, 0);
  for (let v = 1; v <= 100; v++) {
    let alpha;
    if (v === 100) alpha = 255;
    else if (v === 99) alpha = 120;
    else alpha = 10 + (v / 98) * 80;
    lut.set([rgb[0], rgb[1], rgb[2], alpha], v * 4);
  }
  return lut;
}

const LAYERS = {
  global: {
    topic: GLOBAL_COSTMAP_TOPIC,
    label: 'Global costmap',
    palette: buildPalette(COLORS.globalCost, COLORS.globalFree),
  },
  local: {
    topic: LOCAL_COSTMAP_TOPIC,
    label: 'Local costmap',
    palette: buildPalette(COLORS.localCost, null),
  },
};

// Built-in arena zones (arena.js) in arena coordinates, with label anchors.
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

const styles = {
  container: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: COLORS.background },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' },
  buttons: { position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 },
  goalButtons: {
    position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
  },
  button: {
    padding: '3px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #666',
    background: 'rgba(0,0,0,0.6)', color: 'white', cursor: 'pointer',
  },
  buttonOff: { opacity: 0.45 },
  buttonDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  buttonArmed: { borderColor: COLORS.path, background: 'rgba(230, 92, 255, 0.25)' },
  status: {
    position: 'absolute', left: 8, bottom: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 6,
    color: 'white', padding: '3px 8px', fontSize: 12, pointerEvents: 'none',
  },
};

// --- Costmaps -------------------------------------------------------------

function createLayer() {
  return { canvas: document.createElement('canvas'), image: null, at: 0, noTf: false };
}

// int8[] arrives as an Int8Array with CBOR and as a number array with JSON.
function toInt8(data) {
  if (data instanceof Int8Array) return data;
  if (data instanceof Uint8Array) return new Int8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return Int8Array.from(data);
  if (typeof data === 'string') {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new Int8Array(bytes.buffer);
  }
  return null;
}

// Paints one OccupancyGrid into the layer's offscreen canvas, one pixel per
// cell, and keeps its placement. Returns false for a malformed message.
function paintLayer(layer, msg, palette) {
  const info = msg.info || {};
  const { width, height, resolution } = info;
  const data = toInt8(msg.data);
  if (!width || !height || !(resolution > 0) || !data || data.length < width * height) return false;
  if (!layer.image || layer.image.width !== width || layer.image.height !== height) {
    layer.canvas.width = width;
    layer.canvas.height = height;
    layer.image = new ImageData(width, height);
  }
  const px = layer.image.data;
  for (let c = 0; c < width * height; c++) {
    const v = data[c];
    const k = (v < 0 || v > 100 ? 101 : v) * 4;
    const p = c * 4;
    px[p] = palette[k]; px[p + 1] = palette[k + 1]; px[p + 2] = palette[k + 2]; px[p + 3] = palette[k + 3];
  }
  layer.canvas.getContext('2d').putImageData(layer.image, 0, 0);
  const origin = info.origin || {};
  const position = origin.position || {};
  layer.frame = cleanFrame(msg.header && msg.header.frame_id);
  layer.resolution = resolution;
  layer.width = width;
  layer.height = height;
  layer.originX = position.x || 0;
  layer.originY = position.y || 0;
  layer.originYaw = quaternionYaw(origin.orientation);
  layer.at = performance.now();
  return true;
}

// Draws a layer where TF places its frame. ctx must map world metres to the
// screen. Cell (i, j) covers origin + (i, j) cells, so the image goes in
// unflipped: the world transform already has y up.
function drawLayer(ctx, layer, tree) {
  if (!layer.at) return;
  const world = lookupInRobotWorld(tree, layer.frame);
  layer.noTf = !world;
  if (!world) return;
  const e = world.elements; // world_T_frame, its 2D part
  ctx.save();
  ctx.transform(e[0], e[1], e[4], e[5], e[12], e[13]);
  ctx.translate(layer.originX, layer.originY);
  ctx.rotate(layer.originYaw);
  ctx.scale(layer.resolution, layer.resolution);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

// --- Arena ------------------------------------------------------------------

function markerColor(c) {
  const { r = 1, g = 1, b = 1, a = 1 } = c || {};
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

// Applies a MarkerArray to `store` (ns:id -> simplified marker). Only the
// marker types the arena node publishes are kept; z is dropped.
function applyMarkers(store, msg) {
  for (const m of msg.markers || []) {
    if (m.action === MARKER_DELETEALL) { store.clear(); continue; }
    const key = `${m.ns}:${m.id}`;
    if (m.action === MARKER_DELETE) { store.delete(key); continue; }
    if (m.type !== MARKER_LINE_STRIP && m.type !== MARKER_LINE_LIST && m.type !== MARKER_TEXT) continue;
    const pose = m.pose || {};
    const position = pose.position || {};
    store.set(key, {
      type: m.type,
      frame: cleanFrame(m.header && m.header.frame_id) || MAP_FRAME,
      x: position.x || 0,
      y: position.y || 0,
      yaw: quaternionYaw(pose.orientation),
      points: (m.points || []).map((p) => [p.x, p.y]),
      width: (m.scale && m.scale.x) || 0,
      text: m.text || '',
      color: markerColor(m.color),
    });
  }
}

// Draws text centred at screen point (x, y) in CSS pixels, with a dark
// outline so it stays readable over the costmap. ctx must be in CSS pixels.
function drawLabel(ctx, text, x, y, color) {
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Draws the stored arena markers. Returns false, drawing nothing, when there
// are none or one of their frames cannot be placed (no map frame yet).
// Lines are at least 2 px wide; labels are drawn upright in screen space so
// they never appear mirrored or upside down when the view rotates.
function drawMarkers(ctx, k, dpr, markers, tree) {
  if (!markers.size) return false;
  const frames = new Map();
  for (const m of markers.values()) {
    if (frames.has(m.frame)) continue;
    const world = lookupInRobotWorld(tree, m.frame);
    if (!world) return false;
    frames.set(m.frame, world.elements);
  }
  const labels = [];
  for (const m of markers.values()) {
    const e = frames.get(m.frame);
    ctx.save();
    ctx.transform(e[0], e[1], e[4], e[5], e[12], e[13]);
    ctx.translate(m.x, m.y);
    ctx.rotate(m.yaw);
    if (m.type === MARKER_TEXT) {
      const p = ctx.getTransform().transformPoint(new DOMPoint(0, 0));
      labels.push({ text: m.text, color: m.color, x: p.x, y: p.y });
    } else if (m.points.length > 1) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = Math.max(m.width, (2 * dpr) / k);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (m.type === MARKER_LINE_STRIP) {
        m.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      } else {
        for (let i = 0; i + 1 < m.points.length; i += 2) {
          ctx.moveTo(m.points[i][0], m.points[i][1]);
          ctx.lineTo(m.points[i + 1][0], m.points[i + 1][1]);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const label of labels) drawLabel(ctx, label.text, label.x / dpr, label.y / dpr, label.color);
  ctx.restore();
  return true;
}

// Draws the built-in arena (arena.js), the fallback when /arena/markers is
// not published. ctx must already map world metres to the screen; k is
// device pixels per metre. anchored: the world is the AprilTag-anchored map
// frame, which is the arena frame itself; otherwise it is odom, which starts
// at the robot's starting pose.
function drawBuiltinArena(ctx, k, dpr, anchored) {
  ctx.save();
  if (!anchored) {
    // odom_T_arena = inverse(arena_T_start): rotate back by the start
    // heading, then shift so the start position sits at the odom origin.
    ctx.rotate(-ROBOT_START_IN_ARENA.yaw);
    ctx.translate(-ROBOT_START_IN_ARENA.x, -ROBOT_START_IN_ARENA.y);
  }
  const px = (n) => n / k; // n device pixels, in metres

  // Zone fills first, faint, so the costmap still shows through.
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
  for (const label of ZONE_LABELS) {
    const p = toScreen.transformPoint(new DOMPoint(label.x, label.y));
    drawLabel(ctx, label.text, p.x / dpr, p.y / dpr, label.color || COLORS.label);
  }
  ctx.restore();
}

// --- Path preview -------------------------------------------------------------

// Goal marker at (x, y) in the current world transform: a ring with an arrow
// along the goal heading. px converts CSS pixels to metres so the marker keeps
// its size on screen at any zoom.
function drawGoalMarker(ctx, px, x, y, yaw, color, dashed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(yaw);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shape = () => {
    ctx.beginPath();
    ctx.arc(0, 0, px(7), 0, 2 * Math.PI);
    ctx.moveTo(px(7), 0);
    ctx.lineTo(px(24), 0);
    ctx.moveTo(px(18), px(5));
    ctx.lineTo(px(24), 0);
    ctx.lineTo(px(18), -px(5));
  };
  ctx.strokeStyle = COLORS.pathCasing;
  ctx.lineWidth = px(5);
  shape();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = px(2.5);
  if (dashed) ctx.setLineDash([px(4), px(3)]);
  shape();
  ctx.stroke();
  ctx.restore();
}

// Draws the planned path (in its own frame, placed by TF) and the goal.
// Reversing stretches are dashed. Nothing is drawn for a frame that cannot be
// placed in the robot's world.
function drawPlan(ctx, k, dpr, plan, tree) {
  const px = (n) => (n * dpr) / k;
  const { path, goal } = plan;
  if (path && path.points.length > 1) {
    const world = lookupInRobotWorld(tree, path.frame || MAP_FRAME);
    if (world) {
      const e = world.elements;
      ctx.save();
      ctx.transform(e[0], e[1], e[4], e[5], e[12], e[13]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = COLORS.pathCasing;
      ctx.lineWidth = px(6);
      ctx.beginPath();
      path.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth = px(3);
      for (const run of path.runs) {
        ctx.setLineDash(run.reverse ? [px(7), px(5)] : []);
        ctx.beginPath();
        run.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (goal) {
    const world = lookupInRobotWorld(tree, goal.frame);
    if (world) {
      const e = world.elements;
      ctx.save();
      ctx.transform(e[0], e[1], e[4], e[5], e[12], e[13]);
      const color = plan.status === 'failed' ? COLORS.goalFailed : COLORS.path;
      drawGoalMarker(ctx, px, goal.x, goal.y, goal.yaw, color, plan.status === 'planning');
      ctx.restore();
    }
  }
}

function planStatusLine(plan) {
  switch (plan.status) {
    case 'planning':
      return 'Planning a path\u2026';
    case 'succeeded': {
      const reverse = plan.path.hasReverse ? '; dashed = reversing' : '';
      return `Path: ${plan.path.length.toFixed(1)} m, planned in ${plan.planningTime.toFixed(2)} s${reverse}`;
    }
    case 'failed':
      return plan.error;
    default:
      return null;
  }
}

// A drag shorter than this (CSS px) is a plain click: the goal faces away
// from the robot instead of along the drag.
const HEADING_DRAG_PX = 10;

const ARENA_NOTES = {
  builtin: `Arena: built-in layout (no ${ARENA_MARKERS_TOPIC})`,
  start: 'No map frame: arena placed from start pose',
};

// --- Panel ------------------------------------------------------------------

export default function MiniMapPanel({
  ros, isConnected, directionSwitched = false, frontActuatorPosition, backActuatorPosition,
}) {
  // Read by the render loop every frame.
  const directionRef = useRef(directionSwitched);
  directionRef.current = directionSwitched;
  // Drawn length follows the drum arms (robotFootprint: shortest when raised).
  const footprintRef = useRef(null);
  footprintRef.current = robotFootprint(frontActuatorPosition, backActuatorPosition);
  const canvasRef = useRef(null);
  const layersRef = useRef(null);
  if (!layersRef.current) layersRef.current = { global: createLayer(), local: createLayer() };
  const markersRef = useRef(new Map());
  const tfTreeRef = useTfTree(ros, isConnected);

  // Path preview. The render loop and pointer handlers read these refs.
  const { plan, requestPlan, clearPlan } = usePlanPath(ros);
  const planRef = useRef(plan);
  planRef.current = plan;
  const requestPlanRef = useRef(requestPlan);
  requestPlanRef.current = requestPlan;
  const [picking, setPicking] = useState(false);
  const [mapReady, setMapReady] = useState(false); // robot pose resolves to the map frame
  const [pickNote, setPickNote] = useState(null);

  // View state lives in a ref so the render loop and pointer handlers share it
  // without re-rendering; React state only mirrors what the buttons show.
  const viewRef = useRef({
    scale: DEFAULT_SCALE, userZoomed: false, headingUp: true, pan: null,
    showArena: true, showGlobal: true, showLocal: true, picking: false, pick: null,
  });
  const [headingUp, setHeadingUp] = useState(true);
  const [showArena, setShowArena] = useState(true);
  const [showGlobal, setShowGlobal] = useState(true);
  const [showLocal, setShowLocal] = useState(true);
  const [panned, setPanned] = useState(false);
  const [status, setStatus] = useState('Not connected to rosbridge'); // lines joined by \n
  const [arenaMode, setArenaMode] = useState(null); // 'markers', 'builtin', 'start' or null (hidden)

  // Subscriptions: recreated on every rosbridge (re)connect.
  useEffect(() => {
    if (!ros || !isConnected) {
      setStatus('Not connected to rosbridge');
      return undefined;
    }
    const layers = layersRef.current;
    const subscriptions = [];
    const subscribe = (options, callback) => {
      const topic = new Topic({ ros, queue_length: 1, reconnect_on_close: false, ...options });
      topic.subscribe(callback);
      subscriptions.push([topic, callback]);
      return topic;
    };

    // Costmaps: CBOR sends the int8 cells as raw bytes instead of JSON text.
    for (const [name, def] of Object.entries(LAYERS)) {
      subscribe(
        { name: def.topic, messageType: OCCUPANCY_GRID_TYPE, compression: 'cbor' },
        (msg) => paintLayer(layers[name], msg, def.palette),
      );
    }

    // Arena markers: republished every second but fixed for a run, so the
    // first non-empty message is kept and the subscription dropped.
    let markersSeen = false;
    const onMarkers = (msg) => {
      if (markersSeen) return;
      const store = markersRef.current;
      store.clear(); // replaces whatever an earlier connection left
      applyMarkers(store, msg);
      if (store.size) {
        markersSeen = true;
        markerTopic.unsubscribe(onMarkers);
      }
    };
    const markerTopic = subscribe({ name: ARENA_MARKERS_TOPIC, messageType: MARKER_ARRAY_TYPE }, onMarkers);

    const update = () => {
      const view = viewRef.current;
      const now = performance.now();
      const lines = [];
      if (!layers.global.at && !layers.local.at) {
        lines.push('Waiting for Nav2 costmaps');
      } else {
        for (const [name, def] of Object.entries(LAYERS)) {
          const layer = layers[name];
          if (!(name === 'global' ? view.showGlobal : view.showLocal)) continue;
          if (!layer.at) lines.push(`Waiting for ${def.topic}`);
          else if (now - layer.at > STALE_MS) lines.push(`${def.label}: no update for over ${STALE_MS / 1000} s`);
          else if (layer.noTf) lines.push(`${def.label}: no transform for ${layer.frame || '(none)'}`);
        }
      }
      const text = lines.join('\n');
      setStatus((prev) => (prev === text ? prev : text));
    };
    update();
    const timer = setInterval(update, STATUS_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      subscriptions.forEach(([topic, callback]) => topic.unsubscribe(callback));
    };
  }, [ros, isConnected]);

  // Canvas, render loop and pointer handling.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const view = viewRef.current;
    const layers = layersRef.current;
    let robotX = 0;
    let robotY = 0;
    let robotYaw = 0;
    let viewYaw = Math.PI / 2;
    let lastAnchored = true;
    let lastArenaMode = null;
    let lastMapReady = false;
    let worldRoot = null;          // frame the minimap's world is, from the robot pose
    let screenFromWorld = new DOMMatrix(); // world metres -> canvas device pixels

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
      const tree = tfTreeRef.current;
      const pose = lookupRobotPose(tree);
      if (pose) {
        const e = pose.matrix.elements;
        robotX = e[12]; robotY = e[13]; robotYaw = yawOf(pose.matrix);
      }
      worldRoot = pose ? pose.root : null;
      const ready = worldRoot === MAP_FRAME;
      if (ready !== lastMapReady) {
        lastMapReady = ready;
        setMapReady(ready);
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
      screenFromWorld = ctx.getTransform();

      if (view.showGlobal) drawLayer(ctx, layers.global, tree);
      if (view.showLocal) drawLayer(ctx, layers.local, tree);

      // Arena: the robot's markers when they can be placed, else the
      // built-in layout. No pose yet: keep the last known placement.
      let mode = null;
      if (view.showArena) {
        if (drawMarkers(ctx, k, dpr, markersRef.current, tree)) {
          mode = 'markers';
        } else {
          if (pose) lastAnchored = pose.root === MAP_FRAME;
          drawBuiltinArena(ctx, k, dpr, lastAnchored);
          mode = lastAnchored ? 'builtin' : 'start';
        }
      }
      if (mode !== lastArenaMode) {
        lastArenaMode = mode;
        setArenaMode(mode);
      }

      // Planned path and goal, then the goal being picked on top.
      drawPlan(ctx, k, dpr, planRef.current, tree);
      if (view.pick) {
        drawGoalMarker(ctx, (n) => (n * dpr) / k, view.pick.x, view.pick.y,
          view.pick.yaw ?? Math.atan2(view.pick.y - robotY, view.pick.x - robotX), COLORS.path, true);
      }

      // Robot: outline box plus a nose triangle at the front.
      ctx.save();
      ctx.translate(robotX, robotY);
      ctx.rotate(robotYaw);
      ctx.globalAlpha = pose ? 0.9 : 0.35;
      const { front, rear, length } = footprintRef.current;
      ctx.fillStyle = COLORS.robot;
      ctx.fillRect(-rear, -ROBOT_WIDTH / 2, length, ROBOT_WIDTH);
      ctx.lineWidth = 2 / k;
      ctx.strokeStyle = COLORS.robotEdge;
      ctx.strokeRect(-rear, -ROBOT_WIDTH / 2, length, ROBOT_WIDTH);
      // Arrow on the driving end: mirrored to the rear when switched.
      const end = directionRef.current ? -1 : 1;
      const endX = directionRef.current ? -rear : front;
      ctx.fillStyle = COLORS.nose;
      ctx.beginPath();
      ctx.moveTo(endX + end * 0.35, 0);
      ctx.lineTo(endX, ROBOT_WIDTH * 0.3);
      ctx.lineTo(endX, -ROBOT_WIDTH * 0.3);
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

    // Pointer position -> world metres, through the last drawn frame's view.
    const toWorld = (event) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const p = screenFromWorld.inverse().transformPoint(
        new DOMPoint((event.clientX - rect.left) * dpr, (event.clientY - rect.top) * dpr));
      return { x: p.x, y: p.y };
    };

    // Goal picking: pointer down places the goal, dragging sets its heading,
    // pointer up sends it to the planner and disarms picking.
    let lastPickAt = 0;
    const finishPick = (event) => {
      const pick = view.pick;
      view.pick = null;
      view.picking = false;
      setPicking(false);
      canvas.style.cursor = 'grab';
      lastPickAt = performance.now();
      if (!pick || !event) return;
      if (worldRoot !== MAP_FRAME) {
        setPickNote('Goal not sent: no map frame (is RTAB-Map running?)');
        return;
      }
      const yaw = pick.yaw ?? Math.atan2(pick.y - robotY, pick.x - robotX);
      setPickNote(null);
      requestPlanRef.current({ frame: MAP_FRAME, x: pick.x, y: pick.y, yaw });
    };

    // Drag to pan: screen movement converted to world movement for the
    // current zoom and rotation, so the map follows the pointer.
    let dragging = null;
    const onPointerDown = (event) => {
      canvas.setPointerCapture(event.pointerId);
      if (view.picking) {
        const p = toWorld(event);
        view.pick = { ...p, yaw: null, clientX: event.clientX, clientY: event.clientY };
        return;
      }
      dragging = { x: event.clientX, y: event.clientY };
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event) => {
      if (view.pick) {
        const moved = Math.hypot(event.clientX - view.pick.clientX, event.clientY - view.pick.clientY);
        if (moved >= HEADING_DRAG_PX) {
          const p = toWorld(event);
          view.pick.yaw = Math.atan2(p.y - view.pick.y, p.x - view.pick.x);
        }
        return;
      }
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
    const onPointerUp = (event) => {
      if (view.pick) {
        finishPick(event.type === 'pointerup' ? event : null);
        return;
      }
      dragging = null;
      canvas.style.cursor = view.picking ? 'crosshair' : 'grab';
    };
    const onWheel = (event) => {
      event.preventDefault();
      view.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * Math.exp(-event.deltaY * 0.001)));
      view.userZoomed = true;
    };
    const onDoubleClick = () => {
      // The second click of a double-click right after a pick is not a reset.
      if (view.picking || performance.now() - lastPickAt < 500) return;
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

  // Esc disarms picking; the cursor shows when it is armed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = picking ? 'crosshair' : 'grab';
    if (!picking) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      viewRef.current.picking = false;
      viewRef.current.pick = null;
      setPicking(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  // Losing the connection or the map frame disarms picking.
  const canPick = Boolean(isConnected) && mapReady;
  useEffect(() => {
    if (canPick || !viewRef.current.picking) return;
    viewRef.current.picking = false;
    viewRef.current.pick = null;
    setPicking(false);
  }, [canPick]);

  const togglePicking = () => {
    const next = !viewRef.current.picking;
    viewRef.current.picking = next;
    viewRef.current.pick = null;
    setPicking(next);
    setPickNote(null);
  };
  const clearGoal = () => {
    clearPlan();
    setPickNote(null);
  };

  const toggle = (key, setter) => () => {
    viewRef.current[key] = !viewRef.current[key];
    setter(viewRef.current[key]);
  };
  const recenter = () => {
    viewRef.current.pan = null;
    setPanned(false);
  };
  const layerButton = (label, on, onClick, title) => (
    <button type="button" style={on ? styles.button : { ...styles.button, ...styles.buttonOff }}
      onClick={onClick} title={title}>
      {label}
    </button>
  );

  const lines = status ? status.split('\n') : [];
  if (ARENA_NOTES[arenaMode]) lines.push(ARENA_NOTES[arenaMode]);
  if (picking) lines.push('Click to place the goal, drag to aim it. Esc cancels.');
  else if (pickNote) lines.push(pickNote);
  else if (planStatusLine(plan)) lines.push(planStatusLine(plan));

  let goalTitle = 'Pick a goal on the map and preview the path Nav2 plans to it';
  if (!isConnected) goalTitle = 'Connect to rosbridge to set a goal';
  else if (!mapReady) goalTitle = 'Needs the map frame: start RTAB-Map and Nav2 on the robot';

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={styles.goalButtons}>
        <button type="button" disabled={!canPick && !picking} title={goalTitle} onClick={togglePicking}
          style={{
            ...styles.button,
            whiteSpace: 'nowrap',
            ...(picking ? styles.buttonArmed : null),
            ...(!canPick && !picking ? styles.buttonDisabled : null),
          }}>
          {picking ? 'Cancel goal' : 'Set goal'}
        </button>
        {!picking && plan.status !== 'idle' && (
          <button type="button" style={{ ...styles.button, whiteSpace: 'nowrap' }} onClick={clearGoal}>Clear goal</button>
        )}
      </div>
      <div style={styles.buttons}>
        {panned && <button type="button" style={styles.button} onClick={recenter}>Recenter</button>}
        <button type="button" style={styles.button} onClick={toggle('headingUp', setHeadingUp)}>
          {headingUp ? 'Heading up' : 'Map up'}
        </button>
        {layerButton('Global', showGlobal, toggle('showGlobal', setShowGlobal), 'Global costmap: the whole mapped arena')}
        {layerButton('Local', showLocal, toggle('showLocal', setShowLocal), 'Local costmap: live camera obstacles near the robot')}
        {layerButton('Arena', showArena, toggle('showArena', setShowArena), 'Arena zones')}
      </div>
      {lines.length > 0 && (
        <div style={styles.status}>
          {lines.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
