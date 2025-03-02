/**
 * DriveStatePanel Component
 * 
 * This component renders a control panel with buttons to switch between different drive states
 * and an emergency stop (ESTOP) button.
 */
import React, {useState} from 'react';
function DriveStatePanel() {
  // Define the drive state and displays the current state
  const [driveState, setDriveState] = useState('Idle');
    const CommandButton = ({ label, active, onClick }) => (
        <button className={"command-button " + active} onClick={onClick}>
          {label}
        </button>
      );
  
  // Add motor control buttons that will beb shown in Direct Drive Mode
  const MotorButton = ({ motorNumber }) => (
  <button className="motor-button">
     Motor {motorNumber} 
     </button>)


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
            <button className="estop-stop-button">
              Motor Stop
            </button>
            {driveState == "Autonomous Drive" ? <button className="autonomous-stop-button">
              Autonomous Stop
            </button> : ""}

            {driveState === 'Direct Drive' && (

              <div className="motor-controls">
                <h3>Motor Controls</h3> 
                <div className="motor-grid">
                  {[1,2,3,4].map((motorNum) => 
                    (<MotorButton key={motorNum} motorNumbers={motorNum}/>
                    ))}
                </div>
              </div>

            )}
            
            

            
            
          </div>
  );
}

export default DriveStatePanel;