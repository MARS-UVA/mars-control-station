import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';


const beep15min = [1200000, 900000, 600000, 300000, 180000, 120000, 60000, 30000, 15000, 5000, 1000, 0].map(offset => 1600000 - offset);
                    //20min   15min  10min 5min    3min    2min    1min    30s   15s   5s    1s    0s  left
const beep30min = [600000, 300000, 180000, 120000, 60000, 30000, 15000, 5000, 1000, 0].map(offset => 900000 - offset);
                    //10min 5min    3min    2min    1min    30s   15s   5s    1s    0s  left

const Timer = () => {
  const [time, setTime] = useState(0); // Time in milliseconds
  const [currentLapTime, setLapTime] = useState(0);
  const [laps, setLaps] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [beepTimes, setBeepTimes] = useState(beep15min);
  const [muted, setMuted] = useState(false);    
  
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

  useEffect(() => {
    if (!muted && beepTimes.includes(time)){
      playBeep();
    }
  }, [time])

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
  const toggleMode = () => {
    setBeepTimes(prev => prev === beep15min ? beep30min : beep15min);
  };
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
      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div
          onClick={toggleMode}
          style={{
            display: 'flex',
            background: '#333',
            borderRadius: '20px',
            padding: '2px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <span style={{
            padding: '3px 10px',
            borderRadius: '18px',
            background: beepTimes === beep15min ? '#fff' : 'transparent',
            color: beepTimes === beep15min ? '#000' : '#aaa',
            transition: 'all 0.2s',
          }}>
            15 min
          </span>
          <span style={{
            padding: '3px 10px',
            borderRadius: '18px',
            background: beepTimes !== beep15min ? '#fff' : 'transparent',
            color: beepTimes !== beep15min ? '#000' : '#aaa',
            transition: 'all 0.2s',
          }}>
            30 min
          </span>
        </div>
        <button
          onClick={() => setMuted(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px',
            opacity: muted ? 0.4 : 1,
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
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
