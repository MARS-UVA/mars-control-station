import React from "react";
import { calculateDrumKinematics } from "./drumKinematics";
import "./DrumVisualizer.css";

const SVG_SCALE = 4;
const PIVOT_Y = 102;

const formatValue = (value) => (
  Number.isFinite(value) ? value.toFixed(1) : "--"
);

function DrumVisualizer({ frontActuatorPosition, rearActuatorPosition }) {
  const drums = [
    {
      key: "front",
      label: "Front drum",
      color: "#3182ce",
      position: calculateDrumKinematics(frontActuatorPosition),
      pivotX: 148,
      direction: -1,
    },
    {
      key: "rear",
      label: "Rear drum",
      color: "#e47717",
      position: calculateDrumKinematics(rearActuatorPosition),
      pivotX: 312,
      direction: 1,
    },
  ];

  return (
    <section className="drum-visualizer" aria-label="Live drum position visualizer">
      <div className="drum-visualizer-heading">
        <h2>Drum position</h2>
        <span>Side view · calculated from actuator feedback</span>
      </div>

      <svg
        className="drum-visualizer-diagram"
        viewBox="0 0 460 190"
        role="img"
        aria-label="Side view of the robot showing the front and rear drum arm positions"
      >
        <line x1="30" y1="163" x2="430" y2="163" className="drum-ground" />

        {drums.map(({ key, color, position, pivotX, direction }) => {
          if (!position) return null;

          const drumX = pivotX
            + direction * Math.abs(position.horizontalOffsetInches) * SVG_SCALE;
          const drumY = PIVOT_Y - position.verticalOffsetInches * SVG_SCALE;
          const armAngle = Math.atan2(drumY - PIVOT_Y, drumX - pivotX);
          const arcRadius = 27;
          const arcEndX = pivotX + arcRadius * Math.cos(armAngle);
          const arcEndY = PIVOT_Y + arcRadius * Math.sin(armAngle);
          const arcSweep = direction === -1 ? 0 : 1;

          return (
            <g key={key}>
              <line
                x1={pivotX}
                y1={PIVOT_Y}
                x2={drumX}
                y2={drumY}
                className="drum-arm"
                stroke={color}
              />
              <path
                d={`M ${pivotX + direction * arcRadius} ${PIVOT_Y} A ${arcRadius} ${arcRadius} 0 0 ${arcSweep} ${arcEndX} ${arcEndY}`}
                className="drum-angle-arc"
                stroke={color}
              />
              <g transform={`translate(${drumX} ${drumY})`}>
                <circle r="24" className="drum-wheel" stroke={color} />
                <circle r="17" className="drum-inner-ring" stroke={color} />
                <line x1="-13" y1="0" x2="13" y2="0" className="drum-spoke" />
                <line x1="0" y1="-13" x2="0" y2="13" className="drum-spoke" />
                <circle r="4" className="drum-axle" fill={color} />
              </g>
            </g>
          );
        })}

        <g className="drum-robot-body">
          <rect x="134" y="76" width="192" height="39" rx="5" />
          <line x1="148" y1="89" x2="312" y2="89" className="drum-chassis-rail" />
          <circle cx="148" cy={PIVOT_Y} r="5" className="drum-pivot" />
          <circle cx="312" cy={PIVOT_Y} r="5" className="drum-pivot" />
        </g>

        <g className="drum-robot-wheels">
          <circle cx="169" cy="139" r="18" />
          <circle cx="291" cy="139" r="18" />
          <circle cx="169" cy="139" r="6" />
          <circle cx="291" cy="139" r="6" />
        </g>
      </svg>

      <div className="drum-visualizer-readings">
        {drums.map(({ key, label, color, position }) => (
          <div className="drum-reading" key={key}>
            <span className="drum-reading-label">
              <i style={{ backgroundColor: color }} />
              {label}
            </span>
            <span className="drum-reading-values">
              {formatValue(position?.angleDegrees)}° · {formatValue(position?.verticalOffsetInches)} in
            </span>
          </div>
        ))}
      </div>
      {drums.some(({ position }) => !position) && (
        <p className="drum-visualizer-status">Waiting for valid actuator feedback</p>
      )}
    </section>
  );
}

export default DrumVisualizer;
