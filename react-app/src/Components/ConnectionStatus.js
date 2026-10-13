import React from 'react';
import './ConnectionStatus.css';

const STATUS_LABELS = {
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
  closed: 'Disconnected',
};

/**
 * Presentational rosbridge connection indicator. Pass useRos()'s status.
 */
const ConnectionStatus = ({ status = 'connecting', label = 'rosbridge' }) => {
  const statusClass = STATUS_LABELS[status] ? status : 'closed';

  return (
    <div className="connection-status-container" role="status" aria-live="polite">
      <span className="connection-status-label">{label}</span>
      <div className={`connection-status-box status-${statusClass}`}>
        <span className="connection-status-dot" aria-hidden="true" />
        {STATUS_LABELS[statusClass]}
      </div>
    </div>
  );
};

export default ConnectionStatus;
