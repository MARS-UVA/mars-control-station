import React, { useState, useEffect } from "react";
import { Activity, Wifi, Clock } from "lucide-react";

function StatusBar({ gamepadStatus, robotState }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const gamepadConnected = gamepadStatus && !gamepadStatus.toLowerCase().includes("no gamepad");

  const robotStateLabel = {
    0: "IDLE",
    1: "DIG AUTO",
    2: "DUMP AUTO",
    3: "STOP",
  }[robotState] || "IDLE";

  const robotStateClass = {
    0: "status-pill--idle",
    1: "status-pill--active",
    2: "status-pill--active",
    3: "status-pill--danger",
  }[robotState] || "status-pill--idle";

  const formatTime = (d) =>
    d.toLocaleTimeString("en-US", { hour12: false });

  return (
    <header className="status-bar">
      <div className="status-bar__brand">
        <div className="status-bar__logo">
          <span className="status-bar__logo-mark">M</span>
        </div>
        <div className="status-bar__title">
          <div className="status-bar__title-main">MARS</div>
          <div className="status-bar__title-sub">Control Station</div>
        </div>
      </div>

      <div className="status-bar__center">
        <div className={`status-pill ${robotStateClass}`}>
          <Activity size={12} />
          <span>{robotStateLabel}</span>
        </div>
        <div className={`status-pill ${gamepadConnected ? "status-pill--active" : "status-pill--idle"}`}>
          <Wifi size={12} />
          <span>{gamepadConnected ? "GAMEPAD" : "NO GAMEPAD"}</span>
        </div>
      </div>

      <div className="status-bar__right">
        <div className="status-bar__clock">
          <Clock size={12} />
          <span>{formatTime(now)}</span>
        </div>
      </div>
    </header>
  );
}

export default StatusBar;
