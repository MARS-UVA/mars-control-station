import { useEffect, useRef } from 'react';

/**
 * rosbridge-path counterpart of Socket.js's chart loop.
 *
 * Socket.js does two things besides its WebSockets: every 200 ms it appends a
 * data point to App's chartData / lastDataPoint (60 s window), and it sounds
 * the over-stall-current alarm and the wheel-temperature beep. This component
 * does exactly that, but reads the latest useTelemetry() messages instead of
 * the legacy feedback blob. Field names are the serial_msgs names, which are
 * the same names Socket.js already used, so LiveDataPanel is unchanged.
 *
 * Constants and thresholds are copied from Socket.js on purpose (Socket.js is
 * not to be modified while both paths coexist). Keep them in sync.
 *
 * Until a topic's first message arrives its fields are left undefined, so the
 * value cards show "NaN" rather than a 0.00 that looks like a reading. That is
 * also what the legacy page shows before its first feedback packet (Socket.js
 * seeds motorValuesRef with a Float32Array of length 4, so everything past
 * index 3 is undefined until then). globalDataRate and the gyro fields were
 * never delivered on the legacy path either (see the networking audit) and are
 * kept at 0 so the point shape is identical.
 *
 * Renders nothing.
 */
const DATA_UPDATE_DELAY_MS = 200;
const DATA_WINDOW_WIDTH = 60000 / DATA_UPDATE_DELAY_MS;

// serial_msgs/msg/CurrentBusVoltage
const CURRENT_BUS_VOLTAGE_FIELDS = [
  'front_left_wheel_current',
  'back_left_wheel_current',
  'front_right_wheel_current',
  'back_right_wheel_current',
  'front_drum_current',
  'back_drum_current',
  'front_actuator_current',
  'back_actuator_current',
  'main_battery_voltage',
  'aux_battery_voltage',
];
// serial_msgs/msg/Temperature
const TEMPERATURE_FIELDS = [
  'front_left_wheel_temperature',
  'back_left_wheel_temperature',
  'front_right_wheel_temperature',
  'back_right_wheel_temperature',
  'front_drum_temperature',
  'back_drum_temperature',
];
// serial_msgs/msg/Position
const POSITION_FIELDS = ['front_actuator_position', 'back_actuator_position'];

const pickFields = (msg, fields) =>
  Object.fromEntries(fields.map((field) => [field, msg ? msg[field] : undefined]));

function RosbridgeFeed({ telemetry, setChartData, setLastDataPoint, setTimestamp }) {
  // The 200 ms loop reads the newest messages without restarting on every
  // telemetry render.
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const alertAudioRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const overStallCurrent = useRef(false);
  const STALL_CURRENT = 366; // Amps from https://docs.wcproducts.com/welcome/frc-build-system/electronics-and-pneumatics/brushless-motors

  const WHEEL_TEMP_ALERT_C = 70;
  const WHEEL_TEMP_BEEP_TOTAL_MS = 5000;
  const WHEEL_TEMP_BEEP_INTERVAL_MS = 400;
  const WHEEL_TEMP_BEEP_LENGTH_MS = 100;
  const prevWheelTempOkRef = useRef(true);
  const wheelTempBeepCleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      StopOverCurrentAlarm();
      wheelTempBeepCleanupRef.current?.();
      alertAudioRef.current?.close();
    };
  }, []);

  useEffect(() => {
    alertAudioRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  const StartOverCurrentAlarm = () => {
    const context = alertAudioRef.current;
    if (!context || oscillatorRef.current) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 1;

    oscillator.start();

    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
  };

  const StopOverCurrentAlarm = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();

      oscillatorRef.current = null;
      gainNodeRef.current = null;
    }
  };

  const startWheelTempBeepPattern = () => {
    const context = alertAudioRef.current;
    if (!context) return;
    context.resume?.();

    wheelTempBeepCleanupRef.current?.();

    const playShortBeep = () => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.22;
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      const t0 = context.currentTime;
      const lenSec = WHEEL_TEMP_BEEP_LENGTH_MS / 1000;
      oscillator.start(t0);
      oscillator.stop(t0 + lenSec);
    };

    playShortBeep();
    const intervalId = setInterval(playShortBeep, WHEEL_TEMP_BEEP_INTERVAL_MS);
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      wheelTempBeepCleanupRef.current = null;
    }, WHEEL_TEMP_BEEP_TOTAL_MS);

    wheelTempBeepCleanupRef.current = () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      wheelTempBeepCleanupRef.current = null;
    };
  };

  // Periodically add new data points to chartData (same loop shape as Socket.js)
  useEffect(() => {
    const addNewData = () => {
      const { currentBusVoltage, temperature, position, lastReceived } = telemetryRef.current;
      setTimestamp((prevTime) => {
        const newTime = prevTime + 1;
        const newData = {
          time: newTime,
          ...pickFields(currentBusVoltage, CURRENT_BUS_VOLTAGE_FIELDS),
          ...pickFields(temperature, TEMPERATURE_FIELDS),
          ...pickFields(position, POSITION_FIELDS),
          globalDataRate: 0,
          xGyro: 0,
          yGyro: 0,
          zGyro: 0,
        };

        const isOverStallCurrent = (
          newData.front_left_wheel_current > STALL_CURRENT ||
          newData.back_left_wheel_current > STALL_CURRENT ||
          newData.front_right_wheel_current > STALL_CURRENT ||
          newData.back_right_wheel_current > STALL_CURRENT
        );
        if (isOverStallCurrent && !overStallCurrent.current) {
          StartOverCurrentAlarm();
        }
        if (!isOverStallCurrent && overStallCurrent.current) {
          StopOverCurrentAlarm();
        }
        overStallCurrent.current = isOverStallCurrent;

        // Socket.js waits for the first feedback packet before judging
        // temperatures; here that is the first /temperature message.
        if (lastReceived.temperature !== null) {
          const maxWheelTemp = Math.max(
            newData.front_left_wheel_temperature,
            newData.back_left_wheel_temperature,
            newData.front_right_wheel_temperature,
            newData.back_right_wheel_temperature,
          );
          const wheelTempOk = maxWheelTemp <= WHEEL_TEMP_ALERT_C;
          if (!wheelTempOk && prevWheelTempOkRef.current) {
            startWheelTempBeepPattern();
          }
          prevWheelTempOkRef.current = wheelTempOk;
        }

        setChartData((prevData) => {
          setLastDataPoint(newData);
          const newDataArray = [...prevData, newData];
          return newDataArray.slice(-DATA_WINDOW_WIDTH);
        });

        return newTime;
      });
    };

    const intervalId = setInterval(addNewData, DATA_UPDATE_DELAY_MS);

    return () => clearInterval(intervalId);
  }, [setChartData, setLastDataPoint, setTimestamp]);

  return null;
}

export default RosbridgeFeed;
