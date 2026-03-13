import { useMemo, useState, useEffect } from "react";
import fillSquare from "../assets/whitesquare.svg";
import { Bold, Italic } from "lucide-react";


export default function DisplayMeter({ // Healthbar-like meter to display percentage/capacity based values
  current,
  total,
  left = 20,
  top = 20,
  width = 220,
  height = 18,
  label = "poop",
  showText = true,
  zIndex = 1000,
  barColor = "#fff",
}) {
  const pct = useMemo(() => { // values to calculate capacity percentage
    const t = Number(total);
    const c = Number(current);

    if (!Number.isFinite(t) || t <= 0) return 0;
    if (!Number.isFinite(c)) return 0;

    return Math.max(0, Math.min(100, (c / t) * 100));
  }, [current, total]);

  return (
    
    <div className="meter_fill"
       
      style={{
        position: "fixed",
        top,
        width,
        left,
        zIndex,
        fontFamily: "Calibri",
        userSelect: "none",
      }}
    >
      {showText && (
        <div
          style={{
            display: "fixed",
            justifyContent: "space-between",
            fontSize: 16,
            marginBottom: 6,
            opacity: 0.9,
            color: "#000",// unfilled meter
          }}
        >
          <span>{label}:  </span>
          <span>
            {Number.isFinite(Number(current)) ? current : 0}/
            {Number.isFinite(Number(total)) ? total : 0} ({Math.round(pct)}%)
          </span>
        </div>
      )}

      <div
        style={{
          width: "100%",
          height,
          background: "#111",
          border: "2px solid #000",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div 
          style={{
            height: "100%",
            width: `${pct}%`,

            // Bar that fills

            backgroundColor: barColor   , // color of bar*/
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left center",
            backgroundSize: "100% 100%",

            transition: "width 250ms ease-out",
            willChange: "width",
          }}
        />
      </div>
    </div>
  );
}