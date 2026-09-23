import { useEffect, useState } from 'react';
import { Topic } from 'roslib';
import { ROBOT_STATE } from './rosTypes';

const stamp = (key) => (prev) => ({ ...prev, [key]: Date.now() });

const STATE_NAMES = Object.fromEntries(
  Object.entries(ROBOT_STATE).map(([name, value]) => [value, name])
);

/**
 * Subscribes to /robot_state, /arm_control_mode and /esp_working.
 *
 * Every value starts as null ("unknown"). Nothing is assumed: in particular
 * robot_control_msgs/RobotState's own default is ESTOP (3), and no default is
 * shown in its place before the first real message arrives.
 *
 * /robot_state is published TRANSIENT_LOCAL / KEEP_LAST(1), so a fresh
 * subscription receives the current state immediately. It is torn down and
 * recreated every time the connection comes up, and reset to unknown while
 * disconnected so a stale state is never displayed as current.
 *
 * /esp_working has no confirmed publisher on mars-jetson. espWorking stays
 * null until a message actually arrives, which is distinct from a real 0.
 *
 * @returns {{ robotState: number|null, robotStateName: string,
 *             armControlMode: { front_arm_control: number, back_arm_control: number }|null,
 *             espWorking: number|null, lastReceived: Record<string, number|null> }}
 */
export default function useRobotState(ros, isConnected) {
  const [robotState, setRobotState] = useState(null);
  const [armControlMode, setArmControlMode] = useState(null);
  const [espWorking, setEspWorking] = useState(null);
  const [lastReceived, setLastReceived] = useState({
    robotState: null,
    armControlMode: null,
    espWorking: null,
  });

  // /robot_state: recreated on every transition to connected.
  useEffect(() => {
    if (!ros || !isConnected) {
      setRobotState(null);
      return undefined;
    }

    const topic = new Topic({
      ros,
      name: '/robot_state',
      messageType: 'robot_control_msgs/msg/RobotState',
      // This effect owns re-subscription, so roslib's own must be off.
      reconnect_on_close: false,
    });
    const onMessage = (msg) => {
      setRobotState(msg.state);
      setLastReceived(stamp('robotState'));
    };
    topic.subscribe(onMessage);

    return () => topic.unsubscribe(onMessage);
  }, [ros, isConnected]);

  // /arm_control_mode and /esp_working: subscribed once; roslib re-attaches them.
  useEffect(() => {
    if (!ros) return undefined;

    const armTopic = new Topic({
      ros,
      name: '/arm_control_mode',
      messageType: 'robot_control_msgs/msg/ArmControlMode',
    });
    const onArm = (msg) => {
      setArmControlMode({
        front_arm_control: msg.front_arm_control,
        back_arm_control: msg.back_arm_control,
      });
      setLastReceived(stamp('armControlMode'));
    };

    const espTopic = new Topic({
      ros,
      name: '/esp_working',
      messageType: 'std_msgs/msg/UInt8',
    });
    const onEsp = (msg) => {
      setEspWorking(msg.data);
      setLastReceived(stamp('espWorking'));
    };

    armTopic.subscribe(onArm);
    espTopic.subscribe(onEsp);

    return () => {
      armTopic.unsubscribe(onArm);
      espTopic.unsubscribe(onEsp);
    };
  }, [ros]);

  return {
    robotState,
    robotStateName: robotState === null ? 'unknown' : STATE_NAMES[robotState] ?? `unrecognized (${robotState})`,
    armControlMode,
    espWorking,
    lastReceived,
  };
}
