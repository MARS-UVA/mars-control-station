import { useCallback, useEffect, useRef, useState } from 'react';
import { Action } from 'roslib';
import { DIGDUMP_INDEX } from './rosTypes';

// How long a superseding goal waits for the old goal's terminal result before
// being sent anyway (and most likely rejected -- see below).
const SUPERSEDE_TIMEOUT_MS = 3000;

function clearPending(pendingRef) {
  if (pendingRef.current) clearTimeout(pendingRef.current.timer);
  pendingRef.current = null;
}

/**
 * Client for the /digdump action (autonomy_msgs/action/AutonomousActions:
 * goal { int32 index }, result { bool success }, feedback { string status }).
 *
 * Two fixes over the plain roslib Action pattern:
 *  a) cancelGoal() records the goal id as operator-canceled, so the server's
 *     resulting CANCELED result (delivered through roslib's failed callback)
 *     settles as 'canceled' and is never reported as 'aborted'.
 *  b) sendGoal() cancels any in-flight goal itself, and callbacks for any goal
 *     id other than the current one are ignored, so a late result from the old
 *     goal can't overwrite the new goal's status.
 *
 * For (b), the new goal is held until the old goal reaches a terminal result:
 * digdump's handle_goal REJECTS any goal while one is still active, so sending
 * immediately after the cancel is always rejected. If the old goal hasn't
 * settled within SUPERSEDE_TIMEOUT_MS the new goal is sent regardless.
 *
 * roslib registers a ros listener per goal id and never removes it; this hook
 * removes it once that goal reaches a terminal result.
 *
 * Unmounting does NOT cancel a running goal: a remount must not silently stop
 * an autonomy run. Cancel explicitly (or estop) when that is intended.
 *
 * Nothing is sent while disconnected (roslib would queue it and start the goal
 * whenever the link came back); sendGoal/cancelGoal return whether they sent.
 * If the link drops with a goal in flight its result can never arrive (it
 * belonged to the old rosbridge session), so the goal is dropped and status
 * becomes 'unknown': the robot may still be running it.
 *
 * @returns {{ status: 'idle'|'active'|'canceling'|'succeeded'|'canceled'|'aborted'|'rejected'|'unknown',
 *             feedback: { status: string }|null, result: { success: boolean }|null,
 *             error: string|null, sendGoal: (index: number) => boolean, cancelGoal: () => boolean }}
 */
export default function useDigDumpAction(ros) {
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const actionRef = useRef(null);
  const goalIdRef = useRef(null);
  const operatorCanceledRef = useRef(new Set());
  // A goal waiting for the previous one to settle: { index, timer }.
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!ros) return undefined;
    actionRef.current = new Action({
      ros,
      name: '/digdump',
      actionType: 'autonomy_msgs/action/AutonomousActions',
    });

    const onClose = () => {
      const lostId = goalIdRef.current;
      const hadPending = pendingRef.current !== null;
      clearPending(pendingRef);
      if (!lostId) return;
      ros.removeAllListeners(lostId);
      operatorCanceledRef.current.delete(lostId);
      goalIdRef.current = null;
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
    };
  }, [ros]);

  // Sends a goal and makes it the current one. Declared with a ref so the
  // terminal callbacks of a superseded goal can dispatch the pending goal.
  const dispatchRef = useRef(null);
  dispatchRef.current = (index) => {
    const action = actionRef.current;
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
      if (wasCurrent) goalIdRef.current = null;
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
    id = action.sendGoal({ index }, onResult, onFeedback, onFailed) ?? null;
    goalIdRef.current = id;
    return true;
  };

  const cancelGoal = useCallback(() => {
    // Also drops a goal still waiting on a supersede.
    clearPending(pendingRef);
    const action = actionRef.current;
    const id = goalIdRef.current;
    if (!id || !action || !action.ros.isConnected) return false;
    operatorCanceledRef.current.add(id);
    action.cancelGoal(id);
    setStatus('canceling');
    return true;
  }, []);

  const sendGoal = useCallback((index) => {
    if (!Object.values(DIGDUMP_INDEX).includes(index)) {
      throw new Error(`Invalid digdump index ${index}; use DIGDUMP_INDEX from hooks/rosTypes`);
    }
    const action = actionRef.current;
    if (!action || !action.ros.isConnected) return false;

    const previousId = goalIdRef.current;
    if (!previousId) return dispatchRef.current(index);

    // Fix (b): retire the in-flight goal, then send once it has settled.
    clearPending(pendingRef);
    operatorCanceledRef.current.add(previousId);
    action.cancelGoal(previousId);
    setStatus('canceling');
    pendingRef.current = {
      index,
      timer: setTimeout(() => {
        if (!pendingRef.current) return;
        const next = pendingRef.current.index;
        pendingRef.current = null;
        // Stop tracking the old goal so its late result is ignored.
        goalIdRef.current = null;
        dispatchRef.current(next);
      }, SUPERSEDE_TIMEOUT_MS),
    };
    return true;
  }, []);

  return { status, feedback, result, error, sendGoal, cancelGoal };
}
