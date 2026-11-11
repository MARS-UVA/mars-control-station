import React, { useEffect } from 'react';
import GamepadDisplay from './GamepadDisplay';

/**
 * Shows whether a gamepad is connected and a live picture of its inputs.
 *
 * getGamepadState(index, directionOverride) is a prop so the app can supply
 * either the legacy gamepad.js reader or the rosbridge adapter (see
 * docs/rosbridge.md). It returns a legacy-shaped pad snapshot
 * ({ leftStick, rightStick, buttons }) or null when no pad is at that index.
 */
function GamepadPanel({
  gamepadStatus,
  setGamepadStatus,
  gamepadData,
  setGamepadData,
  gamepadIndex,
  getGamepadState,
}) {
  useEffect(() => {
    const handleGamepadConnected = (e) => setGamepadStatus(`Gamepad connected!: ${e.gamepad.id}`);
    const handleGamepadDisconnected = () => {
      setGamepadStatus('No gamepad connected!');
      setGamepadData(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    const interval = setInterval(() => {
      const gamepads = navigator.getGamepads();
      if (gamepads[gamepadIndex]) {
        const state = getGamepadState(gamepadIndex, false);
        if (state) {
          setGamepadData(state);
        } else {
          console.warn('Failed to get gamepad state');
        }
      }
    }, 30);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      clearInterval(interval);
    };
  }, [setGamepadData, setGamepadStatus, getGamepadState, gamepadIndex]);

  return (
    <div>
      <div className="panel">
        <p className="gamepad-status">{gamepadStatus}</p>
        {gamepadData && <GamepadDisplay gamepadData={gamepadData} />}
      </div>
    </div>
  );
}

export default GamepadPanel;
