#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    if [[ -n "${server_pid:-}" ]]; then
        kill "$server_pid" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

node server/ws_server.js &
server_pid=$!

cd react-app
npm start
