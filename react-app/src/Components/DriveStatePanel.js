/**
 * DriveStatePanel Component
 * 
 * This component renders a control panel with buttons to switch between different drive states
 * and an emergency stop (ESTOP) button.
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
const CommandButton = React.memo(({ label, active, onClick, style }) => (

  <button className={"command-button " + active} 
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
      <h2 className="panel-title"></h2>
      <div className="drive-panel-grid">
        <div className="drive-buttons-column" position = "fixed">
          {['Record Inputs', 'Run Inputs', 'Reset Recording'].map((label, index) => (
            <CommandButton
              key={index}
              label={label}
              style={BUTTON_POSITIONS[label]}
              active={modes[label] ? 'active' : ''}
              onClick={() => toggleMode(label, modes, setModes)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default DriveStatePanel;