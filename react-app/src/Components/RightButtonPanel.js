import React, {useState} from 'react';


const BUTTON_CLASSES = {
  'STOP': 'command-button-sstop',
  'Dig Auto': 'command-button-digauto',
  'Dump Auto': 'command-button-dumpauto',
};

const CommandButton = React.memo(({ label, className, onClick, style }) => (
  <button className={className}
  onClick={onClick}
  style = {style}>
    <h4>
    {label}
    </h4>
  </button>
));

function RightButtonPanel() {

const doFunction = label => {
    if (label.toLowerCase() === 'stop') {
        // TODO: Add functionality
    }
}

// Render the component UI
  return (
    <div>
      <h2 className="panel-title">Control Panel</h2>
      <div className="drive-panel-grid">
          {['STOP', 'Dig Auto', 'Dump Auto'].map((label) => (
            <CommandButton
            key={label}
            label={label}
            className={`${BUTTON_CLASSES[label]}`}
            onClick={() => doFunction(label)}
            />
          ))}
        </div>
      </div>
  );
}

export default RightButtonPanel;