import { useCallback, useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';
import { DRIVE_MODE } from './rosTypes';

const PUBLISH_INTERVAL_MS = 30;
const GAMEPAD_INDEX = 0;

// W3C "standard" gamepad layout indices. Only trusted when
// gamepad.mapping === 'standard'; any other layout publishes neutral.
const BUTTON = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};
const AXIS = { LEFT_X: 0, LEFT_Y: 1, RIGHT_X: 2, RIGHT_Y: 3 };

/** teleop_msgs/msg/GamepadState with every field at rest. */
function neutralGamepadState() {
  return {
    x_pressed: false,
    y_pressed: false,
    a_pressed: false,
    b_pressed: false,
    lt_pressed: 0.0,
    rt_pressed: 0.0,
    lb_pressed: false,
    rb_pressed: false,
    dd_pressed: false,
    du_pressed: false,
    dl_pressed: false,
    dr_pressed: false,
    l3_pressed: false,
    r3_pressed: false,
    back_pressed: false,
    start_pressed: false,
    left_stick: { x: 0.0, y: 0.0 },
    right_stick: { x: 0.0, y: 0.0 },
  };
}

/**
 * Reads pad GAMEPAD_INDEX into a teleop_msgs/msg/GamepadState.
 * Stick y is negated so pushing up is positive, matching gamepad/gamepad.js.
 */
function readGamepadState() {
  const pad = navigator.getGamepads?.()[GAMEPAD_INDEX];
  if (!pad || !pad.connected || pad.mapping !== 'standard') {
    return { frame: neutralGamepadState(), gamepadStatus: pad ? 'unsupported-mapping' : 'none' };
  }

  const pressed = (i) => Boolean(pad.buttons[i]?.pressed);
  const value = (i) => pad.buttons[i]?.value ?? 0.0;
  const axis = (i) => pad.axes[i] ?? 0.0;

  return {
    gamepadStatus: 'connected',
    frame: {
      x_pressed: pressed(BUTTON.X),
      y_pressed: pressed(BUTTON.Y),
      a_pressed: pressed(BUTTON.A),
      b_pressed: pressed(BUTTON.B),
      lt_pressed: value(BUTTON.LT),
      rt_pressed: value(BUTTON.RT),
      lb_pressed: pressed(BUTTON.LB),
      rb_pressed: pressed(BUTTON.RB),
      dd_pressed: pressed(BUTTON.DPAD_DOWN),
      du_pressed: pressed(BUTTON.DPAD_UP),
      dl_pressed: pressed(BUTTON.DPAD_LEFT),
      dr_pressed: pressed(BUTTON.DPAD_RIGHT),
      l3_pressed: pressed(BUTTON.L3),
      r3_pressed: pressed(BUTTON.R3),
      back_pressed: pressed(BUTTON.BACK),
      start_pressed: pressed(BUTTON.START),
      left_stick: { x: axis(AXIS.LEFT_X), y: -axis(AXIS.LEFT_Y) },
      right_stick: { x: axis(AXIS.RIGHT_X), y: -axis(AXIS.RIGHT_Y) },
    },
  };
}

/**
 * Publishes one gamepad frame every PUBLISH_INTERVAL_MS to both
 * /human_input_state (wrapped in HumanInputState) and /esp_gamepad_state
 * (the bare GamepadState), from a single timer and a single read.
 *
 * While the window is blurred or the page hidden, every tick publishes a
 * neutral frame; the transition itself also publishes one immediately.
 *
 * Frames are dropped, not queued, while rosbridge is disconnected.
 *
 * drive_mode takes HumanInputState's DRIVEMODE_* values (see rosTypes.js).
 *
 * @returns {{ driveMode: number, setDriveMode: (mode: number) => void,
 *             gamepadStatus: 'none'|'unsupported-mapping'|'connected'|'suspended' }}
 */
export default function useGamepadPublisher(ros) {
  const [driveMode, setDriveModeState] = useState(DRIVE_MODE.TELEOP);
  const [gamepadStatus, setGamepadStatus] = useState('none');

  const humanInputTopicRef = useRef(null);
  const espTopicRef = useRef(null);
  const driveModeRef = useRef(DRIVE_MODE.TELEOP);
  const suspendedRef = useRef(false);

  const setDriveMode = useCallback((mode) => {
    if (!Object.values(DRIVE_MODE).includes(mode)) {
      throw new Error(`Invalid drive_mode ${mode}; use DRIVE_MODE from hooks/rosTypes`);
    }
    driveModeRef.current = mode;
    setDriveModeState(mode);
  }, []);

  const publishFrame = useCallback((gamepadState) => {
    // roslib queues publishes made while disconnected and flushes them all on
    // reconnect. Stale stick frames must be dropped, never replayed.
    if (!humanInputTopicRef.current?.ros.isConnected) return;
    humanInputTopicRef.current.publish({
      gamepad_state: gamepadState,
      drive_mode: driveModeRef.current,
      a_stop: false,
      e_stop: false,
    });
    espTopicRef.current.publish(gamepadState);
  }, []);

  const publishNeutral = useCallback(() => {
    publishFrame(neutralGamepadState());
  }, [publishFrame]);

  const tick = useCallback(() => {
    if (suspendedRef.current) {
      publishNeutral();
      setGamepadStatus('suspended');
      return;
    }
    const { frame, gamepadStatus: next } = readGamepadState();
    publishFrame(frame);
    setGamepadStatus(next);
  }, [publishFrame, publishNeutral]);

  useEffect(() => {
    if (!ros) return undefined;

    humanInputTopicRef.current = new Topic({
      ros,
      name: '/human_input_state',
      messageType: 'teleop_msgs/msg/HumanInputState',
    });
    espTopicRef.current = new Topic({
      ros,
      name: '/esp_gamepad_state',
      messageType: 'teleop_msgs/msg/GamepadState',
    });

    const suspend = () => {
      suspendedRef.current = true;
      publishNeutral();
    };
    const resume = () => {
      suspendedRef.current = document.hidden || !document.hasFocus();
    };
    const onVisibilityChange = () => (document.hidden ? suspend() : resume());

    suspendedRef.current = document.hidden || !document.hasFocus();
    window.addEventListener('blur', suspend);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(tick, PUBLISH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener('blur', suspend);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Leave the robot at rest rather than on the last live frame.
      publishNeutral();
      humanInputTopicRef.current.unadvertise();
      espTopicRef.current.unadvertise();
      humanInputTopicRef.current = null;
      espTopicRef.current = null;
    };
  }, [ros, tick, publishNeutral]);

  return { driveMode, setDriveMode, gamepadStatus };
}
