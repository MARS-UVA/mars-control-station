import React, {useEffect} from 'react';

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

/**
 * The command senders used to be imported from packets.js
 * (sendCustomCommandState with actionType 1 / 2 / 3). They are props now so
 * App.js can supply either the legacy senders or the rosbridge ones
 * (see docs/app-wiring.md):
 *  - onDig(): start Dig autonomy   (legacy actionType 1)
 *  - onDump(): start Dump autonomy (legacy actionType 2)
 *  - onStop(): e-stop              (legacy actionType 3)
 * Dig/Dump stay gated on espWorking here; Stop is never gated.
 */
function RightButtonPanel({ currentActionState, backArmActive, espWorking, onDig, onDump, onStop }) {

const doFunction = label => { 
  if (espWorking) {
    if (label.toLowerCase() === 'dig auto')   onDig();
    else if (label.toLowerCase() === 'dump auto')   onDump();
    
  } 
  if (label.toLowerCase() === 'stop')   {
    onStop();
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
          {currentActionState == 3 ? (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop-feedback' onClick = {() => doFunction('STOP')}></CommandButton>
          ) : (
            <CommandButton key = 'STOP' label = 'STOP' className = 'command-button-sstop' onClick = {() => doFunction('STOP')}></CommandButton>
          )}
        </div>
        <div className='drive-panel-other-col'>
          
          {currentActionState == 1 ? (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto-feedback' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          ) : (
            <CommandButton key = 'Dig Auto' label = 'Dig Auto' className = 'command-button-digauto' onClick = {() => doFunction('Dig Auto')}></CommandButton>
          )}
          {currentActionState == 2 ? (
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