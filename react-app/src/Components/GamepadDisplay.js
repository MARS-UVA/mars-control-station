import React from 'react';
import './GamepadDisplay.css';

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
      <div className="buttons">
        {Object.keys(buttons).map((button) => (
          <div key={button} className={`button ${buttons[button] ? 'pressed' : ''}`}>
            {button.toUpperCase()}: {buttons[button]}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamepadDisplay;