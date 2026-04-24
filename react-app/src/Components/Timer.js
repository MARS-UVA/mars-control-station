import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';



const Timer = () => {
  const [time, setTime] = useState(0); // Time in milliseconds
  const [laps, setLaps] = useState([]);
  const [isActive, setIsActive] = useState(false);

  const lapStartTimeRef = useRef(0);

  function toggle() {
    setIsActive(!isActive);
  }

  function reset() {
    setTime(0);
    setIsActive(false);
    lapStartTimeRef.current = 0;
    setLaps([]);
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

  useEffect(() => {
    if (time === 10000){
      playBeep();
    }
  }, [time])

  const formatTime = (time) => {
    const milliseconds = ("0" + ((time / 10) % 100)).slice(-2);
    const seconds = ("0" + Math.floor((time / 1000) % 60)).slice(-2);
    const minutes = ("0" + Math.floor(time / 60000)).slice(-2);

    return `${minutes}:${seconds}:${milliseconds}`;
  };

  const lap = () => {
    const lapTime = time - lapStartTimeRef.current;
    setLaps([...laps, lapTime]);
    console.log(lapStartTimeRef.current, time);
    lapStartTimeRef.current = time;
  }

  const playBeep = () => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
  
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
  
    oscillator.type = 'sine';  // 'sine', 'square', 'sawtooth', 'triangle'
    oscillator.frequency.value = 880; // pitch in Hz
    gainNode.gain.value = 0.5; // volume (0 to 1)
  
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3); // play for 0.3 seconds
  };

  return (
    <div className="timer-overlay">
      <div className="timer-display">
        {formatTime(time)}
      </div>
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
