import React, { useState, useEffect, useRef } from 'react';
import { getGamepadState, setTransmissionActive, sendCustomGamepadState } from '../gamepad/gamepad';
import GamepadDisplay from './GamepadDisplay';

const BUTTON_POSITIONS = {
  'Record': { top: 385, left: 25 },
  'Play': { top: 385, left: 170 },
  'Reset': { top: 385, left: 315 },
};

const BUTTON_CLASSES = {
  'Record': 'command-button-record',
  'Play': 'command-button-run',
  'Reset': 'command-button-reset',
};

const CommandButton = React.memo(({ label, className, onClick, style }) => (
  <button className={className} onClick={onClick} style={style}>
    <h4>{label}</h4>
  </button>
));

function GamepadPanel({ gamepadStatus, setGamepadStatus, gamepadData, setGamepadData }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedMacros, setRecordedMacros] = useState([]);

  const recordedMacrosRef = useRef([]);
  const playbackIndexRef = useRef(0);

  // Gamepad loop
  useEffect(() => {
    const handleGamepadConnected = (e) => setGamepadStatus(`Gamepad connected!: ${e.gamepad.id}`);
    const handleGamepadDisconnected = () => {
      setGamepadStatus('No gamepad connected!');
      setGamepadData(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    const interval = setInterval(() => {
      if (isPlaying) return;

      const gamepads = navigator.getGamepads();
      if (gamepads[0]) {
        const state = getGamepadState(0);
        if (state) {
          setGamepadData(state);

          if (isRecording) {
            recordedMacrosRef.current.push(state);
            setRecordedMacros([...recordedMacrosRef.current]);
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

  // Playback
  useEffect(() => {
    let playbackInterval;
    if (isPlaying) {
      setTransmissionActive(false);
      playbackIndexRef.current = 0;

      playbackInterval = setInterval(() => {
        const index = playbackIndexRef.current;
        const macro = recordedMacrosRef.current;

        if (index >= macro.length) {
          handleStopPlayback();
        } else {
          const frame = macro[index];
          setGamepadData(frame);
          sendCustomGamepadState(frame);
          playbackIndexRef.current += 1;
        }
      }, 30);
    } else {
      setTransmissionActive(true);
    }

    return () => clearInterval(playbackInterval);
  }, [isPlaying]);

  // Handlers
  const handleStartRecording = () => {
    setRecordedMacros([]);
    recordedMacrosRef.current = [];
    setIsRecording(true);
    setIsPlaying(false);
  };
  const handleStopRecording = () => setIsRecording(false);
  const handleStartPlayback = () => {
    if (recordedMacros.length > 0) {
      setIsRecording(false);
      setIsPlaying(true);
    }
  };
  const handleStopPlayback = () => {
    setIsPlaying(false);
    setTransmissionActive(true);
  };
  const resetRecording = () => {
    setRecordedMacros([]);
    recordedMacrosRef.current = [];
  };

  return (
    <div>
      <div className="panel">
        <p className="gamepad-status">{gamepadStatus}</p>
        {gamepadData && <GamepadDisplay gamepadData={gamepadData} />}
      </div>

      <div className="controller-record-buttons">
        {/* Show all three buttons only if not recording or playing */}
        {!isRecording && !isPlaying && (
          <>
            <CommandButton
              label="Record Inputs"
              className={BUTTON_CLASSES['Record']}
              style={{ ...BUTTON_POSITIONS['Record'], position: 'fixed' }}
              onClick={handleStartRecording}
            />
            <CommandButton
              label={`Run Inputs (${recordedMacros.length})`}
              className={BUTTON_CLASSES['Play'].active}
              style={{ ...BUTTON_POSITIONS['Play'], position: 'fixed' }}
              onClick={handleStartPlayback}
              disabled={recordedMacros.length === 0}
            />
            <CommandButton
              label="Reset Recording"
              className={BUTTON_CLASSES['Reset']}
              style={{ ...BUTTON_POSITIONS['Reset'], position: 'fixed' }}
              onClick={resetRecording}
              disabled={recordedMacros.length === 0}
            />
          </>
        )}

        {/* Show only stop recording button if recording */}
        {isRecording && (
          <CommandButton
            label="Stop Recording"
            className={BUTTON_CLASSES['Record']}
            style={{ ...BUTTON_POSITIONS['Record'], position: 'fixed'}}
            onClick={handleStopRecording}
          />
        )}

        {/* Show only stop playback button if playing */}
        {isPlaying && (
          <CommandButton
            label="Stop Playback"
            className={BUTTON_CLASSES['Play']}
            style={{ ...BUTTON_POSITIONS['Play'], position: 'fixed', backgroundColor: '#ccffcc' }}
            onClick={handleStopPlayback}
          />
        )}
      </div>
    </div>
  );
}

export default GamepadPanel;
