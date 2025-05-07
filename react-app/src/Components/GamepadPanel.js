import React, { useState, useEffect } from 'react';
import GamepadDisplay from './GamepadDisplay';

let gamepads = navigator.getGamepads()


const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  ws.send(-1)
  console.log('websocket connected');
};
ws.onclose = () => {
  console.log('websocket closed');
};

const driveStateDict = {
  "Direct Drive": 0,
  "Reverse Drive": 1,
  "Idle": 2
}

// renders the gamepad panel
function GamepadPanel({driveState}) {
  window.addEventListener('gamepadconnected', e => {
    gamepads = navigator.getGamepads()
  })
  window.addEventListener('gamepaddisconnected', e => {
      gamepads = navigator.getGamepads()
  })
    

  /**
   * 
   * @param {Gamepad} gamepad 
   * @returns 
   */
  const getButtonObjectFromGamepad = (gamepad) => {
      return {
          x: gamepad.buttons[2].value,
          y: gamepad.buttons[3].value,
          a: gamepad.buttons[0].value,
          b: gamepad.buttons[1].value,
          lt: gamepad.buttons[6].value,
          rt: gamepad.buttons[7].value,
          lb: gamepad.buttons[4].value,
          rb: gamepad.buttons[5].value,
          dd: gamepad.buttons[13].value,
          du: gamepad.buttons[12].value,
          dr: gamepad.buttons[15].value,
          dl: gamepad.buttons[14].value,
          l3: gamepad.buttons[10].value,
          r3: gamepad.buttons[11].value,
          back: gamepad.buttons[8].value,
          start: gamepad.buttons[9].value,
      }
  }

  const getLeftStickFromGamepad = (gamepad) => {
      return {
          x: gamepad.axes[0],
          y: -gamepad.axes[1]
      }
  }

  const getRightStickFromGamepad = (gamepad) => {
      return {
          x: gamepad.axes[2],
          y: -gamepad.axes[3]
      }
  }

  const intervalTime = 30

  function getGamepadState(index = 0) {
      return {
              leftStick: getLeftStickFromGamepad(gamepads[index]),
              rightStick: getRightStickFromGamepad(gamepads[index]),
              buttons: getButtonObjectFromGamepad(gamepads[index])
          } 
  }

  setInterval(() => {
      gamepads = navigator.getGamepads()

      if (gamepads[0] != null) {
          const output = {
              state: driveStateDict[driveState],
              leftStick: getLeftStickFromGamepad(gamepads[0]),
              rightStick: getRightStickFromGamepad(gamepads[0]),
              buttons: getButtonObjectFromGamepad(gamepads[0])
          } // when we get out output method, we can send this object to it

          // gamepadText.textContent = JSON.stringify(output, 2)
          let json = JSON.stringify(output);
          console.log("sending data: " + json);
          ws.send(json);
      }
  }, intervalTime)


  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  const [gamepadData, setGamepadData] = useState(null);

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