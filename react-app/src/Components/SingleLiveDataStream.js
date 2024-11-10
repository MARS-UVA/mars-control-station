import React from "react";


// This component renders a small UI panel with a single piece of data
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
