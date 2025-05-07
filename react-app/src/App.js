/*
Renders dashboard with gamepad status, drive state, live data, and webcam feed
Updates through socket connection
*/

import React, {useState, useEffect} from "react";

import "./App.css";
import LiveDataPanel from "./Components/LiveDataPanel";
import GamepadPanel from "./Components/GamepadPanel";
import DriveStatePanel from "./Components/DriveStatePanel";
import WebcamPanel from "./Components/WebcamPanel";
import SocketHandler from "./Components/SocketHandler";
import SingleLiveDataStream from "./Components/SingleLiveDataStream";
import ActuatorDataDisplay from "./Components/ActuatorDataDisplay";

import { useHotkeys } from 'react-hotkeys-hook';


const App = () => {

  
  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  const [driveState, setDriveState] = useState('Idle');

  
  const [timestamp, setTimestamp] = useState(0);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({
    
    time: i,
    value1: Math.random() * 100,
    value2: Math.random() * 100,
    value3: Math.random() * 100,
    value4: Math.random() * 100,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);
  const [valueData, setData] = useState("data");

  function handleESTOP () {
    //handle ESTOP press
  }

  function handleAStopHotkey () {
    if (driveState == "Autonomous Drive") {handleAutonomousStop()}
  }

  function handleAutonomousStop () {
    //handle immediate switching out of autonomous drive 
    setDriveState("Direct Drive")
  }

  useHotkeys('space', handleAStopHotkey );

  

  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}
      <SocketHandler setGamePadStatus={setGamepadStatus} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setData={setData}/>


      <div className="content">
        <div className="left-panel">
          <GamepadPanel gamepadStatus={gamepadStatus} driveState={driveState}/>

          <DriveStatePanel driveState={driveState} setDriveState={setDriveState} handleESTOP={handleESTOP} handleAutonomousStop={handleAutonomousStop}/>

          <ActuatorDataDisplay />
        </div>

        <div className="middle-panel">
          <WebcamPanel id="0"/>
          <WebcamPanel id="4"/>
        </div>

        <div className="right-panel">
          <LiveDataPanel lastDataPoint={lastDataPoint} timestamp={timestamp} chartData={chartData}/>
        </div>
      </div>
    </div>
  );
};

export default App;
