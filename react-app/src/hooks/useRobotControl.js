import { useCallback, useEffect, useRef, useState } from 'react';
import { Service } from 'roslib';

/** Explicit service acknowledgements; STOP never waits behind another call. */
export default function useRobotControl(ros) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const connectionRef = useRef(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!ros) return undefined;
    const api = {
      ros, calls: new Set(),
      estop: new Service({ ros, name: '/robot_state/estop', serviceType: 'std_srvs/srv/SetBool' }),
      teleop: new Service({ ros, name: '/robot_state/teleop', serviceType: 'std_srvs/srv/SetBool' }),
    };
    connectionRef.current = api;
    const onClose = () => {
      for (const finish of [...api.calls]) finish(false, 'Connection lost; service outcome unknown');
    };
    ros.on('close', onClose);
    return () => {
      connectionRef.current = null;
      ros.off('close', onClose);
      onClose();
    };
  }, [ros]);

  const call = useCallback((name, data, label) => {
    const api = connectionRef.current;
    if (!api?.ros.isConnected) {
      setError(`${label} not sent: rosbridge disconnected`);
      return Promise.resolve(false);
    }
    const token = ++sequence.current;
    setPending(label);
    setError(null);
    return new Promise(resolve => {
      let timer;
      let done = false;
      const finish = (success, message) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        api.calls.delete(finish);
        const current = connectionRef.current === api && sequence.current === token;
        if (current) {
          setPending(null);
          setError(success ? null : message || `${label} rejected`);
        }
        resolve(current && success);
      };
      api.calls.add(finish);
      timer = setTimeout(() => finish(false, `${label} timed out; outcome unknown`), 6000);
      try {
        api[name].callService({ data }, response => finish(response.success, response.message),
          message => finish(false, String(message)), 5);
      } catch (err) { finish(false, err.message); }
    });
  }, []);

  const estop = useCallback(() => call('estop', true, 'STOP'), [call]);
  const clearEstop = useCallback(() => call('estop', false, 'Clear E-stop'), [call]);
  const setTeleop = useCallback(enabled => call('teleop', enabled, enabled ? 'Enable teleop' : 'Idle'), [call]);
  return { estop, clearEstop, setTeleop, pending, error };
}
