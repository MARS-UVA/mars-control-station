import React, {useState, useEffect} from "react";

import "./App.css";
import LiveDataPanel from "./Components/LiveDataPanel";
import GamepadPanel from "./Components/GamepadPanel";
import DriveStatePanel from "./Components/DriveStatePanel";
import WebcamPanel from "./Components/WebcamPanel";

const App = () => {

  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');

  useEffect(() => {
    const handleGamepadConnected = (e) => {
      setGamepadStatus(`Gamepad connected!: ${e.gamepad.id}`);
    };

    const handleGamepadDisconnected = () => {
      setGamepadStatus('No gamepad connected!');
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  const [timestamp, setTimestamp] = useState(1);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({
    
    time: i,
    value1: Math.random() * 100,
    value2: Math.random() * 100,
    value3: Math.random() * 100,
    value4: Math.random() * 100,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);

  useEffect(() => {

    const addNewData = () => {
      const newData = (l)=>{ return {
        time: l, // The next index as time
        value1: Math.random() * 100,
        value2: Math.random() * 100,
        value3: Math.random() * 100,
        value4: Math.random() * 100,
      }}
  
      // Set the new array (using the spread operator to create a new array)
      setChartData((prevData) => {
        let newDataPoint = newData(timestamp)
        setLastDataPoint(newDataPoint)
        setTimestamp((prevTime) => prevTime + 1)
        const newDataArray = [...prevData, newDataPoint];
        // Keep only the most recent 10 seconds of data
        return newDataArray.slice(-30);
      });
    };


    const interval = setInterval(addNewData, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}


      <div className="content">
        <div className="left-panel">
          <GamepadPanel gamepadStatus={gamepadStatus}/>

          <DriveStatePanel />
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
