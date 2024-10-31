import React, {useState, useEffect} from "react";

import "./App.css";
import LiveDataPanel from "./Components/LiveDataPanel";
import GamepadPanel from "./Components/GamepadPanel";
import DriveStatePanel from "./Components/DriveStatePanel";
import WebcamPanel from "./Components/WebcamPanel";
import Socket from "./Components/Socket";
import SingleLiveDataStream from "./Components/SingleLiveDataStream";

const App = () => {

  
  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');

  
  const [timestamp, setTimestamp] = useState(0);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({
    
    time: i,
    value1: Math.random() * 100,
    value2: Math.random() * 100,
    value3: Math.random() * 100,
    value4: Math.random() * 100,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);
  const [iluvbrian, setBrian] = useState("goat");

  

  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}
      <Socket setGamePadStatus={setGamepadStatus} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setBrian={setBrian}/>


      <div className="content">
        <div className="left-panel">
          <GamepadPanel gamepadStatus={gamepadStatus}/>

          <DriveStatePanel />

          <div className="content">
            <SingleLiveDataStream dataStreamName={"oofs"} currentVal={2}/>
            <SingleLiveDataStream dataStreamName={"yay"} currentVal={3}/>
            <SingleLiveDataStream dataStreamName={"iluvbrian"} currentVal={iluvbrian}/>
          </div>

        </div>

        <div className="right-panel">
          <LiveDataPanel lastDataPoint={lastDataPoint} timestamp={timestamp} chartData={chartData}/>
          <WebcamPanel/>
        </div>
      </div>
    </div>
  );
};

export default App;
