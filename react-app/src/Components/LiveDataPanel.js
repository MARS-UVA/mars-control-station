import React, {useMemo, memo, useEffect} from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import TiltMeter from "./TiltMeter";

// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);


  const maxValue = Math.max(...chartData.map(data => Math.max(data.front_left_wheel_current, data.front_right_wheel_current, data.back_left_wheel_current, data.back_right_wheel_current, 
    data.front_drum_current, data.back_drum_current, /*data.actuatorCapacity,*/ data.actuatorHeight)));

  const Chart = function ({ dataKey })
   {return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={chartData} margin={{ left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis label={/*dataKey === "actuatorCapacity" ? "%" :*/ dataKey === "globalDataRate" ? "Mbps" :"Value"} />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} />
        {/* <ReferenceLine y={maxValue} stroke="red" strokeWidth={1} /> */}
      </LineChart>
    </ResponsiveContainer>
  );
}


  const MultiChart = function({ dataKey })  { return (
    <ResponsiveContainer width="100%" height={100} debounce={1000}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis dataKey="time" />
        <YAxis label={{ value: "A", angle: -90, position: "insideLeft" }} />
        {dataKey === "wheel-current" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_current" stroke="#fc2803" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="front_right_wheel_current" stroke="#03fc2c" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="back_left_wheel_current" stroke="#031cfc" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="back_right_wheel_current" stroke="#fc03ba" dot={false} isAnimationActive={false} />
          </>
        )}
        {dataKey === "bucketDrum" && (
          <>
            <Line type="monotone" dataKey="leftBucketDrum" stroke="#c2bd23" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="rightBucketDrum" stroke="#22e0e0" dot={false} isAnimationActive={false} />
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
            <Chart dataKey="globalDataRate" />
            Data Rate: {lastDataPoint["globalDataRate"]} Mbps
          </div>
          <div className = "chart-space">
            <MultiChart dataKey = "wheel-current"> Multi Chart </MultiChart>
          </div>
          <div className="chart-space" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px" }}>
            <TiltMeter angleX={lastDataPoint["xGyro"]} angleY={lastDataPoint["yGyro"]} angleZ={lastDataPoint["zGyro"]}/>
          </div>
        </div>
      </div>
    </>
  );
}

export default LiveDataPanel;
