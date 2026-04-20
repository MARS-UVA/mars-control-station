import React from 'react';
import './ArmIndicator.css';

const ArmIndicator = ({ 
  orangeActive = false,
  blueActive = false,
  label = 'Arm Control'
}) => {
  let armStatus = 'Neither';
  
  if (orangeActive && blueActive) {
    armStatus = 'Both';
  } else if (orangeActive) {
    armStatus = 'Front';
  } else if (blueActive) {
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
