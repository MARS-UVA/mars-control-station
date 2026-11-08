/*
groundDrum's UI, selected with `./start.sh --robot groundDrum`. See src/App.js.
Shows the camera and lidar views in the middle column, with the timer and
robot name in the lower-left. Add groundDrum-specific panels here; changes in
this file do not affect the other robots.
*/

import React, { useState } from "react";

import "../themes.css";
import "../App.css";
import Socket from "../Components/Socket";
import Timer from "../Components/Timer";
import WebcamPanel from "../Components/WebcamPanel";
import H264CameraPanel from "../Components/H264CameraPanel";
import RosbridgeFeed from "../Components/RosbridgeFeed";
import PointCloudPanel from "../Components/PointCloudPanel";
import MiniMapPanel from "../Components/MiniMapPanel";
import useRos from '../hooks/useRos';
import useTelemetry from '../hooks/useTelemetry';
import useEspStatus, { ESP_STATUS } from '../hooks/useEspStatus';
import useGamepadPublisher from '../hooks/useGamepadPublisher';

// Data-path switch. CRA inlines REACT_APP_* at build/start time, so this is a
// constant for the life of the bundle. Default (unset or anything but 'true')
// is the legacy Socket.js / packets.js path.
const USE_ROSBRIDGE = process.env.REACT_APP_USE_ROSBRIDGE === 'true';

// Old WebRTC cameras stay available until step 4: REACT_APP_LEGACY_WEBRTC=true
const LEGACY_WEBRTC = process.env.REACT_APP_LEGACY_WEBRTC === 'true';

const ROBOT_LABEL = 'groundDrum';

// packets.js opens ws://localhost:3001 and starts its 30 ms transmit loop the
// moment it is evaluated, so the legacy modules are only loaded on the legacy
// path. Loaded here for the gamepad transmit loop only.
if (!USE_ROSBRIDGE) require('../legacyNetworking');

// This UI has no direction button yet, so the robot always faces forward and
// the front camera is shown. The topic is deliberately crossed: the camera
// published as rear_camera faces the robot's forward driving direction.
const DIRECTION_SWITCHED = false;
const CAMERA = { topic: '/rear_camera/image_raw/ffmpeg', label: 'Front', index: '4', signalingPort: '6969' };

const noop = () => {};

const GroundDrumApp = () => {
  const [ESPWorking, setESPWorking] = useState(false);

  // The data feed fills chart state even though this UI shows no charts; it
  // also runs the over-current and wheel-temperature alarms.
  const [timestamp, setTimestamp] = useState(0);
  const [, setChartData] = useState([]);
  const [, setLastDataPoint] = useState(null);

  // rosbridge path. With the flag off useRos never connects, ros stays null,
  // and every other hook is a no-op on a null ros.
  const { ros, isConnected } = useRos({ enabled: USE_ROSBRIDGE });
  const telemetry = useTelemetry(ros);
  const espStatus = useEspStatus(ros, isConnected, telemetry.lastReceived);
  // Keeps publishing the gamepad so the robot can still be driven.
  useGamepadPublisher(ros, { directionSwitched: DIRECTION_SWITCHED });

  const panelEspWorking = USE_ROSBRIDGE ? espStatus === ESP_STATUS.ONLINE : ESPWorking;
  const espNotPresent = USE_ROSBRIDGE && espStatus === ESP_STATUS.NOT_PRESENT;

  return (
    <div className="app-container">
      {USE_ROSBRIDGE ? (
        <RosbridgeFeed telemetry={telemetry} setChartData={setChartData} setLastDataPoint={setLastDataPoint} setTimestamp={setTimestamp} />
      ) : (
        <Socket setGamePadStatus={noop} setRobotState={noop} setFrontArmActive={noop} setBackArmActive={noop} setESPWorking={setESPWorking} setChartData={setChartData} setLastDataPoint={setLastDataPoint} timestamp={timestamp} setTimestamp={setTimestamp} setData={noop} />
      )}

      <div className="content">
        <div className="left-panel left-panel--minimal">
          <div className="left-panel-footer">
            <Timer />
            <div className="robot-label">Robot: {ROBOT_LABEL}</div>
          </div>
        </div>

        <div className="middle-panel">
          <div className="camera-slot">
            {LEGACY_WEBRTC ? (
              <WebcamPanel key={CAMERA.signalingPort} signalingPort={CAMERA.signalingPort}
                index={CAMERA.index} isActive />
            ) : (
              <H264CameraPanel key={CAMERA.topic} ros={ros} isConnected={isConnected}
                topic={CAMERA.topic} label={CAMERA.label} index={CAMERA.index} isActive />
            )}
            {panelEspWorking || espNotPresent ? null : <div className="esp-not-working">ESP Not Receiving Packets</div>}
          </div>
          {/* Lidar views under the camera: the 3D chase view of the live scan
              and the bird's-eye minimap. */}
          {USE_ROSBRIDGE && (
            <div className="map-row">
              <section className="map-card">
                <div className="map-card-title">3D view</div>
                <div className="map-card-body">
                  <PointCloudPanel ros={ros} isConnected={isConnected} topic="/unilidar/cloud" label="Lidar"
                    directionSwitched={DIRECTION_SWITCHED}
                    frontActuatorPosition={telemetry.position?.front_actuator_position}
                    backActuatorPosition={telemetry.position?.back_actuator_position} />
                </div>
              </section>
              <section className="map-card">
                <div className="map-card-title">Minimap</div>
                <div className="map-card-body">
                  <MiniMapPanel ros={ros} isConnected={isConnected} directionSwitched={DIRECTION_SWITCHED}
                    frontActuatorPosition={telemetry.position?.front_actuator_position}
                    backActuatorPosition={telemetry.position?.back_actuator_position} />
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="right-panel" aria-hidden="true" />
      </div>
    </div>
  );
};

export default GroundDrumApp;
