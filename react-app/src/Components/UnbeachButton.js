import React, { useEffect, useState } from 'react';

/*
Unbeach button for the Control Panel. Starts the routine in
hooks/useUnbeachRoutine (lower both drums, spin them to push the robot, stop),
or cancels it while it runs.

The push direction defaults to the opposite of the current driving direction,
so the robot backs out the way it came, and resets whenever the driving
direction is switched. The operator can flip it before starting.
*/
export default function UnbeachButton({ unbeach, drivingToward, disabled }) {
  const oppositeOfDriving = drivingToward === 'front' ? 'rear' : 'front';
  const [pushToward, setPushToward] = useState(oppositeOfDriving);
  useEffect(() => setPushToward(oppositeOfDriving), [oppositeOfDriving]);

  const { isRunning, message, start, cancel } = unbeach;

  return (
    <div className="unbeach-control">
      <div className="unbeach-row">
        <button
          type="button"
          className={isRunning ? 'command-button-unbeach command-button-unbeach-running' : 'command-button-unbeach'}
          onClick={() => (isRunning ? cancel() : start(pushToward))}
          disabled={disabled && !isRunning}
          title={disabled && !isRunning ? 'Needs a rosbridge connection' : undefined}
        >
          <h4>{isRunning ? 'Cancel Unbeach' : 'Unbeach'}</h4>
        </button>
        <label className="unbeach-direction">
          Push toward
          <select
            value={pushToward}
            onChange={(event) => setPushToward(event.target.value)}
            disabled={isRunning}
          >
            <option value="rear">Rear</option>
            <option value="front">Front</option>
          </select>
        </label>
      </div>
      {message && <div className="unbeach-status" role="status">{message}</div>}
    </div>
  );
}
