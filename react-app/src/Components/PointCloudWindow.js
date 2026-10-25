import React, { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import PointCloudPanel from './PointCloudPanel';

/**
 * Floating 3D map panel over the dashboard, so the camera layout stays as it is.
 *
 * Closed by default. While closed, PointCloudPanel is unmounted, which drops
 * the rosbridge subscription and stops the cloud being sent to the browser at
 * all. Drag it by the title bar; resize it from the bottom-right corner.
 */
export default function PointCloudWindow({ ros, isConnected, topic }) {
  const [open, setOpen] = useState(false);
  const nodeRef = useRef(null); // react-draggable needs this under StrictMode

  if (!open) {
    return (
      <button type="button" className="point-cloud-toggle" onClick={() => setOpen(true)}>
        Show 3D map
      </button>
    );
  }

  return (
    <Draggable nodeRef={nodeRef} handle=".point-cloud-window-bar" bounds="body">
      <div ref={nodeRef} className="point-cloud-window">
        <div className="point-cloud-window-bar">
          <span>3D map</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close 3D map">
            Close
          </button>
        </div>
        <div className="point-cloud-window-body">
          <PointCloudPanel ros={ros} isConnected={isConnected} topic={topic} label="Lidar" />
        </div>
      </div>
    </Draggable>
  );
}
