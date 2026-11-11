import {
  computePathGoal, describePlanFailure, durationSeconds, parsePath, quaternionYaw, yawToQuaternion,
} from './navPath';

const pose = (x, y, yaw) => ({ pose: { position: { x, y, z: 0 }, orientation: yawToQuaternion(yaw) } });

describe('yaw conversions', () => {
  it('round-trips a yaw through a quaternion', () => {
    for (const yaw of [0, 0.5, -1.2, 3]) expect(quaternionYaw(yawToQuaternion(yaw))).toBeCloseTo(yaw, 9);
  });
});

describe('computePathGoal', () => {
  it('builds a goal in the given frame that starts from the robot pose', () => {
    const goal = computePathGoal({ frame: 'map', x: 2, y: -1, yaw: Math.PI / 2 });
    expect(goal.goal.header.frame_id).toBe('map');
    expect(goal.goal.pose.position).toEqual({ x: 2, y: -1, z: 0 });
    expect(quaternionYaw(goal.goal.pose.orientation)).toBeCloseTo(Math.PI / 2, 9);
    expect(goal.use_start).toBe(false);
    expect(goal.planner_id).toBe('');
  });
});

describe('parsePath', () => {
  it('measures a forward path as one run', () => {
    const path = parsePath({
      header: { frame_id: '/map' },
      poses: [pose(0, 0, 0), pose(1, 0, 0), pose(1, 1, Math.PI / 2)],
    });
    expect(path.frame).toBe('map');
    expect(path.length).toBeCloseTo(2, 9);
    expect(path.runs).toHaveLength(1);
    expect(path.hasReverse).toBe(false);
  });

  it('splits reversing stretches into their own runs', () => {
    // Facing +x the whole way, but backing up from x=2 to x=1.
    const path = parsePath({
      header: { frame_id: 'map' },
      poses: [pose(0, 0, 0), pose(1, 0, 0), pose(2, 0, 0), pose(1.5, 0, 0), pose(1, 0, 0)],
    });
    expect(path.runs.map((r) => r.reverse)).toEqual([false, true]);
    expect(path.runs[0].points).toHaveLength(3);
    expect(path.runs[1].points[0]).toEqual(path.runs[0].points[2]); // shared joint
    expect(path.hasReverse).toBe(true);
    expect(path.length).toBeCloseTo(3, 9);
  });

  it('handles a missing or empty path', () => {
    expect(parsePath(undefined)).toMatchObject({ points: [], runs: [], length: 0 });
  });
});

describe('describePlanFailure', () => {
  it('reads the planner error code and message out of roslib\'s error text', () => {
    const json = JSON.stringify({ path: {}, error_code: 206, error_msg: 'Goal Coordinates of(2, 3) was in lethal cost' });
    const failure = describePlanFailure(`GoalError: Action was aborted: ${json}`);
    expect(failure.code).toBe(206);
    expect(failure.message).toBe('Goal is in an occupied cell: Goal Coordinates of(2, 3) was in lethal cost');
  });

  it('keeps rosbridge\'s own error text when the planner never answered', () => {
    const message = 'GoalError: Action failed with status undefined: Unable to import nav2_msgs.action '
      + "from package nav2_msgs. Caused by: No module named 'nav2_msgs'";
    expect(describePlanFailure(message).message).toBe(
      "Planning failed: Unable to import nav2_msgs.action from package nav2_msgs. Caused by: No module named 'nav2_msgs'");
  });

  it('falls back to generic text without any detail', () => {
    expect(describePlanFailure('GoalError: Action was canceled').message).toBe('Planning canceled');
    expect(describePlanFailure('GoalError: Action was aborted').message).toBe('Planning failed');
    expect(describePlanFailure('').message).toBe('Planning failed');
  });
});

describe('durationSeconds', () => {
  it('adds seconds and nanoseconds', () => {
    expect(durationSeconds({ sec: 1, nanosec: 250000000 })).toBeCloseTo(1.25, 9);
    expect(durationSeconds(null)).toBe(0);
  });
});
