import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import TiltMeter from "./TiltMeter";


// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const maxValue = Math.max(...chartData.map(data => Math.max(data.leftFrontWheel, data.rightFrontWheel, data.leftBackWheel, data.rightBackWheel, data.leftBucketDrum, data.rightBucketDrum, data.actuatorCapacity, data.actuatorHeight)));
  const Chart = ({ dataKey }) => (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={chartData} margin={{ left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" ran/>
        <YAxis label={dataKey === "actuatorCapacity" ? "%" : dataKey === "actuatorHeight" ? "cm" : dataKey === "globalDataRate" ? "Mbps" :"Value"} />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} />
        {/* <ReferenceLine y={maxValue} stroke="red" strokeWidth={1} /> */}
      </LineChart>
    </ResponsiveContainer>
  );

  const MultiChart = ({ dataKey }) => (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />

        <XAxis dataKey="time" ran/>
        <YAxis label={{ value: "A", angle: -90, position: "insideLeft" }} />
        {dataKey === "wheels" && (
          <>
            <Line type="monotone" dataKey="leftFrontWheel" stroke="#fc2803" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="rightFrontWheel" stroke="#03fc2c" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="leftBackWheel" stroke="#031cfc" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="rightBackWheel" stroke="#fc03ba" dot={false} isAnimationActive={false} />
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

  
  const Lever = ({ value }) => (
    <ResponsiveContainer Container width="100%" height={100}>
      <div className="lever">
        <div 
          className="lever-fill"
          style={{ height: `${value * 100}%` }}
        />
      </div>

      <div className="lever-value">
        {value.toFixed(1)}
      </div>
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
          <div className="chart-space"><MultiChart dataKey="wheels" />Left Wheels: {round((lastDataPoint["leftFrontWheel"]+lastDataPoint["leftBackWheel"]) / 2)} A, <br></br> Right Wheels: {round((lastDataPoint["rightFrontWheel"]+lastDataPoint["rightBackWheel"])/2)} A</div>
          <div className="chart-space"><MultiChart dataKey="bucketDrum" />Drum Motors: {round((lastDataPoint["leftBucketDrum"]+lastDataPoint["rightBucketDrum"]) / 2)} A</div>
          {/* <div className="chart-space"><Chart dataKey="leftBucketDrum" />Left Bucket Drum Motor: {round(lastDataPoint["leftBucketDrum"])}</div>
          <div className="chart-space"><Chart dataKey="rightBucketDrum" />Right Bucket Drum Motor: {round(lastDataPoint["rightBucketDrum"])}</div> */}
          <div className="chart-space"><Chart dataKey="actuatorCapacity" />Drum Capacity: {round(lastDataPoint["actuatorCapacity"])} %</div>
          <div className="chart-space"><Chart dataKey="actuatorHeight" />Drum Height: {round(lastDataPoint["actuatorHeight"])} cm</div>
          <div className="chart-space"><Chart dataKey="globalDataRate" />Data Rate: {lastDataPoint["globalDataRate"]} Mbps</div>
          <div className="chart-space" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px" }}><TiltMeter angleX={lastDataPoint["xGyro"]} angleY={lastDataPoint["yGyro"]} angleZ={lastDataPoint["zGyro"]}/></div>
        </div>

        <div className="lever-grid">
          <div className="lever-space"><Lever value={lastDataPoint["value1"] / 100} label={`Motor 5: ${round(lastDataPoint["value1"])}`} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value1"] / 100} label={`Motor 5: ${round(lastDataPoint["value1"])}`} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value1"] / 100} label={`Motor 5: ${round(lastDataPoint["value1"])}`} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value1"] / 100} label={`Motor 5: ${round(lastDataPoint["value1"])}`} /></div>
        </div>

        {/* <div className="lever-grid">
          <div className="lever-space"><Lever value={lastDataPoint["value1"] / 100} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value2"] / 100} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value3"] / 100} /></div>
          <div className="lever-space"><Lever value={lastDataPoint["value3"] / 100} /></div>
        </div> */}

      </div>
    </>
  );
}

export default LiveDataPanel;
