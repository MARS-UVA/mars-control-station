import { getTransmissionActive } from "../packets"
let gamepads = navigator.getGamepads()

window.addEventListener('gamepadconnected', e => {
    gamepads = navigator.getGamepads()
})
window.addEventListener('gamepaddisconnected', e => {
    gamepads = navigator.getGamepads()
})


/**
 * * @param {Gamepad} gamepad 
 * @returns
 */
const getButtonObjectFromGamepad = (index) => {
    const gamepad = navigator.getGamepads()[index];
    return {
        x: gamepad.buttons[3].value,
        y: gamepad.buttons[2].value,
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

const getLeftStickFromGamepad = (index) => {
    const gamepad = navigator.getGamepads()[index];
    return {
        x: gamepad.axes[0],
        y: -gamepad.axes[1]
    }
}

const getRightStickFromGamepad = (index) => {
    const gamepad = navigator.getGamepads()[index];
    return {
        x: gamepad.axes[2],
        y: -gamepad.axes[3]
    }
}

const gamepadText = document.getElementById('gamepad-text')


function getGamepadState(index = 0) {
    // Add safety check in case gamepad is disconnected but index is requested
    if (!gamepads[index]) return null;
    return {
        leftStick: getLeftStickFromGamepad(index),
        rightStick: getRightStickFromGamepad(index),
        buttons: getButtonObjectFromGamepad(index)
    }
}





export { getGamepadState }
