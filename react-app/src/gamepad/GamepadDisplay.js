import React from 'react';
import './GamepadDisplay.css';
import RealControllerPNG from '../assets/logitechF710.png';
// import { buttonPositions, stickPositions } from './positions'; 


// === Overlay Coordinates ===
// Beautiful hardcoded positions because the control station is a fixed screen size / resolution!
export const buttonPositions = {
  a:  { x: 253, y: 98 },
  b:  { x: 276, y: 75 },
  x:  { x: 230, y: 75 }, // These might be swapped? or else my controller is cooked
  y:  { x: 253, y: 50 },

  back: { x: 128, y: 55 },
  start: { x: 194, y: 55 },

  du: { x: 69, y: 55 },
  dd: { x: 69, y: 90 },
  dl: { x: 50, y: 72 },
  dr: { x: 85, y: 72 },

  lb: { x: 70, y: 0 },
  rb: { x: 255, y: 0 },
  lt: { x: 25, y: 0 }, // I can't seem to put these any higher. Hope it's fine.
  rt: { x: 300, y: 0 },
  l3: { x: 115, y: 130 },
  r3: { x: 210, y: 130 },
};

export const stickPositions = {
  leftStick: { x: 121, y: 133 },
  rightStick: { x: 215, y: 133 },
};


const GamepadDisplay = ({ gamepadData }) => {
  if (!gamepadData) return null;
  const { leftStick, rightStick, buttons } = gamepadData;

  return (
    <div className="gamepad-display">
      <div className="sticks">
        <div className="stick">
          <h3>Left Stick</h3>
          <p>X: {leftStick.x.toFixed(2)}</p>
          <p>Y: {leftStick.y.toFixed(2)}</p>
        </div>
        <div className="stick">
          <h3>Right Stick</h3>
          <p>X: {rightStick.x.toFixed(2)}</p>
          <p>Y: {rightStick.y.toFixed(2)}</p>
        </div>
      </div>

      <div className="controller-container">
        <img src={RealControllerPNG} alt="Logitech Controller" className="controller-image" />

        {Object.entries(buttons).map(([button, value]) => {
          const pos = buttonPositions[button];
          if (!pos) return null;
          return (
            <div
              id={`button-${button}`}
              key={button}
              className={`button-overlay ${value > 0 ? 'pressed' : ''}`}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                backgroundColor: `rgba(255, 0, 0, ${0 + value})`,
              }}
            />
          );
        })}

        <div
          id="left-stick"
          className={`stick-overlay ${buttons.l3 > 0 ? 'pressed' : ''}`}
          style={{
            left: `${stickPositions.leftStick.x + leftStick.x * 20}px`,
            top: `${stickPositions.leftStick.y - leftStick.y * 20}px`,
          }}
        />
        <div
          id="right-stick"
          className={`stick-overlay ${buttons.r3 > 0 ? 'pressed' : ''}`}
          style={{
            left: `${stickPositions.rightStick.x + rightStick.x * 20}px`,
            top: `${stickPositions.rightStick.y - rightStick.y * 20}px`,
          }}
        />
      </div>
    </div>
  );
};

export default GamepadDisplay;
