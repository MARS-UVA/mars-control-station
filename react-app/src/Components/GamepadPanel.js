import React, { useState, useEffect } from 'react';
import { getGamepadState} from '../gamepad/gamepad';
import GamepadDisplay from './GamepadDisplay';
// renders the gamepad panel
function GamepadPanel({ gamepadStatus, setGamepadStatus, gamepadData, setGamepadData }) {
  // const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  // const [gamepadData, setGamepadData] = useState(null);

  useEffect(() => {
    const handleGamepadConnected = (e) => {
      setGamepadStatus(`Gamepad connected!: ${e.gamepad.id}`);
    };

    const handleGamepadDisconnected = () => {
      setGamepadStatus('No gamepad connected!');
      setGamepadData(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    const interval = setInterval(() => {
      const gamepads = navigator.getGamepads();
      if (gamepads[0]) {
        setGamepadData(getGamepadState(0));
      }
    }, 30);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      clearInterval(interval);
    };
  }, []);


  return (
    <div className="panel">
      <p className="gamepad-status">{gamepadStatus}</p>
      {gamepadData && <GamepadDisplay gamepadData={gamepadData} />}
    </div>
  );
}



export default GamepadPanel;