import React from "react";

// This component renders a small UI panel with a single piece of data
function SingleLiveDataStream({ dataStreamName, currentVal }) {
  return (
    <div className="data-stream-panel">
      <p className="data-stream-name">{dataStreamName}</p>
      <p className="data-stream-value">{currentVal}</p>
    </div>
  );
}

export default SingleLiveDataStream;
