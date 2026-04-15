import React, {useState} from 'react';
import { sendActionState, sendPursuitState } from '../packets';

const actions_enum = {
    'Dig Auto': 1,
    'Dump Auto': 2,
    'Stop': 3,
}

const pursuit_enum = {
    'Pursuit Record Inputs': 1,
    'Pursuit Run Inputs': 2,
    'Pursuit Reset Recording': 3,
}

const BUTTON_CLASSES = {
  'STOP': 'command-button-sstop',
  'Dig Auto': 'command-button-digauto',
  'Dump Auto': 'command-button-dumpauto',
  'Pursuit Record Inputs': 'command-button-purepursuit-record',
  'Pursuit Run Inputs': 'command-button-purepursuit-start',
  'Pursuit Reset Recording': 'command-button-purepursuit-reset',
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

function RightButtonPanel(lastDataPoint) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [modes, setModes] = useState({
      'Pursuit Record Inputs': false,
      'Pursuit Run Inputs': false,
      'Pursuit Reset Recording': false,
    });

const doFunction = label => { 
   if (label.toLowerCase() === 'dig auto')   sendActionState(actions_enum['Dig Auto']);
    else if (label.toLowerCase() === 'dump auto')   sendActionState(actions_enum['Dump Auto']);
    else if (label.toLowerCase() === 'stop')   sendActionState(actions_enum['Stop']);
    else if (label.toLowerCase() === 'pursuit record inputs')   sendPursuitState(pursuit_enum['Pursuit Record Inputs']);
    else if (label.toLowerCase() === 'pursuit run inputs')   sendPursuitState(pursuit_enum['Pursuit Run Inputs']);
    else if (label.toLowerCase() === 'pursuit reset recording')   sendPursuitState(pursuit_enum['Pursuit Reset Recording']);
}

const changeColor = (label) => {

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
      <div className='drive-panel-other-row'>
          <CommandButton key = 'Pursuit Record Inputs' 
            label = 'Pursuit Record Inputs' 
            className = 'command-button-purepursuit-record' 
            onClick = {() => doFunction('Pursuit Record Inputs')}></CommandButton>
          <CommandButton key = 'Pursuit Run Inputs' 
            label = 'Pursuit Run Inputs' 
            className = 'command-button-purepursuit-start' 
            onClick = {() => doFunction('Pursuit Run Inputs')}></CommandButton>
          <CommandButton key = 'Pursuit Reset Recording' 
            label = 'Pursuit Reset Recording' 
            className = 'command-button-purepursuit-reset' 
            onClick = {() => doFunction('Pursuit Reset Recording')}></CommandButton>
        </div>
    </div>
  );
}

export default RightButtonPanel;