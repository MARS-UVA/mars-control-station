/*
Left side of current control station
none of the buttons work and need to 
implement in DriveStatePanel
*/

import React, { useState, useEffect } from "react";
import SingleLiveDataStream from "./SingleLiveDataStream";

const ActuatorDataDisplay = ({lastDataPoint}) => {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const [direction, setDirection] = useState("DIG"); // Initial state for direction

const actuatorButtonWidth = 105; // Position and style values for the actuator buttons
const actuatorButtonX = 30;

const actuatorDisplayX = 170; // Position and style values for the actuator value displays
const actuatorDisplayWidth = 220; 
const actuatorDisplayHeight = 33;

const drumButtonX = 30; // Position and style values for the drum buttons
const drumButtonWidth = 105;

const drumDisplayX = 150; // Position and style values for the drum value displays
const drumDisplayWidth = 70;
const drumDisplayHeight = 95;


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
  /*const getDirectionColor = (direction) => {
    switch (direction) {
      case "DIG":
        return "lightgreen";
      case "DUMP":
        return "lightblue";
      default:
        return "white"; 
    }
  };*/

  return (
    <div className="actuator-data-display">
      {/* Bucket Drum Section */}
      <div className="actuator-section">
        <h3
          style={{ position: "fixed", left: 35, top: 475 + 70 }}>

          Bucket Drum</h3>
        <div className="actuator-data">
          <div
            // className="data-stream-panel"
            // style={{ position: "fixed", top: 700, left: drumButtonX, displayWidth: drumDisplayWidth, displayHeight: drumDisplayHeight, backgroundColor: getDirectionColor(direction) }}
          >
            {/* <p className="data-stream-name">{"Spin"}</p> */}
            {/* <p className="data-stream-value">{direction}</p> */}
          </div>
          <SingleLiveDataStream dataStreamName="Capacity" currentVal={round(lastDataPoint["actuatorCapacity"])}  topCoord={535 + 70} leftCoord={drumDisplayX} displayWidth={drumDisplayWidth} displayHeight={drumDisplayHeight}  />
          <SingleLiveDataStream dataStreamName="Current" currentVal="12" topCoord={535 + 70}  leftCoord={drumDisplayX + 100} displayWidth={drumDisplayWidth} displayHeight={drumDisplayHeight}  />
          <SingleLiveDataStream dataStreamName="Spin" currentVal={direction} topCoord={535 + 70}  leftCoord={drumDisplayX + 200} displayWidth={drumDisplayWidth} displayHeight={drumDisplayHeight}  />
        </div>
        {/* Buttons for Bucket Drum */}
        <div className="actuator-buttons">
          <button
            className="actuator-button-dig"
            style={{ position: "fixed", top: 525 + 70 , left: drumButtonX, width: drumButtonWidth}}
          >
          <strong>DIG</strong>
          </button>
          <button
            className="actuator-button-dump"
            style={{ position: "fixed", top: 570 + 70, left: drumButtonX, width: drumButtonWidth}}
          >
            <strong>DUMP</strong>
          </button>
          <button
            className="actuator-button-stop"
            style={{ position: "fixed", top: 615 + 70, left: drumButtonX, width: drumButtonWidth}}
          >
            <strong> STOP </strong>
          </button>
        </div>
      </div>

      {/* Track Actuator Section */}
      <div className="actuator-section">
        <h3
         style={{ position: "fixed", left: 35, top: 650 + 70 }}
        >Track Actuator</h3>
        <div className="actuator-data">
          <SingleLiveDataStream dataStreamName="Height (in): " currentVal="5" leftCoord={actuatorDisplayX} topCoord={710 + 70} displayWidth={actuatorDisplayWidth} displayHeight={actuatorDisplayHeight}/>
          <SingleLiveDataStream dataStreamName="Current (A): " currentVal="15" leftCoord={actuatorDisplayX} topCoord={775 + 70} displayWidth={actuatorDisplayWidth} displayHeight={actuatorDisplayHeight} />
        </div>
        {/* Buttons for Track Actuator */}
        <div className="actuator-buttons">
          <button
            className="actuator-button-dig2"
            style={{ position: "fixed", width: actuatorButtonWidth, left: actuatorButtonX, top: 700 +  70}}
          >
            <strong>DIG</strong>
          </button>
          <button
            className="actuator-button-mid"
            style={{ position: "fixed", width: actuatorButtonWidth, left: actuatorButtonX, top: 745 + 70 }}
          >
            <strong>MID</strong>
          </button>
          <button
            className="actuator-button-top"
            style={{ position: "fixed", width: actuatorButtonWidth, left: actuatorButtonX, top: 790 + 70 }}
          >
            <strong>TOP</strong>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActuatorDataDisplay;