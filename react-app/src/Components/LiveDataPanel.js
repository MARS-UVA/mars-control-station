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
          <div className="chart-space"><Chart dataKey="value1" />Motor 1: {round(lastDataPoint["value1"])}</div>
          <div className="chart-space"><Chart dataKey="value2" />Motor 2: {round(lastDataPoint["value2"])}</div>
          <div className="chart-space"><Chart dataKey="value3" />Motor 3: {round(lastDataPoint["value3"])}</div>
          <div className="chart-space"><Chart dataKey="value4" />Motor 4: {round(lastDataPoint["value4"])}</div>
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
