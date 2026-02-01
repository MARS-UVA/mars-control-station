let gamepads = navigator.getGamepads()
let isTransmissionActive = true; // New control flag

const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => {
  ws.send(-1)
  //console.log('websocket connected');
};
ws.onclose = () => {
  //console.log('websocket closed');
};

window.addEventListener('gamepadconnected', e => {
    gamepads = navigator.getGamepads()
})
window.addEventListener('gamepaddisconnected', e => {
    gamepads = navigator.getGamepads()
})

function detectBrowser() {
    const userAgent = navigator.userAgent;
  
    if (userAgent.match(/chrome|chromium|crios/i)) {
      return "Chrome";
    } else if (userAgent.match(/firefox|fxios/i)) {
      return "Firefox";
    } else if (userAgent.match(/safari/i)) {
      return "Safari";
    } else if (userAgent.match(/msie|trident/i)) {
      return "Internet Explorer";
    } else if (userAgent.match(/edge\/\d+/i)) {
      return "Microsoft Edge";
    } else if (userAgent.match(/opera|opr/i)) {
      return "Opera";
    } else {
      return "Unknown";
    }
  }
  

/**
 * * @param {Gamepad} gamepad 
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

const gamepadText = document.getElementById('gamepad-text')

const intervalTime = 30

function getGamepadState(index = 0) {
    // Add safety check in case gamepad is disconnected but index is requested
    if (!gamepads[index]) return null;
    return {
            leftStick: getLeftStickFromGamepad(gamepads[index]),
            rightStick: getRightStickFromGamepad(gamepads[index]),
            buttons: getButtonObjectFromGamepad(gamepads[index])
        } 
}

// New helper to control transmission from React
function setTransmissionActive(isActive) {
    isTransmissionActive = isActive;
}

// New helper to send recorded data over the existing socket
function sendCustomGamepadState(state) {
    if (ws.readyState === WebSocket.OPEN) {
        let json = JSON.stringify(state);
        ws.send(json);
    }
}

setInterval(() => {
    gamepads = navigator.getGamepads()

    // Only send live data if transmission is active
    if (gamepads[0] != null && isTransmissionActive) {
        const output = {
            leftStick: getLeftStickFromGamepad(gamepads[0]),
            rightStick: getRightStickFromGamepad(gamepads[0]),
            buttons: getButtonObjectFromGamepad(gamepads[0])
        } 

        let json = JSON.stringify(output);
        ws.send(json);
    }
}, intervalTime)

export { getGamepadState, setTransmissionActive, sendCustomGamepadState }