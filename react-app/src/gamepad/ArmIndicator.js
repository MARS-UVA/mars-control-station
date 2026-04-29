import React from 'react';
import './ArmIndicator.css';

const ArmIndicator = ({ 
  frontArmActive = false,
  backArmActive = false,
  label = 'Arm Control'
}) => {
  let armStatus = 'Neither';
  
  if (frontArmActive && backArmActive) {
    armStatus = 'Both';
  } else if (frontArmActive) {
    armStatus = 'Front';
  } else if (backArmActive) {
    armStatus = 'Back';
  }

  return (
    <div className="arm-indicator-container">
      <div className="arm-indicator-label">{label}</div>
      <div className={`arm-indicator-box status-${armStatus.toLowerCase()}`}>
        {armStatus}
      </div>
    </div>
  );
};

export default ArmIndicator;
