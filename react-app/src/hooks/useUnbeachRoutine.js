import { useCallback, useEffect, useRef, useState } from 'react';

/*
Button-mode unbeach routine for Bruno:
  1. Select both drum arms and lower them as far as they go.
  2. Spin both drums so they push the robot the chosen way.
  3. After SPIN_DURATION_MS, stop the drums. Done.

It drives teleop exactly like a gamepad would, by overriding parts of the
frames useGamepadPublisher already sends (setVirtualRightStick and
setVirtualButtons), so the robot must be in TELEOP and this browser window
must have focus (a blurred window publishes neutral frames).

Teleop's controls used here (mars-jetson src/teleop/teleop/teleop.py):
  Y / X / B          select both arms / front arm only / back arm only
  right stick y < 0  lower the selected arms
  d-pad right / left spin the selected drums full forward / full backward
  A                  stop both drums
Teleop acts on button *presses* (released -> pressed), so each press is held
for PRESS_MS and then released.

The two drums face opposite ways, so pushing the robot one way takes opposite
spin commands: the front drum is selected alone and spun one way, then the back
drum alone and spun the other way.
*/

// Positions are 0.0 (retracted, raised) to 1.0 (extended, ground position).
const LOWERED_POSITION = 0.98;
// Lower for at most this long. Without position feedback the arms are lowered
// for the full time and end up against the actuator end stop.
const LOWER_TIMEOUT_MS = 12000;
// Full right stick: lower at full actuator speed.
const LOWER_STICK_Y = -1;
const SPIN_DURATION_MS = 5000;
const PRESS_MS = 150;
const POLL_MS = 100;

// Which d-pad press spins each drum so that the robot is pushed toward its
// front or its rear. NOT YET VERIFIED ON THE ROBOT: if Bruno moves the wrong
// way, swap 'dr_pressed' and 'dl_pressed' throughout this table.
const SPIN_FOR_PUSH = Object.freeze({
  front: { frontDrum: 'dl_pressed', backDrum: 'dr_pressed' },
  rear: { frontDrum: 'dr_pressed', backDrum: 'dl_pressed' },
});

export const UNBEACH_PHASE = Object.freeze({
  IDLE: 'idle',
  LOWERING: 'lowering',
  SPINNING: 'spinning',
  DONE: 'done',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
});

class Cancelled extends Error {}

/**
 * @param {object} options
 * @param {(stick: object|null) => void} options.setVirtualRightStick
 * @param {(buttons: object|null) => void} options.setVirtualButtons
 * @param {{ front: number|undefined, back: number|undefined }} options.actuatorPositions
 * @param {boolean} options.enabled  false while rosbridge is disconnected
 * @returns {{ phase: string, message: string, isRunning: boolean,
 *             start: (pushToward: 'front'|'rear') => void, cancel: () => void }}
 */
export default function useUnbeachRoutine({ setVirtualRightStick, setVirtualButtons, actuatorPositions, enabled }) {
  const [phase, setPhase] = useState(UNBEACH_PHASE.IDLE);
  const [message, setMessage] = useState('');
  const runIdRef = useRef(0);
  const runningRef = useRef(false);

  const positionsRef = useRef(actuatorPositions);
  positionsRef.current = actuatorPositions;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const releaseOverrides = useCallback(() => {
    setVirtualRightStick(null);
    setVirtualButtons(null);
  }, [setVirtualRightStick, setVirtualButtons]);

  // Stops the drums; not cancellable, so it also runs after a cancel.
  const stopDrums = useCallback(() => {
    setVirtualButtons({ a_pressed: true });
    setTimeout(() => setVirtualButtons(null), PRESS_MS);
  }, [setVirtualButtons]);

  const cancel = useCallback(() => {
    if (!runningRef.current) return;
    runIdRef.current += 1; // the running routine notices at its next step
  }, []);

  const start = useCallback((pushToward) => {
    if (runningRef.current || !enabledRef.current) return;
    const spin = SPIN_FOR_PUSH[pushToward];
    if (!spin) throw new Error(`Unknown unbeach direction "${pushToward}"`);

    runIdRef.current += 1;
    const runId = runIdRef.current;
    runningRef.current = true;

    // Waits, then throws if the routine was cancelled or rosbridge dropped.
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)).then(() => {
      if (runIdRef.current !== runId) throw new Cancelled();
      if (!enabledRef.current) throw new Error('rosbridge disconnected');
    });
    const press = async (button) => {
      setVirtualButtons({ [button]: true });
      await wait(PRESS_MS);
      setVirtualButtons(null);
      await wait(PRESS_MS);
    };

    const run = async () => {
      // 1. Lower both arms as far as they go.
      setPhase(UNBEACH_PHASE.LOWERING);
      setMessage('Lowering both drums…');
      await press('y_pressed');
      setVirtualRightStick({ x: 0, y: LOWER_STICK_Y });
      const lowerStart = Date.now();
      let reachedBottom = false;
      while (Date.now() - lowerStart < LOWER_TIMEOUT_MS) {
        await wait(POLL_MS);
        const { front, back } = positionsRef.current;
        if (front >= LOWERED_POSITION && back >= LOWERED_POSITION) {
          reachedBottom = true;
          break;
        }
      }
      setVirtualRightStick(null);
      await wait(PRESS_MS);

      // 2. Spin each drum on its own, in opposite directions.
      setPhase(UNBEACH_PHASE.SPINNING);
      setMessage(`Spinning drums to push toward the ${pushToward}…`);
      await press('x_pressed');
      await press(spin.frontDrum);
      await press('b_pressed');
      await press(spin.backDrum);
      await press('y_pressed'); // leave both arms selected, as teleop starts
      await wait(SPIN_DURATION_MS);

      // 3. Stop the drums.
      stopDrums();
      setPhase(UNBEACH_PHASE.DONE);
      setMessage(reachedBottom
        ? 'Unbeach done.'
        : `Unbeach done, but the drums did not report full extension within ${LOWER_TIMEOUT_MS / 1000} s.`);
    };

    run()
      .catch((error) => {
        releaseOverrides();
        stopDrums();
        if (error instanceof Cancelled) {
          setPhase(UNBEACH_PHASE.CANCELLED);
          setMessage('Unbeach cancelled; drums stopped.');
        } else {
          setPhase(UNBEACH_PHASE.FAILED);
          setMessage(`Unbeach stopped: ${error.message}.`);
        }
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [releaseOverrides, setVirtualButtons, setVirtualRightStick, stopDrums]);

  // Cancel if the dashboard goes away mid-routine.
  useEffect(() => () => {
    runIdRef.current += 1;
  }, []);

  const isRunning = phase === UNBEACH_PHASE.LOWERING || phase === UNBEACH_PHASE.SPINNING;
  return { phase, message, isRunning, start, cancel };
}
