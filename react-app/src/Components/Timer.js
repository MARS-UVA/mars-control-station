import React, { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import Movable from './Movable';
import '../App.css';


const Timer = () => {
  const [time, setTime] = useState(0); // Time in milliseconds
  const [isActive, setIsActive] = useState(false);

  function toggle() {
    setIsActive(!isActive);
  }

  function reset() {
    setTime(0);
    setIsActive(false);
  }

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 100);
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (time) => {
    const milliseconds = ("0" + ((time / 10) % 100)).slice(-2);
    const seconds = ("0" + Math.floor((time / 1000) % 60)).slice(-2);
    const minutes = ("0" + Math.floor((time / 60000) % 60)).slice(-2);
    const hours = ("0" + Math.floor((time / 3600000))).slice(-2);

    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
  };

  return (
    <Draggable>
    <div className="timer-overlay">
      <div className="timer-display">
        {formatTime(time)}
      </div>
      <div className="timer-controls">
        <button className="timer-button" onClick={toggle}>
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button className="timer-button" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
    </Draggable>
  );
};

export default Timer;