/**
 * Legacy data-path adapter: the packets.js / gamepad.js functions that
 * GamepadPanel and RightButtonPanel used to import directly, bundled as the
 * prop objects App.js now passes them.
 *
 * IMPORTING THIS MODULE HAS SIDE EFFECTS. packets.js opens
 * ws://localhost:3001 and starts its 30 ms transmit loop the moment it is
 * evaluated. App.js therefore loads this module with a conditional require()
 * only when REACT_APP_USE_ROSBRIDGE is not 'true'; nothing else may import it.
 */
import { setTransmissionActive, sendCustomGamepadState, sendCustomCommandState } from './packets';
import { getGamepadState } from './gamepad/gamepad';

// network_communication's ActionTypes (mars-jetson server.hpp):
// None = 0, DigAutonomy = 1, DumpAutonomy = 2, EStop = 3.
// Identical to the actions_enum RightButtonPanel carried before it took
// these as props.
export const LEGACY_ACTION = Object.freeze({
  DIG: 1,
  DUMP: 2,
  STOP: 3,
});

/** GamepadPanel's legacy functions, unchanged. */
export const legacyGamepad = Object.freeze({
  getGamepadState,
  setTransmissionActive,
  sendCustomGamepadState,
});

/** RightButtonPanel's legacy command senders: `{type:'action', actionType}` over ws://localhost:3001. */
export const legacyCommands = Object.freeze({
  dig: () => sendCustomCommandState(LEGACY_ACTION.DIG),
  dump: () => sendCustomCommandState(LEGACY_ACTION.DUMP),
  stop: () => sendCustomCommandState(LEGACY_ACTION.STOP),
});
