import React from 'react';
import './GamepadDisplay.css';
import ControllerSVG from '../xbox_one_black.svg';

const buttonPositions = {
  a:  { x: 500, y: 280 },
  b:  { x: 540, y: 240 },
  x:  { x: 460, y: 240 },
  y:  { x: 500, y: 200 },
  du: { x: 220, y: 240 },
  dd: { x: 220, y: 300 },
  dl: { x: 180, y: 270 },
  dr: { x: 260, y: 270 },
  lb: { x: 140, y: 40 },
  rb: { x: 460, y: 40 },
  lt: { x: 140, y: 10 },
  rt: { x: 460, y: 10 },
  l3: { x: 180, y: 300 },
  r3: { x: 420, y: 340 },
};

const stickPositions = {
  leftStick: { left: 150, top: 220 },
  rightStick: { left: 420, top: 300 },
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
        <img src={ControllerSVG} alt="Xbox Controller" className="controller-image" />

        {Object.entries(buttons).map(([button, value]) => {
          const pos = buttonPositions[button];
          if (!pos) return null;
          return (
            <div
              id={`button-${button}`}
              key={button}
              className={`button-overlay ${value > 0 ? 'pressed' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                backgroundColor: `rgba(255, 0, 0, ${0.3 + 0.7 * value})`,
              }}
            />
          );
        })}

        <div
          id="left-stick"
          className="stick-overlay"
          style={{
            left: `${stickPositions.leftStick.left + leftStick.x * 20}px`,
            top: `${stickPositions.leftStick.top + leftStick.y * 20}px`,
          }}
        />
        <div
          id="right-stick"
          className="stick-overlay"
          style={{
            left: `${stickPositions.rightStick.left + rightStick.x * 20}px`,
            top: `${stickPositions.rightStick.top + rightStick.y * 20}px`,
          }}
        />
      </div>
    </div>
  );
};

export default GamepadDisplay;
