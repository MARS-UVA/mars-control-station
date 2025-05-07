import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";


// This component renders a panel with charts and live values
function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = num => (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);

  const maxValue = Math.max(...chartData.map(data => Math.max(data.value1, data.value2, data.value3, data.value4)));
  const Chart = ({ dataKey }) => (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={chartData}>
        <XAxis dataKey="time" ran/>
        <YAxis />
        <Line type="monotone" dataKey={dataKey} stroke="#8884d8" dot={false} isAnimationActive={false} />
        {/* <ReferenceLine y={maxValue} stroke="red" strokeWidth={1} /> */}
      </LineChart>
    </ResponsiveContainer>
  );

  
  const Lever = ({ value }) => (
    <ResponsiveContainer Container width="100%">

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
          <div className="chart-space"><Chart dataKey="FrontLeft" />Front Left: {round(lastDataPoint["FrontLeft"])}</div>
          <div className="chart-space"><Chart dataKey="FrontRight" />Front Right: {round(lastDataPoint["FrontRight"])}</div>
          <div className="chart-space"><Chart dataKey="BackLeft" />Back Left: {round(lastDataPoint["BackLeft"])}</div>
          <div className="chart-space"><Chart dataKey="BackRight" />Back Right: {round(lastDataPoint["BackRight"])}</div>
          <div className="chart-space"><Chart dataKey="LeftDrum" />Left Drum: {round(lastDataPoint["LeftDrum"])}</div>
          <div className="chart-space"><Chart dataKey="RightDrum" />Right Drum: {round(lastDataPoint["RightDrum"])}</div>
          <div className="chart-space"><Chart dataKey="LeftActuator" />Left Actuator: {round(lastDataPoint["LeftActuator"])}</div>
          <div className="chart-space"><Chart dataKey="RightActuator" />Right Actuator: {round(lastDataPoint["RightActuator"])}</div>
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
