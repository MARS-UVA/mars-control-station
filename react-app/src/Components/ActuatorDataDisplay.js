import React, { useState, useEffect } from "react";
import SingleLiveDataStream from "./SingleLiveDataStream";

function ActuatorDataDisplay({lastDataPoint}) {
  const [direction, setDirection] = useState("DIG"); // Initial state for direction
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  // Function to randomly cycle through DIG, DUMP, and IDLE
  useEffect(() => {
    const directions = ["DIG", "DUMP", "IDLE"];
    const interval = setInterval(() => {
      const randomDirection = directions[Math.floor(Math.random() * directions.length)];
      setDirection(randomDirection);
    }, 1000); // Change state every 2 seconds

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, []);

  // Determine background color based on the direction
  const getDirectionColor = (direction) => {
    switch (direction) {
      case "DIG":
        return "lightgreen";
      case "DUMP":
        return "lightblue";
      default:
        return "white";
    }
  };

  return (
    <div className="actuator-data-display">
      {/* Bucket Drum Section */}
      <div className="actuator-section">
        <h3>Bucket Drum</h3>
        <div className="actuator-data">
          <div
            className="data-stream-panel"
            style={{ backgroundColor: getDirectionColor(direction) }}
          >
            <p className="data-stream-name">{"Spin"}</p>
            <p className="data-stream-value">{direction}</p>
          </div>
          <SingleLiveDataStream dataStreamName="Capacity" currentVal="75%" />
          <SingleLiveDataStream dataStreamName="Current" currentVal="12" />
        </div>
        {/* Buttons for Bucket Drum */}
        <div className="actuator-buttons">
          <button
            className="actuator-button"
            style={{ backgroundColor: "lightgreen", color: "black" }}
          >
            DIG
          </button>
          <button
            className="actuator-button"
            style={{ backgroundColor: "lightblue", color: "Black" }}
          >
            DUMP
          </button>
          <button
            className="actuator-button"
            style={{ backgroundColor: "lightcoral", color: "white" }}
          >
            STOP
          </button>
        </div>
      </div>

      {/* Track Actuator Section */}
      <div className="actuator-section">
        <h3>Track Actuator</h3>
        <div className="actuator-data">
          <SingleLiveDataStream dataStreamName="Height (in)" currentVal={round(lastDataPoint["ActuatorHeight"])} />
          <SingleLiveDataStream dataStreamName="Current (A)" currentVal= "15" />
        </div>
        {/* Buttons for Track Actuator */}
        <div className="actuator-buttons">
          <button
            className="actuator-button"
            style={{ backgroundColor: "#ff9999", color: "white" }} // Slightly red
          >
            DIG
          </button>
          <button
            className="actuator-button"
          >
            MID
          </button>
          <button
            className="actuator-button"
          >
            TOP
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActuatorDataDisplay;