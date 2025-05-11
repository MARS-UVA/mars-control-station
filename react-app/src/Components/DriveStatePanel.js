/**
 * DriveStatePanel Component
 * 
 * This component renders a control panel with buttons to switch between different drive states
 * and an emergency stop (ESTOP) button.
 */
import React, { useState, useEffect } from 'react';

const CommandButton = React.memo(({ label, active, onClick }) => (
  <button className={"command-button " + active} onClick={onClick}>
    {label}
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

  // React to changes in drive state
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    switch (driveState) {
      case 'Auto Drive':
        console.log('Switched to Auto Drive mode. Initializing autonomous systems...');
        ws.send(JSON.stringify({ event: 'drive', state: 'Auto' }));
        break;
      case 'Direct Drive':
        console.log('Switched to Direct Drive mode. Enabling manual controls...');
        ws.send(JSON.stringify({ event: 'drive', state: 'Direct' }));
        break;
      case 'Reverse Drive':
        console.log('Switched to Reverse Drive mode. Adjusting controls for reverse operation...');
        ws.send(JSON.stringify({ event: 'drive', state: 'Reverse' }));
        break;
      case 'Idle':
        console.log('Switched to Idle mode. Stopping all operations...');
        ws.send(JSON.stringify({ event: 'drive', state: 'Idle' }));
        break;
      default:
        console.log('Unknown drive state.');
    }
  }, [driveState]);

  // Render the component UI
  return (
    <div className="panel">
      <h2 className="panel-title">Controls</h2>
      <div className="drive-panel-grid">
        {/* Left column for drive state buttons */}
        <div className="drive-buttons-column">
          {['Auto Drive', 'Direct Drive', 'Reverse Drive', 'Idle'].map((label, index) => (
            <CommandButton
              key={index}
              label={label}
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
                  height: "5.25rem",
                  backgroundColor: estopSuccess ? "red" : "",
                }}
                onClick={handleESTOPWithFeedback}
              >
                Soft STOP
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
              }}
              onClick={handleESTOPWithFeedback}
            >
              Soft STOP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DriveStatePanel;
