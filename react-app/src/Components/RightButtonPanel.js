import React, {useState, useEffect} from 'react';
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

function RightButtonPanel({ feedback, backArmActive, espWorking, currentActionState }) {

const doFunction = label => { 
  if (espWorking) {
    if (label.toLowerCase() === 'dig auto')   sendCustomCommandState(actions_enum['Dig Auto']);
    else if (label.toLowerCase() === 'dump auto')   sendCustomCommandState(actions_enum['Dump Auto']);
    else if (label.toLowerCase() === 'stop')   sendCustomCommandState(actions_enum['Stop']);
  } 
}
//console.log(feedback)

useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') {
      doFunction('stop');
    }
    else if (e.key === 'd'){
      doFunction('dig auto');
    }
    else if (e.key === 'f'){
      doFunction('dump auto')
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);


// Render the component UI
  return (
    <div>
      <h2 className="panel-title">Control Panel</h2>
      <div className="drive-panel-grid">
        <div className='drive-panel-stop-col'>
          {feedback == 3 ? (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop-feedback' onClick = {() => doFunction('STOP')}></CommandButton>
          ) : (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop' onClick = {() => doFunction('STOP')}></CommandButton>
          )}
        </div>
        <div className='drive-panel-other-col'>
          
          {feedback == 1 ? (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto-feedback' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          ) : (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          )}
          {feedback == 2 ? (
            <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto-feedback' onClick = {() => doFunction('Dump Auto')}></CommandButton>
          ) : (
            backArmActive ? (
              <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto-back' onClick = {() => doFunction('Dump Auto')}></CommandButton>
            ) : (
              <CommandButton key = 'Dump Auto' label = 'Dump Auto' className = 'command-button-dumpauto-front' onClick = {() => doFunction('Dump Auto')}></CommandButton>
            )
          )}
        </div>
        </div>
      </div>
  );
}

export default RightButtonPanel;