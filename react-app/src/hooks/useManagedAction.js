import { useCallback, useEffect, useRef, useState } from 'react';
import { Action } from 'roslib';

export const OPERATIONS = Object.freeze({ navigate: 0, dig: 1, dump: 2, full_auto: 3 });

export function makeManagedGoal(operation, { routineIndex = 0, timeLimit = 600, target } = {}) {
  if (!(operation in OPERATIONS) || !Number.isFinite(timeLimit) || timeLimit <= 0) {
    throw new Error('Select an operation and a positive, finite time limit');
  }
  if (!Number.isInteger(routineIndex) || routineIndex < 0) {
    throw new Error('Routine index must be a nonnegative integer');
  }
  const pose = {
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'map' },
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  };
  if (operation === 'navigate') {
    if (!target || ![target.x, target.y, target.yaw].every(Number.isFinite)
        || !target.frame?.trim()) throw new Error('Navigation needs a frame and finite X, Y, and yaw');
    pose.header.frame_id = target.frame.trim();
    pose.pose.position = { x: target.x, y: target.y, z: 0 };
    pose.pose.orientation = { x: 0, y: 0, z: Math.sin(target.yaw / 2), w: Math.cos(target.yaw / 2) };
  }
  return { operation: OPERATIONS[operation], routine_index: routineIndex,
    time_limit_sec: timeLimit, target_pose: pose };
}

/** Own one manager goal. Never queue replacements or replay after reconnect. */
export default function useManagedAction(ros) {
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const actionRef = useRef(null);
  const activeRef = useRef(null);
  const unknownRef = useRef(false);

  useEffect(() => {
    if (!ros) return undefined;
    const action = new Action({ ros, name: '/manage_robot', actionType: 'autonomy_msgs/action/ManageRobot' });
    actionRef.current = action;
    const onClose = () => {
      if (!activeRef.current) return;
      ros.removeAllListeners(activeRef.current.id);
      activeRef.current = null;
      unknownRef.current = true;
      setFeedback(null);
      setStatus('unknown');
      setError('Connection lost; operation outcome unknown. Stop and clear E-stop before starting new work.');
    };
    ros.on('close', onClose);
    return () => {
      ros.off('close', onClose);
      if (activeRef.current) ros.removeAllListeners(activeRef.current.id);
      activeRef.current = null;
      actionRef.current = null;
    };
  }, [ros]);

  const cancelGoal = useCallback(() => {
    const active = activeRef.current;
    const action = actionRef.current;
    if (!active || !action?.ros.isConnected) return false;
    action.cancelGoal(active.id);
    setStatus('canceling');
    return true;
  }, []);

  const sendGoal = useCallback((operation, options) => {
    const action = actionRef.current;
    if (!action?.ros.isConnected) {
      setError('Operation not sent: rosbridge disconnected');
      return false;
    }
    if (unknownRef.current) {
      setError('Previous outcome unknown. Stop and clear E-stop before starting new work.');
      return false;
    }
    if (activeRef.current) {
      if (activeRef.current.operation === operation) return cancelGoal();
      setError('Another operation is active. Cancel it, wait for completion, then clear E-stop.');
      return false;
    }
    let goal;
    try { goal = makeManagedGoal(operation, options); }
    catch (err) { setError(err.message); return false; }
    setFeedback(null);
    setResult(null);
    setError(null);
    setStatus('active');
    let id;
    const current = () => activeRef.current?.id === id;
    const settle = () => {
      if (!current()) return false;
      action.ros.removeAllListeners(id);
      activeRef.current = null;
      return true;
    };
    try {
      id = action.sendGoal(goal, response => {
        if (!settle()) return;
        setResult(response);
        setStatus(response.success ? 'succeeded' : 'aborted');
        if (!response.success) setError(response.outcome || 'Operation failed');
      }, next => {
        if (current()) setFeedback(next);
      }, message => {
        if (!settle()) return;
        const text = String(message);
        setError(text);
        setStatus(/cancel/i.test(text) ? 'canceled' : /reject/i.test(text) ? 'rejected' : 'aborted');
      });
      if (!id) {
        setStatus('idle');
        setError('Operation was not sent');
        return false;
      }
      activeRef.current = { id, operation };
      return true;
    } catch (err) {
      unknownRef.current = true;
      setStatus('unknown');
      setError(`Send failed; outcome unknown: ${err.message}`);
      return false;
    }
  }, [cancelGoal]);

  // Only call after the manager acknowledges clearing E-stop: that confirms
  // no operation is active, including one whose result was lost on disconnect.
  const acknowledgeIdle = useCallback(() => {
    const active = activeRef.current;
    if (active) actionRef.current?.ros.removeAllListeners(active.id);
    activeRef.current = null;
    unknownRef.current = false;
    setStatus('idle');
    setError(null);
    setFeedback(null);
    setResult(null);
  }, []);

  return { status, feedback, result, error, sendGoal, cancelGoal, acknowledgeIdle };
}
