import React, {useMemo, memo, useEffect} from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend, Tooltip } from "recharts";
import TiltMeter from "./TiltMeter";

// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  console.log(chartData);


  const maxValue = Math.max(...chartData.map(data => Math.max(data.front_left_wheel_current, data.front_right_wheel_current, data.back_left_wheel_current, data.back_right_wheel_current, 
    data.front_drum_current, data.back_drum_current, /*data.actuatorCapacity,*/ data.actuatorHeight)));

  const Chart = function ({ dataKey })
   {return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis label={/*dataKey === "actuatorCapacity" ? "%" :*/ dataKey === "globalDataRate" ? "Mbps" :"Value"} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px' }} height={20} />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} name={dataKey === "globalDataRate" ? "Data Rate (Mbps)" : dataKey} />
        {/* <ReferenceLine y={maxValue} stroke="red" strokeWidth={1} /> */}
      </LineChart>
    </ResponsiveContainer>
  );
}


  const MultiChart = function({ dataKey })  { return (
    <ResponsiveContainer width="100%" height={100} debounce={1000}>
      <LineChart data={chartData} margin={{ right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" height={20} />
        <YAxis width={40} label={{ value: dataKey === "wheel-current" ? "A" : dataKey === "temperature" ? "°C" : "Pos", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px' }} height={20} />
        {dataKey === "wheel-current" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_current" stroke="#fc2803" dot={false} isAnimationActive={false} name="FL Wheel" />
            <Line type="monotone" dataKey="front_right_wheel_current" stroke="#03fc2c" dot={false} isAnimationActive={false} name="FR Wheel" />
            <Line type="monotone" dataKey="back_left_wheel_current" stroke="#031cfc" dot={false} isAnimationActive={false} name="BL Wheel" />
            <Line type="monotone" dataKey="back_right_wheel_current" stroke="#fc03ba" dot={false} isAnimationActive={false} name="BR Wheel" />
          </>
        )}
        {dataKey === "bucketDrum" && (
          <>
            <Line type="monotone" dataKey="leftBucketDrum" stroke="#c2bd23" dot={false} isAnimationActive={false} name="Left Bucket Drum" />
            <Line type="monotone" dataKey="rightBucketDrum" stroke="#22e0e0" dot={false} isAnimationActive={false} name="Right Bucket Drum" />
          </>
        )}
        {dataKey === "temperature" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_temperature" stroke="#fc2803" dot={false} isAnimationActive={false} name="FL Wheel" />
            <Line type="monotone" dataKey="front_right_wheel_temperature" stroke="#03fc2c" dot={false} isAnimationActive={false} name="FR Wheel" />
            <Line type="monotone" dataKey="back_left_wheel_temperature" stroke="#031cfc" dot={false} isAnimationActive={false} name="BL Wheel" />
            <Line type="monotone" dataKey="back_right_wheel_temperature" stroke="#fc03ba" dot={false} isAnimationActive={false} name="BR Wheel" />
            <Line type="monotone" dataKey="front_drum_temperature" stroke="#ffa500" dot={false} isAnimationActive={false} name="F Drum" />
            <Line type="monotone" dataKey="back_drum_temperature" stroke="#22e0e0" dot={false} isAnimationActive={false} name="B Drum" />
          </>
        )}
        {dataKey === "position" && (
          <>
            <Line type="monotone" dataKey="front_actuator_position" stroke="#8b4513" dot={false} isAnimationActive={false} name="Front Act." />
            <Line type="monotone" dataKey="back_actuator_position" stroke="#228b22" dot={false} isAnimationActive={false} name="Back Act." />
          </>
        )}
        {/* <ReferenceLine y={maxValue} stroke="red" strokeWidth={1} /> */}
      </LineChart>
    </ResponsiveContainer>
  );
};

  // Ref Hook - useRef for accessing a DOM element or mutable value

  // Render the component UI
  return (
    <>
      <div className="panel">
        {/* <h2 className="panel-title">Live Data Panel</h2> */}
        {/* <h3 className="panel-title">Charts</h3> */}
        <div className="chart-grid">
          <div className="chart-space">
            <h3>Data Rate</h3>
            <Chart dataKey="globalDataRate" />
            Current: {lastDataPoint["globalDataRate"]} Mbps
          </div>
          <div className="chart-space">
            <h3>Wheel Currents (A)</h3>
            <MultiChart dataKey="wheel-current" />
          </div>
          <div className="chart-space">
            <h3>Temperatures (°C)</h3>
            <MultiChart dataKey="temperature" />
          </div>
          <div className="chart-space">
            <h3>Actuator Positions</h3>
            <MultiChart dataKey="position" />
          </div>
          <div className="chart-space" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "120px" }}>
            <TiltMeter angleX={lastDataPoint["xGyro"]} angleY={lastDataPoint["yGyro"]} angleZ={lastDataPoint["zGyro"]}/>
          </div>
        </div>
      </div>
    </>
  );
}

export default LiveDataPanel;
