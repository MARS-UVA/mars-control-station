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
  'Auto Drive':   { top: 315+70,  left: 25 },
  'Direct Drive': { top: 315+70, left: 160 },
  'Reverse Drive':{ top: 395+70, left: 25 },
  'Idle':         { top: 395+70, left: 160 },
};
const CommandButton = React.memo(({ label, active, onClick, style }) => (


  
  <button className={"command-button " + active} onClick={onClick}  style = {style}>
    
    <h4 style ={{ }}>
    {label}
    </h4>
   
  </button>
));

function DriveStatePanel({ driveState, setDriveState, handleESTOP, handleAutonomousStop }) {
  const [estopSuccess, setEstopSuccess] = useState(false); // State to track the success indication

  const handleESTOPWithFeedback = () => {
    handleESTOP(); // Call the original handleESTOP function
    setEstopSuccess(true); // Set success state to true
    setTimeout(() => setEstopSuccess(false), 1000); // Reset success state after 1 second
  };

  

  // Add event listener for spacebar press
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        handleESTOPWithFeedback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Render the component UI
  return (
    <div>
      <h2 className="panel-title"></h2>
      <div className="drive-panel-grid">
        {/* Left column for drive state buttons */}
        <div className="drive-buttons-column" position = "fixed">
          {['Auto Drive', 'Direct Drive', 'Reverse Drive', 'Idle'].map((label, index) => (
            <CommandButton
              key={index}
              label={label}
              style={BUTTON_POSITIONS[label]}
              active={label === driveState ? 'active' : ''}
              onClick={() => setDriveState(label)}
            />
          ))}
        </div>

        {/* Right column for ESTOP buttons */}
        <div className="estop-buttons-column">
          {driveState === "Auto Drive" ? (
            <>
              <button
                className="estop-button"
                style={{
                  left : 100, 
                  height: "5.25rem",
                  backgroundColor: estopSuccess ? "red" : "",
                }}
                onClick={handleESTOPWithFeedback}
              >
                Soft SIGMA
              </button>
              <button
                className="estop-button"
                style={{
                  backgroundColor: "blue",
                  marginTop: "10px",
                  height: "5.25rem",
                }}
                onClick={handleAutonomousStop}
              >
                Autonomous Stop
              </button>
            </>
          ) : (
            <button
              className="estop-button"
              style={{
                backgroundColor: estopSuccess ? "orange" : "",
                height: "150px",
                top : 385
              }}
              onClick={handleESTOPWithFeedback}
            >
              Soft <strong>STOP</strong>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DriveStatePanel;