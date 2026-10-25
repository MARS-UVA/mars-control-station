import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

/**
 * Drive the simulated robot without a gamepad: hold the on-screen arrows, or
 * turn on keyboard drive and hold W/A/S/D.
 *
 * Works by overriding the left stick of the frames useGamepadPublisher already
 * sends (setVirtualStick), so it goes through teleop exactly like a gamepad:
 * left stick y is speed, x is turning, the direction switch applies, and the
 * robot must be in TELEOP. Only rendered on the rosbridge path with the gazebo
 * backend detected (App.js).
 *
 * W and D are also the dashboard's macro-playback and "Dig auto" shortcuts.
 * While keyboard drive is on, this panel catches W/A/S/D in the capture phase
 * and stops them there, so they drive instead of triggering those. With it
 * off, the keys keep their old meaning.
 */

// Fraction of full stick. Teleop scales this to the robot's max speed.
const DRIVE_SPEED = 0.6;
const KEY_TO_DIRECTION = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right' };
// Inputs that take no typed text, so W/A/S/D on them should still drive
// (the keyboard-drive checkbox itself is focused right after it is ticked).
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'range', 'submit', 'reset']);
const NONE = { forward: false, back: false, left: false, right: false };

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    border: '1px solid var(--border-color, #cccccc)',
    borderRadius: 6,
  },
  title: { fontSize: 13, fontWeight: 600 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 48px)',
    gridTemplateRows: 'repeat(2, 48px)',
    gap: 6,
  },
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

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has(target.type);
  return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export default function SimDrivePad({ setVirtualStick }) {
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [keys, setKeys] = useState(NONE);       // held keyboard directions
  const [pointer, setPointer] = useState(NONE); // held on-screen directions
  const setStickRef = useRef(setVirtualStick);
  setStickRef.current = setVirtualStick;

  // Held directions -> stick. Opposite directions cancel out.
  useEffect(() => {
    const held = (dir) => keys[dir] || pointer[dir];
    const y = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
    const x = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    setStickRef.current(x || y ? { x: x * DRIVE_SPEED, y: y * DRIVE_SPEED } : null);
  }, [keys, pointer]);

  // Leave the stick to the real gamepad when this panel goes away.
  useEffect(() => () => setStickRef.current(null), []);

  // Keyboard: capture phase on window runs before every other key handler on
  // the page, so stopping the event here keeps W/D from also triggering
  // macro playback and Dig.
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
      <div style={styles.title}>Sim drive</div>
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
      <label style={styles.toggle}>
        <input
          type="checkbox"
          checked={keyboardEnabled}
          onChange={(event) => setKeyboardEnabled(event.target.checked)}
        />
        Keyboard drive (WASD)
      </label>
    </div>
  );
}
