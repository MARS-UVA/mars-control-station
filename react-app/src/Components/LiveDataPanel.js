import React, { memo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Legend, Tooltip } from "recharts";

const CHART_COLORS = {
  fl: "#c46e1f",
  fr: "#3a5378",
  bl: "#b8772a",
  br: "#5a8aa8",
  fdrum: "#a85555",
  bdrum: "#4d955f",
  mainBatt: "#c46e1f",
  auxBatt: "#3a5378",
  frontAct: "#c46e1f",
  backAct: "#3a5378",
};

function LiveDataPanel({ lastDataPoint, chartData }) {
  const round = (num) => {
    if (!Number.isFinite(num)) return null;
    return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  };

  const dataKeyToLabel = {
    "wheel-current": "A",
    temperature: "°C",
    position: "Pos",
    "battery-voltage": "V",
  };

  const renderMultiChart = (dataKey) => (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ right: 18, top: 10, bottom: 8, left: 0 }} isAnimationActive={false}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color-strong)" vertical={false} />
        <XAxis dataKey="time" height={6} stroke="var(--border-color-strong)" tick={false} />
        <YAxis
          width={44}
          label={{ value: dataKeyToLabel[dataKey], angle: -90, position: "insideLeft", fill: "var(--primary-color)", fontSize: 14, fontWeight: 700, offset: 14 }}
          domain={dataKey === "wheel-current" ? [0, 20] : [0, "dataMax"]}
          stroke="var(--border-color-strong)"
          tick={{ fill: "var(--secondary-color)", fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--panel-bg-color)",
            border: "1px solid var(--border-color-strong)",
            borderRadius: "8px",
            fontSize: "14px",
            color: "var(--primary-color)",
          }}
          labelStyle={{ color: "var(--secondary-color)", fontSize: "13px" }}
        />
        <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "18px", color: "var(--primary-color)", fontWeight: 700 }} height={40} iconSize={20} />
        {dataKey === "battery-voltage" && (
          <>
            <Line type="monotone" dataKey="main_battery_voltage" stroke={CHART_COLORS.mainBatt} dot={false} isAnimationActive={false} name="Main Batt" strokeWidth={2} />
            <Line type="monotone" dataKey="aux_battery_voltage" stroke={CHART_COLORS.auxBatt} dot={false} isAnimationActive={false} name="Aux Batt" strokeWidth={2} />
          </>
        )}
        {dataKey === "wheel-current" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_current" stroke={CHART_COLORS.fl} dot={false} isAnimationActive={false} name="FL" strokeWidth={1.5} />
            <Line type="monotone" dataKey="front_right_wheel_current" stroke={CHART_COLORS.fr} dot={false} isAnimationActive={false} name="FR" strokeWidth={1.5} />
            <Line type="monotone" dataKey="back_left_wheel_current" stroke={CHART_COLORS.bl} dot={false} isAnimationActive={false} name="BL" strokeWidth={1.5} />
            <Line type="monotone" dataKey="back_right_wheel_current" stroke={CHART_COLORS.br} dot={false} isAnimationActive={false} name="BR" strokeWidth={1.5} />
            <Line type="monotone" dataKey="front_drum_current" stroke={CHART_COLORS.fdrum} dot={false} isAnimationActive={false} name="F Drum" strokeWidth={2} />
            <Line type="monotone" dataKey="back_drum_current" stroke={CHART_COLORS.bdrum} dot={false} isAnimationActive={false} name="B Drum" strokeWidth={2} />
          </>
        )}
        {dataKey === "temperature" && (
          <>
            <Line type="monotone" dataKey="front_left_wheel_temperature" stroke={CHART_COLORS.fl} dot={false} isAnimationActive={false} name="FL" />
            <Line type="monotone" dataKey="front_right_wheel_temperature" stroke={CHART_COLORS.fr} dot={false} isAnimationActive={false} name="FR" />
            <Line type="monotone" dataKey="back_left_wheel_temperature" stroke={CHART_COLORS.bl} dot={false} isAnimationActive={false} name="BL" />
            <Line type="monotone" dataKey="back_right_wheel_temperature" stroke={CHART_COLORS.br} dot={false} isAnimationActive={false} name="BR" />
            <Line type="monotone" dataKey="front_drum_temperature" stroke={CHART_COLORS.fdrum} dot={false} isAnimationActive={false} name="F Drum" />
            <Line type="monotone" dataKey="back_drum_temperature" stroke={CHART_COLORS.bdrum} dot={false} isAnimationActive={false} name="B Drum" />
          </>
        )}
        {dataKey === "position" && (
          <>
            <Line type="monotone" dataKey="front_actuator_position" stroke={CHART_COLORS.frontAct} dot={false} isAnimationActive={false} name="Front Act" strokeWidth={2} />
            <Line type="monotone" dataKey="back_actuator_position" stroke={CHART_COLORS.backAct} dot={false} isAnimationActive={false} name="Back Act" strokeWidth={2} />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );

  // Returns a status class instead of inline styles. Handles NaN as 'no data'.
  const voltageStatus = (voltage, warningVoltage, minimumVoltage) => {
    if (!Number.isFinite(voltage)) return "data-card--idle";
    if (voltage >= warningVoltage) return "data-card--success";
    if (voltage >= minimumVoltage) return "data-card--warning";
    return "data-card--danger";
  };

  const temperatureStatus = (temperature) => {
    if (!Number.isFinite(temperature)) return "data-card--idle";
    if (temperature < 60) return "data-card--success";
    if (temperature < 80) return "data-card--warning";
    return "data-card--danger";
  };

  const formatValue = (val, suffix = "") => {
    const r = round(val);
    if (r === null) return <span className="data-card__nodata">—</span>;
    return (
      <>
        {r}
        <span className="data-card__unit">{suffix}</span>
      </>
    );
  };

  const batteries = [
    {
      key: "Main Battery",
      max: 16.6,
      warning: 14.8,
      minimum: 13.1,
      voltage: lastDataPoint.main_battery_voltage,
    },
    {
      key: "Aux Battery",
      max: 12.8,
      warning: 11.1,
      minimum: 9.8,
      voltage: lastDataPoint.aux_battery_voltage,
    },
  ];

  const temperatures = [
    { key: "FL Wheel", temperature: lastDataPoint.front_left_wheel_temperature },
    { key: "FR Wheel", temperature: lastDataPoint.front_right_wheel_temperature },
    { key: "F Drum", temperature: lastDataPoint.front_drum_temperature },
    { key: "BL Wheel", temperature: lastDataPoint.back_left_wheel_temperature },
    { key: "BR Wheel", temperature: lastDataPoint.back_right_wheel_temperature },
    { key: "B Drum", temperature: lastDataPoint.back_drum_temperature },
  ];

  return (
    <div className="panel data-panel">
      <div className="chart-grid">
        <div className="chart-space">
          <h3>Battery Voltage</h3>
          <div className="data-card-grid data-card-grid--2col">
            {batteries.map((b, i) => {
              const pct = Number.isFinite(b.voltage) ? Math.round((b.voltage / b.max) * 100) : null;
              return (
                <div key={i} className={`data-card ${voltageStatus(b.voltage, b.warning, b.minimum)}`}>
                  <div className="data-card__label">{b.key}</div>
                  <div className="data-card__value">{formatValue(b.voltage, " V")}</div>
                  {pct !== null && <div className="data-card__sub">{pct}%</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="chart-space">
          <h3>Temperatures</h3>
          <div className="data-card-grid data-card-grid--3col">
            {temperatures.map((t, i) => (
              <div key={i} className={`data-card data-card--compact ${temperatureStatus(t.temperature)}`}>
                <div className="data-card__label">{t.key}</div>
                <div className="data-card__value">{formatValue(t.temperature, "°C")}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-space">
          <h3>Currents (A)</h3>
          {renderMultiChart("wheel-current")}
        </div>
        <div className="chart-space">
          <h3>Actuator Positions</h3>
          {renderMultiChart("position")}
        </div>
      </div>
    </div>
  );
}

export default memo(LiveDataPanel);
