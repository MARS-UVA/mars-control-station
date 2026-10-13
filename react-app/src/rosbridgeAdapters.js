/**
 * Shape translation between the legacy gamepad payload built by
 * gamepad/gamepad.js (what GamepadDisplay, DirectionChangeButton and the
 * GamepadPanel macro recorder consume) and teleop_msgs/msg/GamepadState (what
 * useGamepadPublisher publishes). Used only on the rosbridge path.
 *
 * Legacy shape:
 *   { leftStick: {x, y}, rightStick: {x, y},
 *     buttons: { x, y, a, b, lt, rt, lb, rb, dd, du, dl, dr, l3, r3, back, start } }
 * where every button is the Gamepad API's `.value` (0..1; 0 or 1 for digital
 * buttons, analog for lt/rt).
 */
import { neutralGamepadState } from './hooks/useGamepadPublisher';

// Same order as getButtonObjectFromGamepad in gamepad/gamepad.js.
const BUTTON_NAMES = ['x', 'y', 'a', 'b', 'lt', 'rt', 'lb', 'rb', 'dd', 'du', 'dl', 'dr', 'l3', 'r3', 'back', 'start'];
const ANALOG_BUTTONS = new Set(['lt', 'rt']);

/** GamepadState -> legacy gamepadData. Booleans become 0/1 to match `.value`. */
export function toLegacyGamepadData(frame) {
  const buttons = {};
  for (const name of BUTTON_NAMES) {
    buttons[name] = Number(frame[`${name}_pressed`]);
  }
  return {
    leftStick: { x: frame.left_stick.x, y: frame.left_stick.y },
    rightStick: { x: frame.right_stick.x, y: frame.right_stick.y },
    buttons,
  };
}

/** Legacy gamepadData -> GamepadState, e.g. a recorded macro frame for replay. */
export function toRosGamepadState(data) {
  const frame = neutralGamepadState();
  if (!data) return frame;
  const buttons = data.buttons ?? {};
  for (const name of BUTTON_NAMES) {
    frame[`${name}_pressed`] = ANALOG_BUTTONS.has(name)
      ? Number(buttons[name] ?? 0)
      : Boolean(buttons[name]);
  }
  frame.left_stick = { x: Number(data.leftStick?.x ?? 0), y: Number(data.leftStick?.y ?? 0) };
  frame.right_stick = { x: Number(data.rightStick?.x ?? 0), y: Number(data.rightStick?.y ?? 0) };
  return frame;
}
