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

const CommandButton = React.memo(({ label, active, onClick}) => (


  <button className={"command-button " + active} onClick={onClick}  style={{width: '100%', height: "100%", alignItems: 'center', justifyContent: 'center'}}>
      
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
    <div className="panel" style={{flex: 1}}>
      <h2 className="panel-title"></h2>
      <div className="drive-panel-grid">
        {/* Left column for drive state buttons */}
        <div className="drive-buttons-column" position = "fixed">
          <div className="drive-buttons-grid">
          <CommandButton
            label="Auto Drive"
            active={"Auto Drive" === driveState ? 'active' : ''}
            onClick={() => setDriveState("Auto Drive")}
            />
            <CommandButton
            label="Direct Drive"
            active={"Direct Drive" === driveState ? 'active' : ''}
            onClick={() => setDriveState("Direct Drive")}
            />
          <CommandButton
            label="Reverse Drive"
            active={"Reverse Drive" === driveState ? 'active' : ''}
            onClick={() => setDriveState("Reverse Drive")}
            />
            <CommandButton
            label="Idle"
            active={"Idle" === driveState ? 'active' : ''}
            onClick={() => setDriveState("Idle")}
            />
          </div>
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
                backgroundColor: estopSuccess ? "orange" : ""
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