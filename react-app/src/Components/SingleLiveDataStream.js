import React from "react";

// This component renders a small UI panel with a single piece of data
function SingleLiveDataStream({ dataStreamName, currentVal, topCoord, leftCoord, displayWidth, displayHeight }) {
  
  const lCoord = displayWidth === 70 ? leftCoord + 15 : leftCoord;
  
  return (
    <div className="data-stream-panel"
    style={{position: "fixed", top: topCoord, left: leftCoord, width: displayWidth, height: displayHeight}}
    >
      <p className="data-stream-name"
       
       
        
    
       style={{position: "fixed", top: topCoord - 2.5, left: lCoord, width: displayWidth, height: displayHeight}}


      >{dataStreamName} <strong>{currentVal}</strong>

        
      </p>
     
      
    </div>
  );
}

export default SingleLiveDataStream;