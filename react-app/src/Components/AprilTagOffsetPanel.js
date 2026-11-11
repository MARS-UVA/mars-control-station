import React, { useEffect, useState } from 'react';

/*
AprilTag prior adjustment. Shifts where RTAB-Map believes the tags are, in
arena coordinates (the same frame as the minimap in map-up view):
  +X  along the 6.88 m side, toward the construction zone   (→)
  +Y  along the 5 m side                                    (↑)
  +Z  height                                                (Raise)
The same offset is applied to every tag. Values are sent to
marker_prior_tuner on the Jetson (see hooks/useMarkerPriors).

Adjust with the robot stopped: when RTAB-Map next optimizes its graph, the
map frame (and everything Nav2 has in it) moves to match.
*/
const STEPS = [0.005, 0.01, 0.02, 0.05, 0.1];
const fmt = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + ' cm';

export default function AprilTagOffsetPanel({ markerPriors, disabled }) {
  const { state, available, target, setOffset, nudge } = markerPriors;
  const [step, setStep] = useState(0.01);
  const [draft, setDraft] = useState({ x: '0', y: '0', z: '0' });
  const [notice, setNotice] = useState(null);

  // Keep the typed fields in step with the current target (cm in the inputs).
  useEffect(() => {
    setDraft({
      x: (target.x * 100).toFixed(1),
      y: (target.y * 100).toFixed(1),
      z: (target.z * 100).toFixed(1),
    });
  }, [target.x, target.y, target.z]);

  const off = disabled || !available;
  const send = (ok) => setNotice(ok ? null : 'Not sent: rosbridge disconnected');
  const btn = (label, axis, sign, title) => (
    <button type="button" disabled={off} title={title}
      onClick={() => send(nudge(axis, sign * step))}>{label}</button>
  );

  const applyTyped = () => {
    const values = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, parseFloat(v) / 100]));
    if (!Object.values(values).every(Number.isFinite)) {
      setNotice('Enter numbers in centimetres');
      return;
    }
    send(setOffset(values));
  };

  const tag = state?.tags?.[0];

  return (
    <div className="panel apriltag-offset-panel">
      <div className="panel-title">AprilTag offset</div>

      {!available && <div className="rosbridge-status-line">Waiting for marker_prior_tuner…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 2.5em)', gap: 4, justifyContent: 'center' }}>
        <span />{btn('↑', 'y', +1, '+Y')}<span />
        {btn('←', 'x', -1, '−X')}<span />{btn('→', 'x', +1, '+X')}
        <span />{btn('↓', 'y', -1, '−Y')}<span />
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 }}>
        {btn('Raise', 'z', +1, '+Z')}{btn('Lower', 'z', -1, '−Z')}
        <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {STEPS.map((s) => <option key={s} value={s}>{s * 100} cm</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        {['x', 'y', 'z'].map((k) => (
          <label key={k}>{k.toUpperCase()}
            <input type="number" step="0.5" style={{ width: '4.5em' }} value={draft[k]} disabled={off}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          </label>
        ))}
        <span>cm</span>
        <button type="button" disabled={off} onClick={applyTyped}>Set</button>
        <button type="button" disabled={off} onClick={() => send(setOffset({ x: 0, y: 0, z: 0 }))}>Reset</button>
      </div>

      <div className="rosbridge-status-line">
        Offset X {fmt(target.x)} · Y {fmt(target.y)} · Z {fmt(target.z)}
      </div>
      {tag && (
        <div className="rosbridge-status-line">
          Tag {tag.id} at ({tag.x.toFixed(3)}, {tag.y.toFixed(3)}, {tag.z.toFixed(3)}) m
        </div>
      )}
      {state?.status && <div className="rosbridge-status-line">Robot: {state.status}</div>}
      {notice && <div className="rosbridge-status-error">{notice}</div>}
    </div>
  );
}
