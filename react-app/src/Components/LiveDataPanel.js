import React, { useMemo, memo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend, Tooltip } from "recharts";
import TiltMeter from "./TiltMeter";

// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const renderChart = (dataKey) => (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis label={/*dataKey === "actuatorCapacity" ? "%" :*/ dataKey === "globalDataRate" ? "Mbps" : "Value"} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px' }} height={20} />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} name={dataKey === "globalDataRate" ? "Data Rate (Mbps)" : dataKey} />
      </LineChart>
    </ResponsiveContainer>
  );

  const dataKeyToLabel = {
    "wheel-current": "A",
    "temperature": "°C",
    "position": "Pos",
    "battery-voltage": "V",
  };

  const renderMultiChart = (dataKey) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ right: 20, top: 5, bottom: 5 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" height={20} />
        <YAxis width={40} label={{ value: dataKeyToLabel[dataKey], angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px' }} height={20} />
        {dataKey === "battery-voltage" && (
          <>
            <Line type="monotone" dataKey="main_battery_voltage" stroke="#ff6b6b" dot={false} isAnimationActive={false} name="Main Batt" strokeWidth={2} />
            <Line type="monotone" dataKey="aux_battery_voltage" stroke="#ffd700" dot={false} isAnimationActive={false} name="Aux Batt" strokeWidth={2} />
          </>
        )}
        {dataKey === "wheel-current" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_current" stroke="#fc2803" dot={false} isAnimationActive={false} name="FL Wheel" />
            <Line type="monotone" dataKey="front_right_wheel_current" stroke="#03fc2c" dot={false} isAnimationActive={false} name="FR Wheel" />
            <Line type="monotone" dataKey="back_left_wheel_current" stroke="#031cfc" dot={false} isAnimationActive={false} name="BL Wheel" />
            <Line type="monotone" dataKey="back_right_wheel_current" stroke="#fc03ba" dot={false} isAnimationActive={false} name="BR Wheel" />
            <Line type="monotone" dataKey="front_drum_current" stroke="#ffa500" dot={false} isAnimationActive={false} name="F Drum" strokeWidth={1.5} />
            <Line type="monotone" dataKey="back_drum_current" stroke="#22e0e0" dot={false} isAnimationActive={false} name="B Drum" strokeWidth={1.5} />
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
      </LineChart>
    </ResponsiveContainer>
  );

  // Ref Hook - useRef for accessing a DOM element or mutable value

  // Render the component UI
  return (
    <>
      <div className="panel">
        {/* <h2 className="panel-title">Live Data Panel</h2> */}
        {/* <h3 className="panel-title">Charts</h3> */}
        <div className="chart-grid">
          <div className="chart-space">
            <h3>Battery Voltage</h3>
            {renderMultiChart("battery-voltage")}
            {/* Current: {lastDataPoint["globalDataRate"]} Mbps */}
          </div>
          <div className="chart-space">
            <h3>Currents (A)</h3>
            {renderMultiChart("wheel-current")}
          </div>
          <div className="chart-space">
            <h3>Temperatures (°C)</h3>
            {renderMultiChart("temperature")}
          </div>
          <div className="chart-space">
            <h3>Actuator Positions</h3>
            {renderMultiChart("position")}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(LiveDataPanel);
