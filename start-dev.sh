#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    if [[ -n "${server_pid:-}" ]]; then
        kill "$server_pid" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

# ROS 2 / Zenoh host environment. No-op on machines without ROS 2
# installed, so this is safe for UI-only teammates. See docs/ros-env-setup.md.
if [ -f "$(dirname "$0")/ros/ros-env.sh" ]; then
    source "$(dirname "$0")/ros/ros-env.sh"
fi

node server/ws_server.js &
server_pid=$!

cd react-app
npm start
