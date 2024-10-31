import React, { useState, useEffect} from 'react';

// This component renders a panel with a message indicating the gamepad status
function GamepadPanel({gamepadStatus}) {
  // State Hook - useState for managing local state

  
  


  // Render the component UI
  return (
    <div className="panel">
            {/* <h2 className="panel-title">Gamepad Status</h2> */}
            <p className="gamepad-status">{gamepadStatus}</p>
    </div>
  );
}

export default GamepadPanel;
