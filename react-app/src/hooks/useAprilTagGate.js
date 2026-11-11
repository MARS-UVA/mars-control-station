import { useCallback, useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';

const OPEN_TOPIC = '/apriltag_gate/open';     // std_msgs/Float32, seconds
const STATUS_TOPIC = '/apriltag_gate/status'; // std_msgs/String, JSON, 2 Hz
const STALE_MS = 3000;

/**
 * Opens mars-jetson's AprilTag gate for a few seconds, through
 * apriltag_gate_trigger (startup/apriltag_gate_trigger.py). While open, tag
 * detections reach RTAB-Map so it can localize the map to the arena.
 *
 * Like useRobotStateToggle, nothing is sent while disconnected; open()
 * returns whether the request went out.
 *
 * @returns {{ status: object|null, available: boolean,
 *             open: (seconds: number) => boolean }}
 */
export default function useAprilTagGate(ros) {
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(Date.now());
  const lastReceivedRef = useRef(0);
  const pubRef = useRef(null);

  useEffect(() => {
    if (!ros) return undefined;
    const sub = new Topic({ ros, name: STATUS_TOPIC, messageType: 'std_msgs/msg/String' });
    const onStatus = (msg) => {
      try {
        setStatus(JSON.parse(msg.data));
        lastReceivedRef.current = Date.now();
      } catch { /* ignore malformed status */ }
    };
    sub.subscribe(onStatus);
    pubRef.current = new Topic({ ros, name: OPEN_TOPIC, messageType: 'std_msgs/msg/Float32' });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      sub.unsubscribe(onStatus);
      pubRef.current.unadvertise();
      pubRef.current = null;
    };
  }, [ros]);

  const open = useCallback((seconds) => {
    const topic = pubRef.current;
    if (!topic || !topic.ros.isConnected) return false;
    topic.publish({ data: seconds });
    return true;
  }, []);

  const available = status !== null && now - lastReceivedRef.current < STALE_MS;
  return { status, available, open };
}
