/**
 * DriveStatePanel Component
 * 
 * Just the UI is actually there and the buttons do nothing as no functions are written
 * for them, need to write functions and implement them.
 */
import React, { useState, useEffect } from 'react';
const BUTTON_POSITIONS = {
  'Record Inputs':   { top: 315+70,  left: 25 },
  'Run Inputs': { top: 315+70, left: 170 },
  'Reset Recording': { top: 315+70, left: 315 },
};
const BUTTON_CLASSES = {
  'Record Inputs': 'command-button-record',
  'Run Inputs': 'command-button-run',
  'Reset Recording': 'command-button-reset',
};
const CommandButton = React.memo(({ label, className, onClick, style }) => (
  <button className={className}
  onClick={onClick}
  style = {style}>
    <h4>
    {label}
    </h4>
  </button>
));

function DriveStatePanel() {
  const [modes, setModes] = useState({
    'Record Inputs': false,
    'Run Inputs': false,
    'Reset Recording': false,
  });
  const toggleMode = (label) => {
    setModes((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };



  // Render the component UI
  return (
    <div>
      <h2 className="panel-title">Goon Panel</h2>
      <div className="drive-panel-grid">
          {['Record Inputs', 'Run Inputs', 'Reset Recording'].map((label, index) => (
            <CommandButton
              key={label}
            label={label}
            className={`${BUTTON_CLASSES[label]} ${modes[label] ? 'active' : ''}`}
            style={{ ...BUTTON_POSITIONS[label], position: 'fixed' }}
            onClick={() => toggleMode(label)}
            />
          ))}
        </div>
      </div>
  );
}

export default DriveStatePanel;