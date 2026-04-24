import React, { useState, useEffect, useRef } from 'react';


const Timer = () => {
  const [time, setTime] = useState(0); // Time in milliseconds
  const [currentLapTime, setLapTime] = useState(0);
  const [laps, setLaps] = useState([]);
  const [isActive, setIsActive] = useState(false);

  const lapStartTimeRef = useRef(0);

  function toggle() {
    setIsActive(!isActive);
  }

  function reset() {
    setTime(0);
    setLapTime(0);
    setIsActive(false);
    lapStartTimeRef.current = 0;
    setLaps([]);
  }

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setTime((prevTime) => {
          const newTime = prevTime + 100;
          setLapTime(newTime - lapStartTimeRef.current);
          return newTime;
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (time) => {
    const totalSeconds = Math.floor(time / 1000)
    const seconds = ("0" + (totalSeconds % 60)).slice(-2);
    const minutes = ("0" + Math.floor(totalSeconds / 60)).slice(-2);

    return `${minutes}:${seconds}`;
  };

  const lap = () => {
    const lapTime = time - lapStartTimeRef.current;
    setLaps([...laps, lapTime]);
    console.log(lapStartTimeRef.current, time);
    lapStartTimeRef.current = time;
  }

  return (
    <div className="timer-overlay">
      <div className="timer-display">
        {formatTime(time)}
      </div>
      {isActive && (
      <div className="lap-display">
        {formatTime(currentLapTime)}
      </div>
      )}
      <div className="timer-controls">
        <button className="timer-button-start" onClick={toggle}>
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button className="timer-button-lap" onClick={lap} disabled={!isActive}>
          Lap
        </button>
        <button className="timer-button-reset" onClick={reset}>
          Reset
        </button>
      </div>
      {laps.length > 0 && (
        <div className="laps">
          {laps.map((lapTime, index) => (
            <div key={index} className="lap">
              Lap {index + 1}: {formatTime(lapTime)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timer;
