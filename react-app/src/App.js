/*
Renders dashboard with gamepad status, drive state, live data, and webcam feed
Updates through socket connection
*/

import React, {useState, useEffect} from "react";
import Draggable from "react-draggable";

import "./themes.css";
import "./App.css";
import LiveDataPanel from "./Components/LiveDataPanel";
import GamepadPanel from "./gamepad/GamepadPanel";
import DriveStatePanel from "./Components/DriveStatePanel";
import WebcamPanel from "./Components/WebcamPanel";
import Socket from "./Components/Socket";
import SingleLiveDataStream from "./Components/SingleLiveDataStream";
import ActuatorDataDisplay from "./Components/ActuatorDataDisplay";
import Timer from "./Components/Timer";
import ThemeChanger from "./Components/ThemeChanger";
import TiltingRods from "./Components/TiltingRods";

const App = () => {

  
  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  const [gamepadData, setGamepadData] = useState(null);
  const [driveState, setDriveState] = useState('Idle');

  
  const [timestamp, setTimestamp] = useState(0);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({
    
    time: i,
    leftFrontWheel: Math.random() * 100,
    rightFrontWheel: Math.random() * 100,
    leftBackWheel: Math.random() * 100,
    rightBackWheel: Math.random() * 100,
    leftBucketDrum: Math.random() * 100,
    rightBucketDrum: Math.random() * 100,
    actuatorCapacity: Math.random() * 100,
    actuatorHeight: Math.random() * 100,
    globalDataRate: Math.random() * 100,
    xGyro: 0.0,
    yGyro: 0.0,
    zGyro: 0.0,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);
  const [valueData, setData] = useState("data");

  

  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}
      <Socket setGamePadStatus={setGamepadStatus} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setData={setData}/>


      <div className="content">
        <div className="left-panel">
          <GamepadPanel gamepadStatus={gamepadStatus} setGamepadStatus={setGamepadStatus} gamepadData={gamepadData} setGamepadData={setGamepadData}/>

          <DriveStatePanel />

          <ActuatorDataDisplay lastDataPoint={lastDataPoint}/>
        </div>

        <div className="middle-panel">
          <WebcamPanel index="0" gamepadData={gamepadData}/>
          <WebcamPanel index="4" gamepadData={null}/>
        </div>

        <div className="right-panel">
          <LiveDataPanel lastDataPoint={lastDataPoint} timestamp={timestamp} chartData={chartData}/>
          <TiltingRods/>
        </div>
        <Draggable>
          <Timer/>
        </Draggable>
        
        <ThemeChanger/>
      </div>
    </div>
  );
};

export default App;
