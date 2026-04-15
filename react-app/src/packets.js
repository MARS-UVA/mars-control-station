import { getGamepadState } from "./gamepad/gamepad";
import { getRobotState } from "./robotState";
let isTransmissionActive = true; // New control flag

const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  ws.send(3);
  console.log('gamepad websocket connected');
};
ws.onclose = () => {
  console.log('gamepad websocket closed');
};


// New helper to control transmission from React
function setTransmissionActive(isActive) {
    isTransmissionActive = isActive;
}
function getTransmissionActive(){
    return isTransmissionActive;
}

// New helper to send recorded data over the existing socket
function sendCustomGamepadState(controllerInputs) {
    if (ws.readyState === WebSocket.OPEN) {
        const commandOutput = getRobotState(); // Get the commands sent to the robot from robotState.js

      const uiState = {
        type: 'uiState',
        gamepad: controllerInputs,
        commands: commandOutput
      };
      ws.send(JSON.stringify(uiState)); // Sends the jit to the websocket
    }
}

function sendActionState(actionType) {
    if(ws.readyState === WebSocket.OPEN) {
      const action = {
        type: 'action',
        actionType: actionType,
      };
      ws.send(JSON.stringify(action)); // Sends the jit to the websocket
    } 

}

function sendPursuitState(pursuitType) {
  if (ws.readyState === WebSocket.OPEN) {
    const pursuit = {
      type: 'pursuit',
      pursuitType: pursuitType,
    };
    ws.send(JSON.stringify(pursuit)); // Sends the jit to the websocket (but different!)
  }
}


const intervalTime = 30

setInterval(() => {
    // Only send live data if transmission is active
    if (!isTransmissionActive || ws.readyState !== WebSocket.OPEN) return; // Checks for the websocket status
    const gamepadOutput = getGamepadState(); // Get the gamepad info from gamepad.js (in react-app)
    const gamepad2Output = getGamepadState(1);
    const commandOutput = getRobotState(); // Get the commands sent to the robot from robotState.js

    const uiState = {
      type: 'uiState',
      gamepad: gamepadOutput,
      gamepad2: gamepad2Output,
      commands: commandOutput
    };
    ws.send(JSON.stringify(uiState)); // Sends the jit to the websocket
}, intervalTime)

export {getTransmissionActive, setTransmissionActive, sendCustomGamepadState, sendActionState, sendPursuitState};