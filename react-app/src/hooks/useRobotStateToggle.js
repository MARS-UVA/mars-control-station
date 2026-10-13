import { useCallback, useEffect, useRef } from 'react';
import { Topic } from 'roslib';
import { ROBOT_STATE } from './rosTypes';

/**
 * Publishes to /robot_state/toggle (std_msgs/msg/UInt8 -- robot_state_controller
 * subscribes with UInt8, not RobotState). Event-driven only.
 *
 * robot_state_controller's semantics: sending ESTOP while in ESTOP releases to
 * TELEOP; sending ESTOP from any other state enters ESTOP; any other value is
 * taken as the new state. So estop() is a toggle, not a latch -- read the
 * current state from useRobotState before relying on it to stop the robot.
 *
 * Nothing is sent while disconnected: roslib would queue the publish and flush
 * it on reconnect, and a late ESTOP toggle can release the robot as easily as
 * stop it. toggle() and estop() return whether the message was sent, so the UI
 * can tell the operator a press did nothing.
 *
 * @returns {{ toggle: (state: number) => boolean, estop: () => boolean }}
 */
export default function useRobotStateToggle(ros) {
  const topicRef = useRef(null);

  useEffect(() => {
    if (!ros) return undefined;
    topicRef.current = new Topic({
      ros,
      name: '/robot_state/toggle',
      messageType: 'std_msgs/msg/UInt8',
    });
    return () => {
      topicRef.current.unadvertise();
      topicRef.current = null;
    };
  }, [ros]);

  const toggle = useCallback((state) => {
    if (!Object.values(ROBOT_STATE).includes(state)) {
      throw new Error(`Invalid robot state ${state}; use ROBOT_STATE from hooks/rosTypes`);
    }
    const topic = topicRef.current;
    if (!topic || !topic.ros.isConnected) return false;
    topic.publish({ data: state });
    return true;
  }, []);

  const estop = useCallback(() => toggle(ROBOT_STATE.ESTOP), [toggle]);

  return { toggle, estop };
}
