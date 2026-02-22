import { getGamepadState } from "../react-app/src/gamepad/gamepad";
import { getRobotState } from "./robotState";
let isTransmissionActive = true; // New control flag

const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  ws.send(-1)
  //console.log('websocket connected');
};
ws.onclose = () => {
  //console.log('websocket closed');
};


// New helper to control transmission from React
function setTransmissionActive(isActive) {
    isTransmissionActive = isActive;
}
function getTransmissionActive(){
    return isTransmissionActive;
}


const intervalTime = 30

setInterval(() => {
    // Only send live data if transmission is active
    if (!isTransmissionActive || ws.readyState !== WebSocket.OPEN) return; // Checks for the websocket status
    const gamepadOutput = getGamepadState(); // Get the gamepad info from gamepad.js (in react-app)
    const commandOutput = getRobotState(); // Get the commands sent to the robot from robotState.js

    const uiState = {
      type: 'uiState',
      gamepad: gamepadOutput,
      commands: commandOutput
    };
    ws.send(JSON.stringify(uiState)); // Sends the jit to the websocket
}, intervalTime)

export {getTransmissionActive, setTransmissionActive}