/*
Renders dashboard with gamepad status, drive state, live data, and webcam feed
Updates through socket connection (legacy path) or rosbridge (REACT_APP_USE_ROSBRIDGE=true)
See docs/rosbridge.md.
*/

import React, { useState, useEffect, useMemo, useRef } from "react";
import Draggable from "react-draggable";

import "./themes.css";
import "./App.css";
import LiveDataPanel from "./Components/LiveDataPanel";
import GamepadPanel from "./gamepad/GamepadPanel";
import DriveStatePanel from "./Components/DriveStatePanel";
import WebcamPanel from "./Components/WebcamPanel";
import Socket from "./Components/Socket";
import SingleLiveDataStream from "./Components/SingleLiveDataStream";
import ActuatorDataDisplay from "./Components/ActuatorDataDisplay";
import Timer from "./Components/Timer";
import ThemeChanger from "./Components/ThemeChanger";
import TiltingRods from "./Components/TiltingRods";
import DisplayMeter from "./Components/DisplayMeter";
import RightButtonPanel from "./Components/RightButtonPanel";
import ArmIndicator from "./gamepad/ArmIndicator";
import DirectionChangeButton from "./Components/DirectionChangeButton";
import ConnectionStatus from "./Components/ConnectionStatus";
import RosbridgeFeed from "./Components/RosbridgeFeed";
import { setDirection } from './gamepad/directionStore';
import useRos from './hooks/useRos';
import useTelemetry from './hooks/useTelemetry';
import useRobotState from './hooks/useRobotState';
import useEspStatus, { ESP_STATUS } from './hooks/useEspStatus';
import useGamepadPublisher, { padToGamepadState } from './hooks/useGamepadPublisher';
import useRobotStateToggle from './hooks/useRobotStateToggle';
import useDigDumpAction from './hooks/useDigDumpAction';
import H264CameraPanel from "./Components/H264CameraPanel";
import { ROBOT_PROFILES, DEFAULT_ROBOT } from './robotProfiles';
import { toLegacyGamepadData, toRosGamepadState } from './rosbridgeAdapters';

// Data-path switch. CRA inlines REACT_APP_* at build/start time, so this is a
// constant for the life of the bundle. Default (unset or anything but 'true')
// is the legacy Socket.js / packets.js path.
const USE_ROSBRIDGE = process.env.REACT_APP_USE_ROSBRIDGE === 'true';

// Old WebRTC cameras stay available until step 4: REACT_APP_LEGACY_WEBRTC=true
const LEGACY_WEBRTC = process.env.REACT_APP_LEGACY_WEBRTC === 'true';

// packets.js opens ws://localhost:3001 and starts its 30 ms transmit loop the
// moment it is evaluated, so the legacy modules are only loaded on the legacy
// path. A static import would run that loop on the rosbridge path too.
const legacy = USE_ROSBRIDGE ? null : require('./legacyNetworking');

const App = () => {


  const [gamepadStatus, setGamepadStatus] = useState('No gamepad connected!');
  // const [gamepad2Status, setGamepad2Status] = useState('No gamepad connected!');
  const [gamepadData, setGamepadData] = useState(null);
  const [gamepad2Data, setGamepad2Data] = useState(null);
  const [driveState, setDriveState] = useState('Idle');
  const [camera0Active, setCamera0Active] = useState(true);
  const [camera4Active, setCamera4Active] = useState(true);
  const [frontArmActive, setFrontArmActive] = useState(false);
  const [backArmActive, setBackArmActive] = useState(false);
  const [prevGamepadData, setPrevGamepadData] = useState(null);
  const [robotState, setRobotState] = useState(0);
  const [directionSwitched, setDirectionSwitched] = useState(false);
  const [ESPWorking, setESPWorking] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState(DEFAULT_ROBOT);
  const robotProfile = ROBOT_PROFILES[selectedRobot];

  useEffect(() => {
    // Legacy path: gamepad.js reads this module-level flag on every transmit.
    // rosbridge path: the same flag goes to useGamepadPublisher below instead.
    if (!USE_ROSBRIDGE) setDirection(directionSwitched);
  }, [directionSwitched]);


  const [timestamp, setTimestamp] = useState(0);
  const [chartData, setChartData] = useState(Array.from({ length: 1 }, (_, i) => ({

    time: i,
    // goon mode? ACTIVATED
    leftFrontWheel: Math.random() * 100,
    rightFrontWheel: Math.random() * 100,
    leftBackWheel: Math.random() * 100,
    rightBackWheel: Math.random() * 100,
    leftBucketDrum: Math.random() * 100,
    rightBucketDrum: Math.random() * 100,
    actuatorCapacity: Math.random() * 100,
    actuatorHeight: Math.random() * 100,
    xGyro: 0.0,
    yGyro: 0.0,
    zGyro: 0.0,
  })));
  const [lastDataPoint, setLastDataPoint] = useState(chartData[chartData.length - 1]);
  const [valueData, setData] = useState("data");

  // ---------------------------------------------------------------------------
  // rosbridge path. All six hooks are called unconditionally (hook rules); with
  // the flag off useRos never connects, ros stays null, and every other hook is
  // a no-op on a null ros. Nothing below publishes or subscribes on the legacy
  // path.
  // ---------------------------------------------------------------------------
  const { ros, status: rosStatus, isConnected } = useRos({ enabled: USE_ROSBRIDGE });
  const telemetry = useTelemetry(ros);
  const robot = useRobotState(ros, isConnected);
  const espStatus = useEspStatus(ros, isConnected, telemetry.lastReceived);
  const { gamepadStatus: publisherStatus, setLiveEnabled, publishCustomFrame } =
    useGamepadPublisher(ros, { directionSwitched });
  const { estop } = useRobotStateToggle(ros);
  const digDump = useDigDumpAction(ros);
  const { sendGoal, cancelGoal } = digDump;
  // Operator-visible reason the last button press did nothing (hooks return
  // false instead of queueing while disconnected).
  const [commandNotice, setCommandNotice] = useState(null);

  // GamepadPanel's networking functions on the rosbridge path, in the exact
  // shapes it used from gamepad.js / packets.js.
  const directionSwitchedRef = useRef(directionSwitched);
  directionSwitchedRef.current = directionSwitched;
  const rosGamepad = useMemo(() => ({
    getGamepadState: (index = 0, directionOverride = null) => {
      const pad = navigator.getGamepads?.()[index];
      if (!pad) return null;
      const switched = directionOverride !== null ? directionOverride : directionSwitchedRef.current;
      return toLegacyGamepadData(padToGamepadState(pad, switched));
    },
    setTransmissionActive: (active) => setLiveEnabled(active),
    sendCustomGamepadState: (frame) => publishCustomFrame(toRosGamepadState(frame)),
  }), [setLiveEnabled, publishCustomFrame]);

  // Routine selection is independent of the DIG/DUMP robot state values.
  const rosCommands = useMemo(() => ({
    dig: () => {
      setCommandNotice(sendGoal('dig', robotProfile.digIndex) ? null : 'Dig not sent: rosbridge disconnected');
    },
    dump: () => {
      setCommandNotice(sendGoal('dump', robotProfile.dumpIndex) ? null : 'Dump not sent: rosbridge disconnected');
    },
    stop: () => {
      // ESTOP first, unconditionally. It is the highest-priority signal and
      // must never wait on, or be skipped because of, the cancel below. Both
      // calls are synchronous and return whether anything was sent.
      const estopSent = estop();
      setCommandNotice(estopSent ? null : 'STOP not sent: rosbridge disconnected');
      // Retire any running or queued routine after publishing ESTOP.
      cancelGoal();
    },
  }), [sendGoal, cancelGoal, estop, robotProfile]);

  // ---------------------------------------------------------------------------
  // Panel props: one source or the other, never both.
  // ---------------------------------------------------------------------------
  const gamepadFns = USE_ROSBRIDGE ? rosGamepad : legacy.legacyGamepad;
  const commands = USE_ROSBRIDGE ? rosCommands : legacy.legacyCommands;
  // /robot_state value; the legacy feedback blob carried the same 0..3 number.
  // null (unknown / disconnected) -> 0 so no button is highlighted.
  const panelRobotState = USE_ROSBRIDGE ? (robot.robotState ?? 0) : robotState;
  // /arm_control_mode fields are what the legacy blob memcpy'd, so `=== 1` is
  // the same test Socket.js applied.
  const panelFrontArmActive = USE_ROSBRIDGE ? robot.armControlMode?.front_arm_control === 1 : frontArmActive;
  const panelBackArmActive = USE_ROSBRIDGE ? robot.armControlMode?.back_arm_control === 1 : backArmActive;
  // ESP feedback controls the status banner only; commands remain available
  // regardless of whether an ESP is online, offline, or absent.
  const panelEspWorking = USE_ROSBRIDGE ? espStatus === ESP_STATUS.ONLINE : ESPWorking;
  const espNotPresent = USE_ROSBRIDGE && espStatus === ESP_STATUS.NOT_PRESENT;

  return (
    <div className="app-container">
      {/* <h1 className="title">MARS Web UI</h1> */}
      {USE_ROSBRIDGE ? (
        <RosbridgeFeed telemetry={telemetry} setChartData={setChartData} setLastDataPoint={setLastDataPoint} setTimestamp={setTimestamp} />
      ) : (
        <Socket setGamePadStatus={setGamepadStatus} setRobotState={setRobotState} setFrontArmActive={setFrontArmActive} setBackArmActive={setBackArmActive} setESPWorking={setESPWorking} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setData={setData} />
      )}


      <div className="content">
        <div className="left-panel">
          {USE_ROSBRIDGE && (
            <div className="rosbridge-status">
              <ConnectionStatus status={rosStatus} />
              <div className="rosbridge-status-line">Gamepad publisher: {publisherStatus}</div>
              <div className="rosbridge-status-line">
                Robot state: {robot.robotStateName} · digdump: {digDump.status}
                {digDump.feedback?.phase ? ` (${digDump.feedback.phase})` : ''}
              </div>
              {espNotPresent && (
                <div className="rosbridge-status-line">ESP: not present (simulation backend)</div>
              )}
              {(commandNotice || digDump.error) && (
                <div className="rosbridge-status-error">{commandNotice || digDump.error}</div>
              )}
            </div>
          )}
          <GamepadPanel gamepadStatus={gamepadStatus} setGamepadStatus={setGamepadStatus} gamepadData={gamepadData} setGamepadData={setGamepadData} gamepadIndex={0} camera0Active={camera0Active} camera4Active={camera4Active} getGamepadState={gamepadFns.getGamepadState} setTransmissionActive={gamepadFns.setTransmissionActive} sendCustomGamepadState={gamepadFns.sendCustomGamepadState} />
          <ArmIndicator frontArmActive={panelFrontArmActive} backArmActive={panelBackArmActive} label="Arm Control" directionSwitched={directionSwitched} />
          {/* <GamepadPanel gamepadStatus={gamepad2Status} setGamepadStatus={setGamepad2Status} gamepadData={gamepad2Data} setGamepadData={setGamepad2Data} gamepadIndex={1} camera0Active={camera0Active} camera4Active={camera4Active} /> */}
          {/* Hiding the displays that don't do anything currently */}
          {/* <DisplayMeter current={80} total={100} left = {155} top = {580} height = {40} width = {180} label="Current" />  */} {/*ADD THE METHODS OF GETTING THESE VALUES!!*/}
          {/* <DisplayMeter current={80} total={100} left = {155} top = {655} height = {40} width = {180} label="Capacity" /> */}
          {/* <ActuatorDataDisplay lastDataPoint={lastDataPoint}/> */}

          <RightButtonPanel currentActionState={panelRobotState} backArmActive={panelBackArmActive} onDig={commands.dig} onDump={commands.dump} onStop={commands.stop} ></RightButtonPanel>
          <DirectionChangeButton directionSwitched={directionSwitched} setDirectionSwitched={setDirectionSwitched} gamepadData={gamepadData} />
          <Timer />
        </div>

        <div className="middle-panel">
          {LEGACY_WEBRTC ? (
            <>
              <WebcamPanel signalingPort="6969" index="4" isActive={!directionSwitched} />
              <WebcamPanel signalingPort="6767" index="0" isActive={directionSwitched} />
            </>
          ) : (
            <>
              <H264CameraPanel ros={ros} isConnected={isConnected} topic="/rear_camera/image_raw/ffmpeg"
                label="Rear" index="4" isActive={!directionSwitched} />
              <H264CameraPanel ros={ros} isConnected={isConnected} topic="/front_camera/image_raw/ffmpeg"
                label="Front" index="0" isActive={directionSwitched} />
            </>
          )}
          {panelEspWorking || espNotPresent ? null : <div className="esp-not-working">ESP Not Receiving Packets</div>}
        </div>

        <div className="right-panel">
          <LiveDataPanel lastDataPoint={lastDataPoint} timestamp={timestamp} chartData={chartData} />
          {/* <TiltingRods/> hiding since they're incomplete*/}
        </div>
        <div className="dashboard-settings">
          <label htmlFor="robot-selection">Robot </label>
          <select id="robot-selection" value={selectedRobot}
            disabled={!USE_ROSBRIDGE || ['active', 'canceling', 'unknown'].includes(digDump.status)}
            onChange={event => setSelectedRobot(event.target.value)}>
            {Object.entries(ROBOT_PROFILES).map(([id, profile]) => (
              <option key={id} value={id}>{profile.label}</option>
            ))}
          </select>
          <ThemeChanger />
        </div>
      </div>
    </div>
  );
};

export default App;
