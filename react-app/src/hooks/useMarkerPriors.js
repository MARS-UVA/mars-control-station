import { useCallback, useEffect, useRef, useState } from 'react';
import { Topic } from 'roslib';

const STATE_TOPIC = '/marker_priors/state';     // std_msgs/String, JSON, 1 Hz
const OFFSET_TOPIC = '/marker_priors/set_offset'; // geometry_msgs/Point, absolute metres
const STALE_MS = 3000;
// After a local change, ignore the robot's reported offset for this long so
// quick repeated nudges build on each other instead of on a stale echo.
const ADOPT_AFTER_MS = 1500;

/**
 * Talks to mars-jetson's marker_prior_tuner (startup/marker_prior_tuner.py),
 * which shifts the AprilTag priors RTAB-Map anchors the map frame to.
 *
 * The offset is sent as an absolute value, never as a delta, so a repeated or
 * late message can't push the tags further than the operator intended. Like
 * useRobotStateToggle, nothing is sent while disconnected; the setters return
 * whether the message went out.
 *
 * @returns {{ state: object|null, available: boolean, target: {x,y,z},
 *             setOffset: (o: {x?,y?,z?}) => boolean,
 *             nudge: (axis: 'x'|'y'|'z', delta: number) => boolean }}
 */
export default function useMarkerPriors(ros) {
  const [state, setState] = useState(null);
  const [target, setTarget] = useState({ x: 0, y: 0, z: 0 });
  const [now, setNow] = useState(Date.now());
  const targetRef = useRef(target);
  const lastReceivedRef = useRef(0);
  const lastSentRef = useRef(0);
  const pubRef = useRef(null);

  useEffect(() => {
    if (!ros) return undefined;
    const sub = new Topic({ ros, name: STATE_TOPIC, messageType: 'std_msgs/msg/String' });
    const onState = (msg) => {
      let parsed;
      try { parsed = JSON.parse(msg.data); } catch { return; }
      lastReceivedRef.current = Date.now();
      setState(parsed);
      // Follow the robot (another operator, a tuner restart) unless the
      // operator is mid-adjustment here.
      if (Date.now() - lastSentRef.current > ADOPT_AFTER_MS && parsed.offset) {
        targetRef.current = parsed.offset;
        setTarget(parsed.offset);
      }
    };
    sub.subscribe(onState);
    pubRef.current = new Topic({ ros, name: OFFSET_TOPIC, messageType: 'geometry_msgs/msg/Point' });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      sub.unsubscribe(onState);
      pubRef.current.unadvertise();
      pubRef.current = null;
    };
  }, [ros]);

  const setOffset = useCallback((partial) => {
    const topic = pubRef.current;
    if (!topic || !topic.ros.isConnected) return false;
    const next = { ...targetRef.current, ...partial };
    // Round to the millimetre so repeated nudges don't accumulate float noise.
    for (const k of ['x', 'y', 'z']) next[k] = Math.round(Number(next[k]) * 1000) / 1000;
    if (![next.x, next.y, next.z].every(Number.isFinite)) return false;
    targetRef.current = next;
    setTarget(next);
    lastSentRef.current = Date.now();
    topic.publish(next);
    return true;
  }, []);

  const nudge = useCallback(
    (axis, delta) => setOffset({ [axis]: targetRef.current[axis] + delta }),
    [setOffset],
  );

  const available = state !== null && now - lastReceivedRef.current < STALE_MS;
  return { state, available, target, setOffset, nudge };
}
