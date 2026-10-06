import { useEffect, useRef, useState } from 'react';

export const ESP_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  NOT_PRESENT: 'not-present',
};

// Same window as network_communication's esp_check_timer (client.cpp), which
// is where the legacy feedback blob's "ESP alive" int came from.
const FEEDBACK_TIMEOUT_MS = 2000;
const GRAPH_POLL_MS = 2000;
// A node list older than this is treated as unknown, not as still true.
const GRAPH_STALE_MS = 3 * GRAPH_POLL_MS;
const TICK_MS = 250;

// Nodes that mars-jetson's startup/launch/gazebo.launch.py starts and no other
// backend does. Either one is enough.
const GAZEBO_NODES = ['/actuator_position_feedback', '/ros_gz_bridge'];
// Started only for robot_backend:=serial (startup/launch/launch.py). It is the
// only node that talks to the ESP.
const SERIAL_NODE = '/serial_node';

const hasGazeboNode = (nodes) => !!nodes && GAZEBO_NODES.some((name) => nodes.includes(name));

/**
 * true only when the graph positively looks like the gazebo backend: a gazebo
 * node is up and serial_node is not. An unknown graph (null) is never sim.
 */
export function isSimBackend(nodes) {
  return hasGazeboNode(nodes) && !nodes.includes(SERIAL_NODE);
}

/**
 * @param lastReceived useTelemetry().lastReceived
 * @param nodes node names from rosapi, or null when unknown
 */
export function deriveEspStatus(lastReceived, nodes, now) {
  if (isSimBackend(nodes)) return ESP_STATUS.NOT_PRESENT;
  // gazebo's actuator_position_feedback publishes /position too, so with a
  // gazebo node on the graph /position says nothing about the ESP.
  const ignorePosition = hasGazeboNode(nodes);
  const fresh = Object.entries(lastReceived).some(
    ([key, at]) => !(ignorePosition && key === 'position') && at !== null && now - at <= FEEDBACK_TIMEOUT_MS
  );
  return fresh ? ESP_STATUS.ONLINE : ESP_STATUS.OFFLINE;
}

/**
 * Whether the ESP is sending feedback, for the "ESP Not Receiving Packets"
 * banner and the Dig/Dump gate.
 *
 * Nothing on mars-jetson publishes /esp_working. The legacy path never used
 * that topic either: network_communication computed the flag itself, as "any
 * serial_node feedback (/current_bus_voltage, /temperature, /position) in the
 * last 2 s". This applies the same rule to the same three topics.
 *
 * The gazebo backend has no serial_node and no ESP, so there 'offline' would
 * be a false alarm. It is reported as 'not-present' instead, and only on
 * positive evidence (see isSimBackend). Everything else, including a
 * disconnected rosbridge, a failed node query and robot_backend:=mock (which
 * looks the same from here as real hardware with serial_node down), stays
 * 'offline'.
 *
 * @returns {'online'|'offline'|'not-present'}
 */
export default function useEspStatus(ros, isConnected, lastReceived) {
  const [status, setStatus] = useState(ESP_STATUS.OFFLINE);
  const lastReceivedRef = useRef(lastReceived);
  lastReceivedRef.current = lastReceived;
  const graphRef = useRef({ nodes: null, at: 0 });

  useEffect(() => {
    if (!ros || !isConnected) {
      graphRef.current = { nodes: null, at: 0 };
      setStatus(ESP_STATUS.OFFLINE);
      return undefined;
    }

    let disposed = false;
    const pollGraph = () => {
      // roslib queues service calls made while disconnected.
      if (!ros.isConnected) return;
      ros.getNodes(
        (nodes) => {
          if (!disposed) graphRef.current = { nodes, at: Date.now() };
        },
        () => {
          if (!disposed) graphRef.current = { nodes: null, at: 0 };
        }
      );
    };
    const evaluate = () => {
      const now = Date.now();
      const { nodes, at } = graphRef.current;
      const knownNodes = now - at <= GRAPH_STALE_MS ? nodes : null;
      setStatus(deriveEspStatus(lastReceivedRef.current, knownNodes, now));
    };

    pollGraph();
    const pollId = setInterval(pollGraph, GRAPH_POLL_MS);
    const tickId = setInterval(evaluate, TICK_MS);

    return () => {
      disposed = true;
      clearInterval(pollId);
      clearInterval(tickId);
    };
  }, [ros, isConnected]);

  return status;
}
