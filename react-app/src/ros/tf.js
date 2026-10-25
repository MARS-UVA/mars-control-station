import { useEffect, useRef } from 'react';
import { Topic } from 'roslib';
import * as THREE from 'three';

/**
 * Minimal TF for the dashboard: keeps the latest transform per child frame
 * from /tf and /tf_static, and walks the tree up to the map frame on demand.
 * No time travel and no interpolation; every lookup uses the newest data.
 *
 * Used by PointCloudPanel and MiniMapPanel; each hook call holds its own
 * subscriptions.
 */

export const MAP_FRAME = 'map';
export const ROBOT_FRAME = 'base_link';
const TF_TOPIC = '/tf';
const TF_STATIC_TOPIC = '/tf_static';
const MAX_TF_DEPTH = 10; // guards against a cycle in a malformed tree

export function cleanFrame(id) {
  return (id || '').replace(/^\/+/, '');
}

// Pose of `start` in MAP_FRAME, walking up the tree. Stops early at whatever
// root it reaches (normally odom when RTAB-Map is not running). Returns
// { matrix, root }; root === start means nothing was known about `start`.
export function lookupTransform(tree, start) {
  const matrix = new THREE.Matrix4();
  let frame = start;
  for (let i = 0; i < MAX_TF_DEPTH && frame !== MAP_FRAME; i++) {
    const link = tree.get(frame);
    if (!link) break;
    matrix.premultiply(link.matrix); // parent_T_start = parent_T_frame * frame_T_start
    frame = link.parent;
  }
  return { matrix, root: frame };
}

/** base_link in the map (or the root it reaches), or null if unknown. */
export function lookupRobotPose(tree) {
  const pose = lookupTransform(tree, ROBOT_FRAME);
  return pose.root === ROBOT_FRAME ? null : pose;
}

/**
 * world_T_frame for data stamped in `frame`, where "world" is the root the
 * robot pose resolves to. Returns null when the frame cannot be connected to
 * the robot's world, so data is never drawn in the wrong place.
 */
export function lookupInRobotWorld(tree, frame) {
  const placement = lookupTransform(tree, frame);
  const robotPose = lookupRobotPose(tree);
  const ok = frame === placement.root
    ? placement.root === MAP_FRAME || !robotPose // data already in the world frame
    : Boolean(robotPose) && placement.root === robotPose.root;
  return ok ? placement.matrix : null;
}

/** Yaw (rad, about +z) of a pose matrix's x axis. */
export function yawOf(matrix) {
  const e = matrix.elements; // column 0 is the x axis
  return Math.atan2(e[1], e[0]);
}

/**
 * Subscribes to /tf and /tf_static while connected. Returns a ref whose
 * .current is the Map child -> { parent, matrix }; read it with the helpers
 * above. It is cleared on every (re)connect. /tf is not throttled: map -> odom
 * and odom -> base_link arrive in separate messages, and a throttle could keep
 * dropping one of them. /tf_static is latched; rosbridge matches its QoS.
 */
export default function useTfTree(ros, isConnected) {
  const treeRef = useRef(new Map());

  useEffect(() => {
    const tree = treeRef.current;
    tree.clear();
    if (!ros || !isConnected) return undefined;

    const translation = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const onTf = (msg) => {
      for (const t of msg.transforms || []) {
        const child = cleanFrame(t.child_frame_id);
        const parent = cleanFrame(t.header && t.header.frame_id);
        if (!child || !parent) continue;
        const { translation: p, rotation: q } = t.transform;
        translation.set(p.x, p.y, p.z);
        rotation.set(q.x, q.y, q.z, q.w);
        const entry = tree.get(child) || { parent, matrix: new THREE.Matrix4() };
        entry.parent = parent;
        entry.matrix.compose(translation, rotation, one);
        tree.set(child, entry);
      }
    };

    const topics = [TF_TOPIC, TF_STATIC_TOPIC].map((name) => {
      const topic = new Topic({
        ros,
        name,
        messageType: 'tf2_msgs/msg/TFMessage',
        queue_length: 5,
        reconnect_on_close: false, // this effect owns re-subscription
      });
      topic.subscribe(onTf);
      return topic;
    });

    return () => {
      topics.forEach((topic) => topic.unsubscribe(onTf));
      tree.clear();
    };
  }, [ros, isConnected]);

  return treeRef;
}
