import React, { useState } from 'react';

/*
"Localize" button: opens the robot's AprilTag gate for a few seconds so
RTAB-Map receives tag detections and snaps the map onto the arena. Point a
camera that the detector uses (the "Rear" view) at a tag first. Pressing
again while open extends the time. See hooks/useAprilTagGate.
*/
const DURATIONS = [3, 5, 10, 20];

const LABELS = {
  open: (s) => `Gate open · ${Math.ceil(s.remaining)} s left`,
  finishing: () => 'Finishing batch (waiting for tag sightings)',
  closed: () => 'Gate closed',
};

export default function AprilTagGateButton({ gate, disabled }) {
  const { status, available, open } = gate;
  const [seconds, setSeconds] = useState(5);
  const [notice, setNotice] = useState(null);

  const state = status?.state ?? 'closed';
  const off = disabled || !available || status?.gate_available === false;

  let title;
  if (disabled) title = 'Needs a rosbridge connection';
  else if (!available) title = 'Waiting for apriltag_gate_trigger on the robot';
  else if (status?.gate_available === false) title = 'AprilTagGate service is not running';

  return (
    <div className="panel apriltag-gate-panel">
      <div className="panel-title">AprilTag localize</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" disabled={off} title={title}
          onClick={() => setNotice(open(seconds) ? null : 'Not sent: rosbridge disconnected')}>
          {state === 'open' ? 'Extend' : 'Localize'}
        </button>
        <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d} s</option>)}
        </select>
      </div>
      <div className="rosbridge-status-line">
        {available ? (LABELS[state] || LABELS.closed)(status) : title || 'Waiting for robot…'}
        {available && status.batches > 0 ? ` · ${status.batches} batch${status.batches === 1 ? '' : 'es'} sent` : ''}
      </div>
      {available && status.message && !['open', 'closed'].includes(status.message) && (
        <div className="rosbridge-status-error">{status.message}</div>
      )}
      {notice && <div className="rosbridge-status-error">{notice}</div>}
    </div>
  );
}
