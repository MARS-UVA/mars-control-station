import { useCallback, useEffect, useRef, useState } from 'react';
import { Action } from 'roslib';
import {
  COMPUTE_PATH_ACTION, COMPUTE_PATH_TYPE, computePathGoal, describePlanFailure,
  durationSeconds, parsePath,
} from '../ros/navPath';

// The planner gives up after max_planning_time (2 s on the Jetson); this only
// catches a planner_server that is not running or not reachable.
const PLAN_TIMEOUT_MS = 10000;

const IDLE = Object.freeze({ status: 'idle', goal: null, path: null, planningTime: null, error: null });

/**
 * Asks Nav2's planner_server for a path to a goal pose through
 * /compute_path_to_pose (nav2_msgs/action/ComputePathToPose). This previews
 * the route only: it does not send a navigation goal and the robot does not
 * move.
 *
 * plan.status: 'idle' | 'planning' | 'succeeded' | 'failed'.
 * plan.goal: { frame, x, y, yaw } as requested. plan.path: parsePath() output.
 *
 * Only the latest request counts: a new request cancels the one in flight and
 * ignores its outcome. Disconnecting marks an in-flight request failed.
 */
export default function usePlanPath(ros) {
  const [plan, setPlan] = useState(IDLE);
  const actionRef = useRef(null);
  const goalIdRef = useRef(null);
  const timerRef = useRef(null);

  // Forgets the in-flight request, optionally asking the planner to cancel it.
  const release = useCallback((cancel) => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const id = goalIdRef.current;
    goalIdRef.current = null;
    if (!id || !ros) return;
    if (cancel && ros.isConnected) actionRef.current?.cancelGoal(id);
    ros.removeAllListeners(id);
  }, [ros]);

  useEffect(() => {
    if (!ros) return undefined;
    actionRef.current = new Action({ ros, name: COMPUTE_PATH_ACTION, actionType: COMPUTE_PATH_TYPE });

    const onClose = () => {
      if (!goalIdRef.current) return;
      release(false);
      setPlan((prev) => ({ ...prev, status: 'failed', error: 'Connection lost while planning' }));
    };
    ros.on('close', onClose);

    return () => {
      ros.off('close', onClose);
      release(true);
      actionRef.current = null;
    };
  }, [ros, release]);

  /** Requests a path to goal = { frame, x, y, yaw }. Returns false if not sent. */
  const requestPlan = useCallback((goal) => {
    release(true);
    const action = actionRef.current;
    if (!action || !ros || !ros.isConnected) {
      setPlan({ ...IDLE, status: 'failed', goal, error: 'Not sent: rosbridge is disconnected' });
      return false;
    }

    let id = null;
    const isCurrent = () => id !== null && goalIdRef.current === id;

    const onResult = (result) => {
      if (!isCurrent()) return;
      release(false);
      const path = parsePath(result && result.path);
      if (path.points.length < 2) {
        setPlan({ ...IDLE, status: 'failed', goal, error: 'Planner returned an empty path' });
        return;
      }
      setPlan({
        status: 'succeeded', goal, path, planningTime: durationSeconds(result.planning_time), error: null,
      });
    };

    const onFailed = (message) => {
      if (!isCurrent()) return;
      release(false);
      setPlan({ ...IDLE, status: 'failed', goal, error: describePlanFailure(message).message });
    };

    setPlan({ ...IDLE, status: 'planning', goal });
    id = action.sendGoal(computePathGoal(goal), onResult, undefined, onFailed) ?? null;
    goalIdRef.current = id;
    if (id !== null) {
      timerRef.current = setTimeout(() => {
        if (!isCurrent()) return;
        release(true);
        setPlan({
          ...IDLE,
          status: 'failed',
          goal,
          error: `No answer from ${COMPUTE_PATH_ACTION} in ${PLAN_TIMEOUT_MS / 1000} s: is Nav2 running?`,
        });
      }, PLAN_TIMEOUT_MS);
    }
    return id !== null;
  }, [ros, release]);

  /** Drops the goal and path, canceling a request still in flight. */
  const clearPlan = useCallback(() => {
    release(true);
    setPlan(IDLE);
  }, [release]);

  return { plan, requestPlan, clearPlan };
}
