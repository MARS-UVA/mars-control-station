import React from 'react';
import './BarsIndicator.css';

const BarsIndicator = ({ 
  orangeActive = true,
  blueActive = true,
  label = 'Arm State'
}) => {
  return (
    <div className="bars-container">
      <div className="bars-label">{label}</div>
      
      <div className="bar-section">
        <div className={`indicator orange ${orangeActive ? 'active' : 'inactive'}`}></div>
        <div className={`bar ${orangeActive ? 'active' : 'inactive'}`}>
          <div className={`bar-fill orange ${orangeActive ? 'active' : 'inactive'}`}></div>
        </div>
        <span className="arm-label">Left Arm</span>
      </div>

      <div className="bar-section">
        <div className={`indicator blue ${blueActive ? 'active' : 'inactive'}`}></div>
        <div className={`bar ${blueActive ? 'active' : 'inactive'}`}>
          <div className={`bar-fill blue ${blueActive ? 'active' : 'inactive'}`}></div>
        </div>
        <span className="arm-label">Right Arm</span>
      </div>
    </div>
  );
};

export default BarsIndicator;
