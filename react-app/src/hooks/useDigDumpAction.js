import { useCallback, useEffect, useRef, useState } from 'react';
import { Action } from 'roslib';

// Bound the wait for cancellation without starting overlapping robot routines.
const SUPERSEDE_TIMEOUT_MS = 3000;

function clearPending(pendingRef) {
  if (pendingRef.current) clearTimeout(pendingRef.current.timer);
  pendingRef.current = null;
}

/**
 * Coordinates /dig (autonomy_msgs/action/Dig) and /dump
 * (autonomy_msgs/action/Dump). Both take { index }, return { success }, and
 * report { phase }. Index selects a robot routine, not a RobotState value.
 * Repeating a command cancels it; replacing one waits for cancellation.
 * Disconnects discard pending commands and mark running outcomes unknown.
 * Unmount removes listeners without silently canceling robot autonomy.
 */
export default function useDigDumpAction(ros) {
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const actionRef = useRef(null);
  const goalIdRef = useRef(null);
  const goalIndexRef = useRef(null);
  const operatorCanceledRef = useRef(new Set());
  // A goal waiting for the previous one to settle: { index, timer }.
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!ros) return undefined;
    actionRef.current = Object.fromEntries(['dig', 'dump'].map(name => [name, new Action({
      ros,
      name: `/${name}`,
      actionType: `autonomy_msgs/action/${name === 'dig' ? 'Dig' : 'Dump'}`,
    })]));

    const onClose = () => {
      const lostId = goalIdRef.current;
      const hadPending = pendingRef.current !== null;
      clearPending(pendingRef);
      if (!lostId) return;
      ros.removeAllListeners(lostId);
      operatorCanceledRef.current.delete(lostId);
      goalIdRef.current = null;
      goalIndexRef.current = null;
      setError(hadPending
        ? 'Connection lost while replacing a goal; neither goal outcome is known'
        : 'Connection lost with a goal in flight; outcome unknown');
      setStatus('unknown');
    };
    ros.on('close', onClose);

    return () => {
      ros.off('close', onClose);
      clearPending(pendingRef);
      if (goalIdRef.current) ros.removeAllListeners(goalIdRef.current);
      actionRef.current = null;
      goalIdRef.current = null;
      goalIndexRef.current = null;
    };
  }, [ros]);

  // Sends a goal and makes it the current one. Declared with a ref so the
  // terminal callbacks of a superseded goal can dispatch the pending goal.
  const dispatchRef = useRef(null);
  dispatchRef.current = (index) => {
    const action = actionRef.current?.[index.split(':')[0]];
    if (!action || !action.ros.isConnected) {
      setError('Goal not sent: rosbridge is disconnected');
      setStatus('idle');
      return false;
    }

    let id = null;
    const isCurrent = () => id !== null && goalIdRef.current === id;

    // Terminal result for goal `id`, current or superseded. Returns true only
    // when this goal's outcome should be reported: it was current and no held
    // goal was dispatched in its place.
    const settle = () => {
      operatorCanceledRef.current.delete(id);
      ros.removeAllListeners(id);
      const wasCurrent = isCurrent();
      if (wasCurrent) {
        goalIdRef.current = null;
        goalIndexRef.current = null;
      }
      // The goal we were waiting on has finished: send the held one now.
      if (goalIdRef.current === null && pendingRef.current) {
        const next = pendingRef.current.index;
        clearPending(pendingRef);
        dispatchRef.current(next);
        return false;
      }
      return wasCurrent;
    };

    // roslib only calls this for SUCCEEDED. A goal that finished before a
    // cancel request took effect did succeed, and is reported as such.
    const onResult = (res) => {
      if (!settle()) return;
      setResult(res);
      setStatus('succeeded');
    };

    const onFeedback = (fb) => {
      if (isCurrent()) setFeedback(fb);
    };

    const onFailed = (message) => {
      // Fix (a): an operator-initiated cancel settles as 'canceled' whatever
      // terminal status the server reports for it.
      const wasOperatorCanceled = operatorCanceledRef.current.has(id);
      if (!settle()) return;
      setError(message);
      if (wasOperatorCanceled || /canceled/i.test(message)) setStatus('canceled');
      else if (/rejected/i.test(message)) setStatus('rejected');
      else setStatus('aborted');
    };

    setFeedback(null);
    setResult(null);
    setError(null);
    setStatus('active');
    id = action.sendGoal({ index: Number(index.split(':')[1]) }, onResult, onFeedback, onFailed) ?? null;
    goalIdRef.current = id;
    goalIndexRef.current = id === null ? null : index;
    return true;
  };

  const cancelGoal = useCallback(() => {
    // Also drops a goal still waiting on a supersede.
    clearPending(pendingRef);
    const action = actionRef.current?.[goalIndexRef.current?.split(':')[0]];
    const id = goalIdRef.current;
    if (!id || !action || !action.ros.isConnected) return false;
    operatorCanceledRef.current.add(id);
    action.cancelGoal(id);
    setStatus('canceling');
    return true;
  }, []);

  const sendGoal = useCallback((name, routineIndex) => {
    if (!['dig', 'dump'].includes(name) || !Number.isInteger(routineIndex) || routineIndex < 0) {
      throw new Error('Expected dig or dump and a nonnegative robot routine index');
    }
    const index = `${name}:${routineIndex}`;
    const action = actionRef.current?.[name];
    if (!action || !action.ros.isConnected) return false;

    const previousId = goalIdRef.current;
    if (!previousId) return dispatchRef.current(index);

    // Repeating the running (or queued) command cancels it without restarting.
    if (goalIndexRef.current === index || pendingRef.current?.index === index) {
      return cancelGoal();
    }

    // Fix (b): retire the in-flight goal, then send once it has settled.
    clearPending(pendingRef);
    operatorCanceledRef.current.add(previousId);
    actionRef.current[goalIndexRef.current.split(':')[0]].cancelGoal(previousId);
    setStatus('canceling');
    pendingRef.current = {
      index,
      timer: setTimeout(() => {
        if (!pendingRef.current) return;
        pendingRef.current = null;
        setError('Replacement not sent: previous routine has not confirmed cancellation');
      }, SUPERSEDE_TIMEOUT_MS),
    };
    return true;
  }, [cancelGoal]);

  return { status, feedback, result, error, sendGoal, cancelGoal };
}
