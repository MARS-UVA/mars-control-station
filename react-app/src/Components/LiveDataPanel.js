import React, { useMemo, memo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend, Tooltip } from "recharts";
import TiltMeter from "./TiltMeter";

// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const degToRad = deg => deg * (Math.PI / 180);

  const actuatorToDrum = num => ((12.0625 * Math.sin(degToRad(142.920267719) - Math.acos((Math.pow((23.6224274544 + (12 * (1-num))), 2) - 737.506048128) / (-643.804738952)))) - (2.015 * Math.cos(degToRad(142.920267719) - Math.acos((Math.pow((23.6224274544 + (12 * (1-num))), 2) - 737.506048128) / (-643.804738952)))) - 1.75);

  const renderChart = (dataKey) => (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis label={/*dataKey === "actuatorCapacity" ? "%" :*/ dataKey === "globalDataRate" ? "Mbps" : "Value"} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px', fontSize: '15px' }} height={26} />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} name={dataKey === "globalDataRate" ? "Data Rate (Mbps)" : dataKey} />
      </LineChart>
    </ResponsiveContainer>
  );

  const dataKeyToLabel = {
    "wheel-current": "A",
    "drum-current": "A",
    "temperature": "°C",
    "position": "Pos",
    "battery-voltage": "V",
  };

  const renderMultiChart = (dataKey) => (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ right: 20, top: 5, bottom: 5 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" height={20} tick={false} />
        <YAxis width={40} label={{ value: dataKeyToLabel[dataKey], angle: -90, position: "insideLeft" }} domain={["wheel-current", "drum-current"].includes(dataKey) ? [0, 20] : [0, 'dataMax']} />
        <Tooltip />
        <Legend wrapperStyle={{ paddingTop: '5px', fontSize: '15px' }} height={26} />
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
          </>
        )}
        {dataKey === "drum-current" && (
          <>
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

  const voltageToColors = (voltage, warningVoltage, minimumVoltage) => {
    if (voltage >= warningVoltage) return {
      backgroundColor: "#4caf50", // Green
      color: "#ffffff" // White text
    };
    if (voltage >= minimumVoltage) return {
      backgroundColor: "#ff9800", // Orange
      color: "#ffffff" // White text
    };
    return {
      backgroundColor: "#f44336", // Red
      color: "#ffffff" // White text
    };
  }

  const temperatureToColors = (temperature) => {
    if (temperature < 60) return {
      backgroundColor: "#4caf50", // Green
      color: "#ffffff" // White text
    };
    if (temperature < 80) return {
      backgroundColor: "#ff9800", // Orange
      color: "#ffffff" // White text
    };
    return {
      backgroundColor: "#f44336", // Red
      color: "#ffffff" // White text
    };
  }

  // Render the component UI
  return (
    <>
      <div className="panel">
        {/* <h2 className="panel-title">Live Data Panel</h2> */}
        {/* <h3 className="panel-title">Charts</h3> */}
        <div className="chart-grid">
          <div className="chart-space">

            <h3>Battery Voltage</h3>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", margin: "10px 0", gap: "10px" }}>
              {
                [
                  {
                    key: "Main Battery Voltage",
                    maximumVoltage: 16.6,
                    warningVoltage: 14.8,
                    minimumVoltage: 13.1,
                    voltage: lastDataPoint.main_battery_voltage,
                  }, {
                    key: "Aux Battery Voltage",
                    maximumVoltage: 12.8,
                    warningVoltage: 11.1,
                    minimumVoltage: 9.8,
                    voltage: lastDataPoint.aux_battery_voltage,
                  }
                ].map((item, index) => (
                  <div key={index} style={{ ...voltageToColors(item.voltage, item.warningVoltage, item.minimumVoltage), width: "100%", marginBottom: "4px", padding: "0.5rem", borderRadius: "8px" }}>
                    <div style={{ padding: "4px", borderRadius: "4px", fontWeight: "bold" }}>
                      {item.key}
                    </div>
                    <div style={{ margin: "4px 0", fontSize: "18px" }}>
                      {round(item.voltage)} V ({round(item.voltage / item.maximumVoltage * 100)}%)
                    </div>
                  </div>
                ))
              }
            </div>
            {/* Current: {lastDataPoint["globalDataRate"]} Mbps */}
          </div>
          <div className="chart-space">
            <h3>Temperatures (°C)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              {
                [
                  {
                    key: "FL Wheel",
                    temperature: lastDataPoint.front_left_wheel_temperature,

                  },
                  {
                    key: "FR Wheel",
                    temperature: lastDataPoint.front_right_wheel_temperature,
                  },
                  {
                    key: "F Drum",
                    temperature: lastDataPoint.front_drum_temperature,
                  },
                  {
                    key: "BL Wheel",
                    temperature: lastDataPoint.back_left_wheel_temperature,
                  },
                  {
                    key: "BR Wheel",
                    temperature: lastDataPoint.back_right_wheel_temperature,
                  },
                  {
                    key: "B Drum",
                    temperature: lastDataPoint.back_drum_temperature,
                  }
                ].map((temp, index) => {
                  const { backgroundColor, color } = temperatureToColors(temp.temperature);
                  return (
                    <div key={index} style={{ marginBottom: "4px", padding: "0.5rem", borderRadius: "8px", backgroundColor, color }}>
                      <div style={{ padding: "4px", borderRadius: "4px", fontWeight: "bold" }}>
                        {temp.key}
                      </div>
                      <div style={{ margin: "4px 0", fontSize: "18px" }}>
                        {round(temp.temperature)} °C
                      </div>
                    </div>
                  );
                })
              }
            </div>
            {/* {renderMultiChart("temperature")} */}
          </div>
          {/* <div className="chart-space">
            <h3>Actuator Positions</h3>
            {renderMultiChart("position")}
          </div> */}
          <div className="chart-space">

            <h3>Actuator Positions</h3>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", margin: "10px 0", gap: "10px" }}>
              {
                [
                  {
                    key: "Front Actuator",
                    position: lastDataPoint.front_actuator_position,
                  }, {
                    key: "Back Actuator",
                    position: lastDataPoint.back_actuator_position,
                  }
                ].map((item, index) => (
                  <div key={index} style={{ backgroundColor: "#f44336", color: "#ffffff", width: "100%", marginBottom: "4px", padding: "0.5rem", borderRadius: "8px" }}>
                    <div style={{ padding: "4px", borderRadius: "4px", fontWeight: "bold" }}>
                      {item.key}
                    </div>
                    <div style={{ margin: "4px 0", fontSize: "18px" }}>
                      {round(actuatorToDrum(item.position))} in (Raw: {round(item.position)})
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="chart-space">
              <h3>Wheel Currents (A)</h3>
              {renderMultiChart("wheel-current")}
            </div>
            <div className="chart-space">
              <h3>Drum Currents (A)</h3>
              {renderMultiChart("drum-current")}
            </div>
            {/* Current: {lastDataPoint["globalDataRate"]} Mbps */}
          </div>

        </div>
      </div>
    </>
  );
}

export default memo(LiveDataPanel);
