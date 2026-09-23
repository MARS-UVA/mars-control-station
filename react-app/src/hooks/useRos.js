import { useEffect, useState } from 'react';
import { Ros } from 'roslib';

const RECONNECT_DELAY_MS = 2000;

function getRosbridgeUrl() {
  return process.env.REACT_APP_ROSBRIDGE_URL || `ws://${window.location.hostname}:9090`;
}

/**
 * Owns the single rosbridge connection.
 *
 * Retries every RECONNECT_DELAY_MS after a close. Topics created with
 * reconnect_on_close (roslib's default) re-subscribe and re-advertise on their
 * own once the connection comes back, so the other hooks don't handle it.
 *
 * ros is null until the effect has run; every consumer hook accepts that.
 *
 * @returns {{ ros: Ros|null, status: 'connecting'|'connected'|'error'|'closed', isConnected: boolean }}
 */
export default function useRos() {
  const [ros, setRos] = useState(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const url = getRosbridgeUrl();
    // Constructed without a url so it does not auto-connect. A fresh instance
    // per effect run means a remount never reuses a transport that is still
    // closing (Ros.connect is a no-op until the old transport has closed).
    const instance = new Ros({});
    let retryTimer = null;
    let disposed = false;

    const scheduleRetry = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    function connect() {
      if (disposed) return;
      setStatus('connecting');
      // A rejected connect (e.g. the transport could not be created) emits no
      // 'close', so it has to schedule its own retry.
      instance.connect(url).catch(() => {
        if (disposed) return;
        setStatus('error');
        scheduleRetry();
      });
    }

    const onConnection = () => setStatus('connected');
    // A failed connect emits 'error' then 'close'. Keep 'error' visible while
    // the retry is pending rather than immediately overwriting it with 'closed'.
    const onError = () => setStatus('error');
    const onClose = () => {
      if (disposed) return;
      setStatus((prev) => (prev === 'error' ? prev : 'closed'));
      scheduleRetry();
    };

    instance.on('connection', onConnection);
    instance.on('error', onError);
    instance.on('close', onClose);
    setRos(instance);
    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      instance.off('connection', onConnection);
      instance.off('error', onError);
      instance.off('close', onClose);
      instance.close();
    };
  }, []);

  return { ros, status, isConnected: status === 'connected' };
}
