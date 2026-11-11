import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsDown, ChevronsUp } from 'lucide-react';

/**
 * Drive the simulated robot without a gamepad: hold the on-screen arrows, or
 * turn on keyboard drive and hold W/A/S/D. Hold the Drums buttons (or the
 * up/down arrow keys with keyboard drive on) to raise or lower the drum arms.
 *
 * Works by overriding the left stick of the frames useGamepadPublisher already
 * sends (setVirtualStick), so it goes through teleop exactly like a gamepad:
 * left stick y is speed, x is turning, the direction switch applies, and the
 * robot must be in TELEOP. The drum controls override the right stick
 * (setVirtualRightStick) the same way: teleop raises the selected arms with
 * right stick y > 0 and lowers them with y < 0, so they move whichever arms
 * X/Y/B selected (both by default). Only rendered on the rosbridge path with the gazebo
 * backend detected (App.js).
 *
 * D is also the dashboard's "Dig auto" shortcut. While keyboard drive is on,
 * this panel catches its keys in the capture phase and stops them there, so D
 * drives instead of starting a dig. With it off, D keeps its old meaning.
 */

// Fraction of full stick. Teleop scales this to the robot's max speed.
// Was 0.6; doubled would be 1.2, but the stick tops out at 1.0, so this is
// full stick (~1.67x the old speed). Go faster by raising teleop's max speed.
const DRIVE_SPEED = 1.0;
// Fraction of full right stick for the drum arms. Teleop ignores |y| <= 0.2
// and scales the rest to the arm actuator speed. Halved from 0.6.
const DRUM_SPEED = 0.3;
const KEY_TO_DIRECTION = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'drumsUp', ArrowDown: 'drumsDown',
};
// Inputs that take no typed text, so W/A/S/D on them should still drive
// (the keyboard-drive checkbox itself is focused right after it is ticked).
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'range', 'submit', 'reset']);
const NONE = { forward: false, back: false, left: false, right: false, drumsUp: false, drumsDown: false };
const noop = () => {};

const styles = {
  // Compact row: arrows on the left, title and keyboard toggle on the right.
  panel: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 8,
    border: '1px solid var(--border-color, #cccccc)',
    borderRadius: 6,
  },
  side: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { fontSize: 13, fontWeight: 600 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 38px)',
    gridTemplateRows: 'repeat(2, 38px)',
    gap: 4,
  },
  drumGrid: {
    display: 'grid',
    gridTemplateColumns: '38px',
    gridTemplateRows: 'repeat(2, 38px)',
    gap: 4,
  },
  drumLabel: { fontSize: 11, fontWeight: 600, textAlign: 'center' },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #0088ff',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'black',
    touchAction: 'none', // keep touch drags from scrolling while held
    userSelect: 'none',
    fontSize: 11,
    fontWeight: 600,
    gap: 2,
    flexDirection: 'column',
  },
  toggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
};

const BUTTONS = [
  { dir: 'forward', key: 'W', Icon: ArrowUp, area: '1 / 2' },
  { dir: 'left', key: 'A', Icon: ArrowLeft, area: '2 / 1' },
  { dir: 'back', key: 'S', Icon: ArrowDown, area: '2 / 2' },
  { dir: 'right', key: 'D', Icon: ArrowRight, area: '2 / 3' },
];

const DRUM_BUTTONS = [
  { dir: 'drumsUp', key: '↑', Icon: ChevronsUp, label: 'Raise drums' },
  { dir: 'drumsDown', key: '↓', Icon: ChevronsDown, label: 'Lower drums' },
];

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has(target.type);
  return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export default function SimDrivePad({ setVirtualStick, setVirtualRightStick = noop }) {
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [keys, setKeys] = useState(NONE);       // held keyboard directions
  const [pointer, setPointer] = useState(NONE); // held on-screen directions
  const setStickRef = useRef(setVirtualStick);
  setStickRef.current = setVirtualStick;
  const setRightStickRef = useRef(setVirtualRightStick);
  setRightStickRef.current = setVirtualRightStick;

  // Held directions -> stick. Opposite directions cancel out.
  useEffect(() => {
    const held = (dir) => keys[dir] || pointer[dir];
    const y = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
    const x = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    setStickRef.current(x || y ? { x: x * DRIVE_SPEED, y: y * DRIVE_SPEED } : null);
    const drums = (held('drumsUp') ? 1 : 0) - (held('drumsDown') ? 1 : 0);
    setRightStickRef.current(drums ? { x: 0, y: drums * DRUM_SPEED } : null);
  }, [keys, pointer]);

  // Leave both sticks to the real gamepad when this panel goes away.
  useEffect(() => () => {
    setStickRef.current(null);
    setRightStickRef.current(null);
  }, []);

  // Keyboard: capture phase on window runs before every other key handler on
  // the page, so stopping the event here keeps D from also triggering Dig.
  useEffect(() => {
    if (!keyboardEnabled) {
      setKeys(NONE);
      return undefined;
    }
    const onKey = (event) => {
      const dir = KEY_TO_DIRECTION[event.code];
      if (!dir || isTypingTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const down = event.type === 'keydown';
      setKeys((current) => (current[dir] === down ? current : { ...current, [dir]: down }));
    };
    const releaseAll = () => setKeys(NONE);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('blur', releaseAll);
    };
  }, [keyboardEnabled]);

  const press = useCallback((dir, down) => {
    setPointer((current) => (current[dir] === down ? current : { ...current, [dir]: down }));
  }, []);

  return (
    <div style={styles.panel}>
      <div style={styles.grid}>
        {BUTTONS.map(({ dir, key, Icon, area }) => {
          const active = keys[dir] || pointer[dir];
          return (
            <button
              key={dir}
              type="button"
              aria-label={`Drive ${dir}`}
              style={{
                ...styles.button,
                gridArea: area,
                backgroundColor: active ? '#0088ff' : '#6eb9ff',
              }}
              onPointerDown={(event) => {
                // Capture, so releasing outside the button still stops the robot.
                event.currentTarget.setPointerCapture(event.pointerId);
                press(dir, true);
              }}
              onPointerUp={() => press(dir, false)}
              onPointerCancel={() => press(dir, false)}
              onLostPointerCapture={() => press(dir, false)}
            >
              <Icon size={18} />
              {keyboardEnabled && key}
            </button>
          );
        })}
      </div>
      <div style={styles.side}>
        <div style={styles.drumLabel}>Drums</div>
        <div style={styles.drumGrid}>
          {DRUM_BUTTONS.map(({ dir, key, Icon, label }) => {
            const active = keys[dir] || pointer[dir];
            return (
              <button
                key={dir}
                type="button"
                aria-label={label}
                title={label}
                style={{
                  ...styles.button,
                  backgroundColor: active ? '#0088ff' : '#6eb9ff',
                }}
                onPointerDown={(event) => {
                  // Capture, so releasing outside the button still stops the arms.
                  event.currentTarget.setPointerCapture(event.pointerId);
                  press(dir, true);
                }}
                onPointerUp={() => press(dir, false)}
                onPointerCancel={() => press(dir, false)}
                onLostPointerCapture={() => press(dir, false)}
              >
                <Icon size={18} />
                {keyboardEnabled && key}
              </button>
            );
          })}
        </div>
      </div>
      <div style={styles.side}>
        <div style={styles.title}>Sim drive</div>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={keyboardEnabled}
            onChange={(event) => setKeyboardEnabled(event.target.checked)}
          />
          Keyboard (WASD, ↑/↓ drums)
        </label>
      </div>
    </div>
  );
}