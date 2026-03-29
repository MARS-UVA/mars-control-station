import React, {useState} from 'react';
import { getActionState, setActionState } from '../robotState';
import { sendCustomCommandState } from '../packets';

const actions_enum = {
    'Dig Auto': 1,
    'Dump Auto': 2,
    'Stop': 3,
}

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
   if (label.toLowerCase() === 'dig auto')   sendCustomCommandState(actions_enum['Dig Auto']);
    else if (label.toLowerCase() === 'dump auto')   sendCustomCommandState(actions_enum['Dump Auto']);
    else if (label.toLowerCase() === 'stop')   sendCustomCommandState(actions_enum['Stop']);

}

// Render the component UI
  return (
    <div>
      <h2 className="panel-title">Control Panel</h2>
      <div className="drive-panel-grid">
        <div className='drive-panel-stop-col'>
          <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop' onClick = {() => doFunction('STOP')}></CommandButton>
        </div>
        <div className='drive-panel-other-col'>
          <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto' onClick = {() => doFunction('Dump Auto')}></CommandButton>
        </div>
        </div>
      </div>
  );
}

export default RightButtonPanel;