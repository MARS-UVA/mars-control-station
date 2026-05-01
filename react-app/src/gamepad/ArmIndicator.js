import React from 'react';
import './ArmIndicator.css';

const ArmIndicator = ({ 
  frontArmActive = false,
  backArmActive = false,
  label = 'Arm Control',
  directionSwitched = false,
}) => {
  let armStatus = 'Neither';
  
  if (frontArmActive && backArmActive) {
    armStatus = 'Both';
  } else if (frontArmActive) {
    armStatus = directionSwitched ? 'Back' : 'Front';
  } else if (backArmActive) {
    armStatus = directionSwitched ? 'Front' : 'Back';
  }

  return (
    <div className="arm-indicator-container">
      <div className="arm-indicator-label">{label}</div>
      <div className={`arm-indicator-box status-${frontArmActive ? backArmActive ? 'both' : 'front' : backArmActive ? 'back' : 'none'}`}>
        {armStatus}
      </div>
    </div>
  );
};

export default ArmIndicator;
