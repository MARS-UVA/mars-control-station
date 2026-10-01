import { useEffect, useState } from 'react';
import { Topic } from 'roslib';

// Field names are exactly those of the serial_msgs definitions; the message
// object is stored as received rather than remapped.
const TELEMETRY_TOPICS = [
  // front_left_wheel_current, back_left_wheel_current, front_right_wheel_current,
  // back_right_wheel_current, front_drum_current, back_drum_current,
  // front_actuator_current, back_actuator_current, main_battery_voltage,
  // aux_battery_voltage (all float32)
  { key: 'currentBusVoltage', name: '/current_bus_voltage', messageType: 'serial_msgs/msg/CurrentBusVoltage' },
  // front_left_wheel_temperature, back_left_wheel_temperature,
  // front_right_wheel_temperature, back_right_wheel_temperature,
  // front_drum_temperature, back_drum_temperature (all float32)
  { key: 'temperature', name: '/temperature', messageType: 'serial_msgs/msg/Temperature' },
  // front_actuator_position, back_actuator_position (float32)
  { key: 'position', name: '/position', messageType: 'serial_msgs/msg/Position' },
];

const EMPTY = Object.fromEntries(TELEMETRY_TOPICS.map(({ key }) => [key, null]));

/**
 * Subscribes to the serial_node feedback topics.
 *
 * These topics have no link watchdog, so a dead feed just stops updating.
 * lastReceived holds a Date.now() timestamp per topic (null until the first
 * message) so callers can decide what counts as stale.
 *
 * @returns {{ currentBusVoltage: object|null, temperature: object|null,
 *             position: object|null, lastReceived: Record<string, number|null> }}
 */
export default function useTelemetry(ros) {
  const [data, setData] = useState(EMPTY);
  const [lastReceived, setLastReceived] = useState(EMPTY);

  useEffect(() => {
    if (!ros) return undefined;

    const subscriptions = TELEMETRY_TOPICS.map(({ key, name, messageType }) => {
      const topic = new Topic({ ros, name, messageType });
      const onMessage = (msg) => {
        setData((prev) => ({ ...prev, [key]: msg }));
        setLastReceived((prev) => ({ ...prev, [key]: Date.now() }));
      };
      topic.subscribe(onMessage);
      return { topic, onMessage };
    });

    return () => {
      subscriptions.forEach(({ topic, onMessage }) => topic.unsubscribe(onMessage));
    };
  }, [ros]);

  return { ...data, lastReceived };
}
