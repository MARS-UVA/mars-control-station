import React from "react";


// This component renders a panel with charts and live values
function SingleLiveDataStream({dataStreamName, currentVal}) {
  

  


  


  return (
    <>
      <div className="panel">
        <p>{dataStreamName}: {currentVal}</p>
      </div>
    </>
  );
}

export default SingleLiveDataStream;
