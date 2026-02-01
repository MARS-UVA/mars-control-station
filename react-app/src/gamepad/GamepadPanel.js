import React, { useState, useEffect, useRef } from 'react';
import { getGamepadState, setTransmissionActive, sendCustomGamepadState } from '../gamepad/gamepad';
import GamepadDisplay from './GamepadDisplay';

function GamepadPanel({ gamepadStatus, setGamepadStatus, gamepadData, setGamepadData }) {
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedMacros, setRecordedMacros] = useState([]);
  
  // Refs are useful for accessing latest state inside intervals without re-creating the interval
  const recordedMacrosRef = useRef([]); 
  const playbackIndexRef = useRef(0);

  useEffect(() => {
    const handleGamepadConnected = (e) => {
      setGamepadStatus(`Gamepad connected!: ${e.gamepad.id}`);
    };

    const handleGamepadDisconnected = () => {
      setGamepadStatus('No gamepad connected!');
      setGamepadData(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Main Loop
    const interval = setInterval(() => {
      // If we are playing back, do NOT read from live inputs. 
      // Playback is handled by the dedicated playback interval below.
      if (isPlaying) return;

      const gamepads = navigator.getGamepads();
      if (gamepads[0]) {
        const state = getGamepadState(0);
        if (state) {
          setGamepadData(state);

          // If recording, append current frame to our macro array
          if (isRecording) {
            recordedMacrosRef.current.push(state);
            setRecordedMacros([...recordedMacrosRef.current]); // Update state to show count
          }
        }
      }
    }, 30);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      clearInterval(interval);
    };
  }, [isRecording, isPlaying, setGamepadData, setGamepadStatus]);

  // Playback Logic
  useEffect(() => {
    let playbackInterval;

    if (isPlaying) {
      // 1. Disable live transmission in gamepad.js so we don't fight the recording
      setTransmissionActive(false);
      playbackIndexRef.current = 0;

      playbackInterval = setInterval(() => {
        const index = playbackIndexRef.current;
        const macro = recordedMacrosRef.current;

        if (index >= macro.length) {
          // End of recording
          handleStopPlayback();
        } else {
          const frame = macro[index];
          
          // Update the UI
          setGamepadData(frame);
          
          // Send data to the rover (WebSocket)
          sendCustomGamepadState(frame);

          playbackIndexRef.current += 1;
        }
      }, 30); // 30ms matches the recording rate
    } else {
      // Ensure transmission is re-enabled when not playing
      setTransmissionActive(true);
    }

    return () => clearInterval(playbackInterval);
  }, [isPlaying]);

  const handleStartRecording = () => {
    setRecordedMacros([]);
    recordedMacrosRef.current = [];
    setIsRecording(true);
    setIsPlaying(false);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleStartPlayback = () => {
    if (recordedMacros.length > 0) {
      setIsRecording(false);
      setIsPlaying(true);
    }
  };

  const handleStopPlayback = () => {
    setIsPlaying(false);
    setTransmissionActive(true); // Restore live control immediately
  };

  return (
    <div className="panel">
      <p className="gamepad-status">{gamepadStatus}</p>
      
      <div className="macro-controls" style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
        {!isRecording && !isPlaying && (
          <>
            <button onClick={handleStartRecording}>Record Macro</button>
            <button onClick={handleStartPlayback} disabled={recordedMacros.length === 0}>
              Play Recording ({recordedMacros.length})
            </button>
          </>
        )}

        {isRecording && (
          <button onClick={handleStopRecording} style={{ backgroundColor: '#ffcccc' }}>
            Stop Recording
          </button>
        )}

        {isPlaying && (
          <button onClick={handleStopPlayback} style={{ backgroundColor: '#ccffcc' }}>
            Stop Playback
          </button>
        )}
      </div>

      {gamepadData && <GamepadDisplay gamepadData={gamepadData} />}
    </div>
  );
}

export default GamepadPanel;