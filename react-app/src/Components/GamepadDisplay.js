/*
If a gamepad is connected, this component displays what buttons are pressed on it
*/
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
            {button.toUpperCase()}: {round(buttons[button])}
          </div>
        ))}
      </div>
    </div>
  );
};

function round(num) {
  return Math.round(num * 100) / 100
}

export default GamepadDisplay;