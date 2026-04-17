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

function RightButtonPanel({ feedback }) {

const doFunction = label => { 
   if (label.toLowerCase() === 'dig auto')   sendCustomCommandState(actions_enum['Dig Auto']);
    else if (label.toLowerCase() === 'dump auto')   sendCustomCommandState(actions_enum['Dump Auto']);
    else if (label.toLowerCase() === 'stop')   sendCustomCommandState(actions_enum['Stop']);

}
console.log(feedback)

// Render the component UI
  return (
    <div>
      <h2 className="panel-title">Control Panel</h2>
      <div className="drive-panel-grid">
        <div className='drive-panel-stop-col'>
          {feedback == 3 ? (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop-feedback' onClick = {() => doFunction('STOP')} style={getButtonStyle('STOP')}></CommandButton>
          ) : (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop' onClick = {() => doFunction('STOP')}></CommandButton>
          )}
        </div>
        <div className='drive-panel-other-col'>
          
          {feedback == 1 ? (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto-feedback' onClick = {() => doFunction('Dig Auto')} style={getButtonStyle('Dig Auto')}></CommandButton>
          ) : (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          )}
          {feedback == 2 ? (
            <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto-feedback' onClick = {() => doFunction('Dump Auto')} style={getButtonStyle('Dump Auto')}></CommandButton>
          ) : (
            <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto' onClick = {() => doFunction('Dump Auto')}></CommandButton>
          )}
        </div>
        </div>
      </div>
  );
}

export default RightButtonPanel;