import { getTransmissionActive } from "../packets"
import { getDirection } from "./directionStore"
let gamepads = navigator.getGamepads()
let lastTriggerOverride = 'joystick';
let lastTriggerLinearValue = null;

const TRIGGER_THRESHOLD = 0.3;
// The receiver multiplies input by 0.6 with shape=1, so this reaches 1.0.
const MAX_TRIGGER_MAGNITUDE = 1 / 0.6;
// Map the active trigger range (0.3, 1] from magnitude 1 to the maximum.
const getTriggerMagnitude = (value) =>
    1 + (MAX_TRIGGER_MAGNITUDE - 1) *
        ((value - TRIGGER_THRESHOLD) / (1 - TRIGGER_THRESHOLD));

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

const getLeftStickFromGamepad = (index, directionOverride = null) => {
    const gamepad = navigator.getGamepads()[index];
    const directionSwitched = directionOverride !== null ? directionOverride : getDirection();
    const directionMultiplier = directionSwitched ? -1 : 1;
    let linearValue = -gamepad.axes[1] * directionMultiplier;

    // Only the primary controller uses triggers to override drive velocity.
    if (index === 0) {
        const leftTriggerHeld = gamepad.buttons[6].value > TRIGGER_THRESHOLD;
        const rightTriggerHeld = gamepad.buttons[7].value > TRIGGER_THRESHOLD;
        let triggerOverride = 'joystick';

        if (leftTriggerHeld && rightTriggerHeld) {
            // Both triggers cancel the override; keep the joystick value.
            triggerOverride = 'both triggers (joystick control)';
        } else if (leftTriggerHeld) {
            linearValue = -getTriggerMagnitude(gamepad.buttons[6].value) * directionMultiplier;
            triggerOverride = 'left trigger';
        } else if (rightTriggerHeld) {
            linearValue = getTriggerMagnitude(gamepad.buttons[7].value) * directionMultiplier;
            triggerOverride = 'right trigger';
        }

        const triggerValueChanged = leftTriggerHeld !== rightTriggerHeld &&
            Math.abs(linearValue - lastTriggerLinearValue) >= 0.001;
        // Display/recording can request a fixed direction; only log the live direction.
        if (directionOverride === null &&
            (triggerOverride !== lastTriggerOverride || triggerValueChanged)) {
            console.log(`[Drive] ${triggerOverride}: leftStick.y=${linearValue.toFixed(3)}`, {
                lt: gamepad.buttons[6].value,
                rt: gamepad.buttons[7].value,
                directionSwitched,
            });
            lastTriggerOverride = triggerOverride;
            lastTriggerLinearValue = linearValue;
        }
    }

    return {
        x: gamepad.axes[0],
        y: linearValue
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


function getGamepadState(index = 0, directionOverride = null) {
    // Add safety check in case gamepad is disconnected but index is requested
    if (!gamepads[index]) return null;
    return {
        leftStick: getLeftStickFromGamepad(index, directionOverride),
        rightStick: getRightStickFromGamepad(index),
        buttons: getButtonObjectFromGamepad(index)
    }
}





export { getGamepadState }
