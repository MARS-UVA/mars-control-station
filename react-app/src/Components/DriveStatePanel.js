/**
 * DriveStatePanel Component
 * 
 * This component renders a control panel with buttons to switch between different drive states
 * and an emergency stop (ESTOP) button.
 */
import React, {useState} from 'react';
function DriveStatePanel({driveState, setDriveState, handleESTOP, handleAutonomousStop}) {


    const CommandButton = ({ label, active, onClick }) => (
        <button className={"command-button " + active} onClick={onClick}>
          {label}
        </button>
      );
  // Render the component UI
  return (
    <div className="panel">
            <h2 className="panel-title">Controls</h2>
            <div className="command-grid">
              {['Autonomous Drive', 'Direct Drive', 'Idle'].map((label, index) => (
                <CommandButton key={index} label={label} 
                active={label === driveState ? 'active' : ''}
                onClick={() => setDriveState(label)}
                />
              ))}
            </div>
            {driveState == "Autonomous Drive" ? 
            <>
            <button className="estop-button" style={{"width": "20%"}} onClick={handleESTOP}>
              ESTOP
            </button>
            <button className="estop-button" style={{"width": "80%", "backgroundColor": "maroon"}} onClick={handleAutonomousStop}>
              Autonomous Stop
            </button>
            </>
            :
            
            <button className="estop-button" onClick={handleESTOP}>
            ESTOP
          </button>
          }
          </div>
  );
}

export default DriveStatePanel;
