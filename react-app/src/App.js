/*
Renders dashboard with gamepad status, drive state, live data, and webcam feed
Updates through socket connection
*/

import React, { useState, useEffect } from "react";
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
import DisplayMeter from "./Components/DisplayMeter";
import RightButtonPanel from "./Components/RightButtonPanel";
import ArmIndicator from "./gamepad/ArmIndicator";
import DirectionChangeButton from "./Components/DirectionChangeButton";
import { setDirection } from './gamepad/directionStore';

const App = () => {


  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  // const [gamepad2Status, setGamepad2Status] = useState('No gamepad connected!');
  const [gamepadData, setGamepadData] = useState(null);
  const [gamepad2Data, setGamepad2Data] = useState(null);
  const [driveState, setDriveState] = useState('Idle');
  const [camera0Active, setCamera0Active] = useState(true);
  const [camera4Active, setCamera4Active] = useState(true);
  const [frontArmActive, setFrontArmActive] = useState(false);
  const [backArmActive, setBackArmActive] = useState(false);
  const [prevGamepadData, setPrevGamepadData] = useState(null);
  const [robotState, setRobotState] = useState(0);
  const [directionSwitched, setDirectionSwitched] = useState(false);

  useEffect(() => {
    setDirection(directionSwitched);
  }, [directionSwitched]);


  const [timestamp, setTimestamp] = useState(0);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({

    time: i,
    // goon mode? ACTIVATED
    leftFrontWheel: Math.random() * 100,
    rightFrontWheel: Math.random() * 100,
    leftBackWheel: Math.random() * 100,
    rightBackWheel: Math.random() * 100,
    leftBucketDrum: Math.random() * 100,
    rightBucketDrum: Math.random() * 100,
    actuatorCapacity: Math.random() * 100,
    actuatorHeight: Math.random() * 100,
    xGyro: 0.0,
    yGyro: 0.0,
    zGyro: 0.0,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);
  const [valueData, setData] = useState("data");




  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}
      <Socket setGamePadStatus={setGamepadStatus} setRobotState={setRobotState} setFrontArmActive={setFrontArmActive} setBackArmActive={setBackArmActive} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setData={setData} />


      <div className="content">
        <div className="left-panel">
          <GamepadPanel gamepadStatus={gamepadStatus} setGamepadStatus={setGamepadStatus} gamepadData={gamepadData} setGamepadData={setGamepadData} gamepadIndex={0} camera0Active={camera0Active} camera4Active={camera4Active} />
          <ArmIndicator frontArmActive={frontArmActive} backArmActive={backArmActive} label="Arm Control" directionSwitched={directionSwitched} />
          {/* <GamepadPanel gamepadStatus={gamepad2Status} setGamepadStatus={setGamepad2Status} gamepadData={gamepad2Data} setGamepadData={setGamepad2Data} gamepadIndex={1} camera0Active={camera0Active} camera4Active={camera4Active} /> */}
          {/* Hiding the displays that don't do anything currently */}
          {/* <DisplayMeter current={80} total={100} left = {155} top = {580} height = {40} width = {180} label="Current" />  */} {/*ADD THE METHODS OF GETTING THESE VALUES!!*/}
          {/* <DisplayMeter current={80} total={100} left = {155} top = {655} height = {40} width = {180} label="Capacity" /> */}
          {/* <ActuatorDataDisplay lastDataPoint={lastDataPoint}/> */}

          <RightButtonPanel feedback={robotState}></RightButtonPanel>
          <DirectionChangeButton directionSwitched={directionSwitched} setDirectionSwitched={setDirectionSwitched} gamepadData={gamepadData} />
          <Timer />
        </div>

        <div className="middle-panel">
          <WebcamPanel signalingPort="6969" index="4" isActive={!directionSwitched} />
          <WebcamPanel signalingPort="6767" index="0" isActive={directionSwitched} />
        </div>

        <div className="right-panel">
          <LiveDataPanel lastDataPoint={lastDataPoint} timestamp={timestamp} chartData={chartData} />
          {/* <TiltingRods/> hiding since they're incomplete*/}
        </div>
        <ThemeChanger />
      </div>
    </div>
  );
};

export default App;
