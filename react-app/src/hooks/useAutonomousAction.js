import { useCallback, useEffect, useRef, useState } from "react";
import { Action } from "roslib";

/** Matches autonomy_interfaces/action/AutonomousActions.action */
const ACTION_NAME = "/autonomous_actions";
const ACTION_TYPE = "autonomy_interfaces/action/AutonomousActions";

export function useAutonomousAction(ros) {
  const actionRef = useRef(null);
  const goalIdRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ros) return;

    actionRef.current = new Action({
      ros,
      name: ACTION_NAME,
      actionType: ACTION_TYPE,
    });

    return () => {
      if (goalIdRef.current) {
        actionRef.current?.cancelGoal(goalIdRef.current);
        goalIdRef.current = null;
      }
      actionRef.current = null;
    };
  }, [ros]);

  const sendGoal = useCallback((index) => {
    const action = actionRef.current;
    if (!action) return;

    setStatus("pending");
    setResult(null);
    setFeedback(null);
    setError(null);

    goalIdRef.current = action.sendGoal(
      { index },
      (nextResult) => {
        setResult(nextResult);
        setStatus(nextResult.success ? "succeeded" : "aborted");
        goalIdRef.current = null;
      },
      (nextFeedback) => {
        setFeedback(nextFeedback);
        setStatus("active");
      },
      (failed) => {
        setError(failed);
        setStatus("aborted");
        goalIdRef.current = null;
      },
    );
  }, []);

  const cancelGoal = useCallback(() => {
    if (!goalIdRef.current) return;
    actionRef.current?.cancelGoal(goalIdRef.current);
    goalIdRef.current = null;
    setStatus("canceled");
  }, []);

  return {
    status,
    result,
    feedback,
    error,
    sendGoal,
    cancelGoal,
  };
}
