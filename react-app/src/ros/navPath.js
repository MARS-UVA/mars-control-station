/**
 * Helpers for previewing a Nav2 path from the dashboard: building a
 * nav2_msgs/action/ComputePathToPose goal and reading its result.
 *
 * The action is served by Nav2's planner_server on the Jetson
 * (mars-jetson robot_navigation/config/planner.yaml: Smac Hybrid-A* with
 * Reeds-Shepp motion, so paths can contain reversing segments). It only plans;
 * nothing here makes the robot move.
 *
 * Kept free of roslib and three so it can be unit tested on its own.
 */

export const COMPUTE_PATH_ACTION = '/compute_path_to_pose';
export const COMPUTE_PATH_TYPE = 'nav2_msgs/action/ComputePathToPose';

// ComputePathToPose result error codes (nav2_msgs, Jazzy).
export const PLANNER_ERRORS = Object.freeze({
  200: 'Unknown planner error',
  201: 'Invalid planner',
  202: 'Transform error: is the map frame being published?',
  203: 'Robot is outside the map',
  204: 'Goal is outside the map',
  205: 'Robot is in an occupied cell',
  206: 'Goal is in an occupied cell',
  207: 'Planner timed out',
  208: 'No valid path to the goal',
});

function cleanFrame(id) {
  return (id || '').replace(/^\/+/, '');
}

/** Yaw (rad, about +z) of a geometry_msgs/Quaternion. */
export function quaternionYaw(q) {
  const { x = 0, y = 0, z = 0, w = 1 } = q || {};
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

/** geometry_msgs/Quaternion for a rotation of `yaw` rad about +z. */
export function yawToQuaternion(yaw) {
  return { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
}

/**
 * geometry_msgs/PoseStamped in `frame`. A zero stamp tells Nav2 to use the
 * latest transform rather than one at a particular time.
 */
export function poseStamped(frame, x, y, yaw) {
  return {
    header: { frame_id: frame, stamp: { sec: 0, nanosec: 0 } },
    pose: { position: { x, y, z: 0 }, orientation: yawToQuaternion(yaw) },
  };
}

/**
 * ComputePathToPose goal from the robot's current pose to `goal`
 * ({ frame, x, y, yaw }). use_start: false makes the planner start from the
 * robot's pose, so `start` is only a well-formed placeholder. An empty
 * planner_id selects the planner server's only plugin (GridBased).
 */
export function computePathGoal(goal) {
  return {
    goal: poseStamped(goal.frame, goal.x, goal.y, goal.yaw),
    start: poseStamped(goal.frame, 0, 0, 0),
    planner_id: '',
    use_start: false,
  };
}

/** builtin_interfaces/Duration in seconds. */
export function durationSeconds(d) {
  return ((d && d.sec) || 0) + ((d && d.nanosec) || 0) / 1e9;
}

/**
 * Reads a nav_msgs/Path into { frame, points, length, runs, hasReverse }.
 * points: [{ x, y, yaw }]. runs: consecutive stretches driven in the same
 * direction, [{ reverse, points }], sharing their boundary point so they draw
 * as one line. A segment is reversing when it moves against the pose's
 * heading, which is how Hybrid-A* encodes Reeds-Shepp reversals.
 */
export function parsePath(path) {
  const frame = cleanFrame(path && path.header && path.header.frame_id);
  const points = ((path && path.poses) || []).map((p) => {
    const pose = (p && p.pose) || {};
    const position = pose.position || {};
    return { x: position.x || 0, y: position.y || 0, yaw: quaternionYaw(pose.orientation) };
  });

  let length = 0;
  const runs = [];
  let current = null;
  let reverse = false;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const step = Math.hypot(dx, dy);
    length += step;
    // Zero-length steps keep the previous direction.
    if (step > 1e-6) reverse = dx * Math.cos(a.yaw) + dy * Math.sin(a.yaw) < 0;
    if (!current || current.reverse !== reverse) {
      current = { reverse, points: [a] };
      runs.push(current);
    }
    current.points.push(b);
  }

  return { frame, points, length, runs, hasReverse: runs.some((r) => r.reverse) };
}

/**
 * Turns roslib's failure message for a ComputePathToPose goal into something
 * an operator can act on. roslib reports a non-success result as
 * "GoalError: Action was aborted: {...result json...}", so the planner's
 * error_code and error_msg are read back out of that JSON when present.
 */
export function describePlanFailure(message) {
  const raw = String(message || '');
  const canceled = /canceled/i.test(raw);
  let code = null;
  let detail = '';
  const json = raw.match(/(\{[\s\S]*\})\s*$/);
  if (json) {
    try {
      const values = JSON.parse(json[1]);
      code = Number(values.error_code) || null;
      detail = typeof values.error_msg === 'string' ? values.error_msg.trim() : '';
    } catch (e) {
      // Not JSON after all; fall back to the generic text below.
    }
  }
  // Without a planner error code the failure came from rosbridge itself
  // (it could not load the action type, reach the server, ...): its own words
  // are the only useful detail, minus roslib's prefixes.
  if (!code && !json && !canceled) {
    detail = raw
      .replace(/^GoalError:\s*/, '')
      .replace(/^Action (failed with status \w+|was aborted|status unknown)(:\s*|$)/, '')
      .trim();
  }
  let text;
  if (code && PLANNER_ERRORS[code]) text = PLANNER_ERRORS[code];
  else if (code) text = `Planning failed (error ${code})`;
  else if (canceled) text = 'Planning canceled';
  else text = 'Planning failed';
  if (detail && detail !== text) text = `${text}: ${detail}`;
  return { canceled, code, message: text, raw };
}
