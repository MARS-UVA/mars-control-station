#!/usr/bin/env bash
# Start only rosbridge and the React dev server (REACT_APP_USE_ROSBRIDGE=true),
# to sanity-check the rosbridge/roslib wiring in isolation. The legacy Node
# gateway (server/) is not started, and nothing here needs mars-jetson to be
# mounted, running, or reachable.
set -euo pipefail

cd "$(dirname "$0")"

ROSBRIDGE_PORT=9090
REACT_PORT=3000
ROSBRIDGE_WAIT_SECS=20

rosbridge_pid=""
react_pid=""

# Each child runs in its own session (setsid), so its pid is also its process
# group id. Signalling the group reaches everything under it: ros2 launch's
# rosbridge_websocket/rosapi nodes, and react-scripts' node child under npm.
# SIGTERM, not SIGINT: bash starts background commands with SIGINT ignored, and
# children that don't install their own handler would never see it.
stop_group() {
    local pid=$1
    [[ -n "$pid" ]] || return 0
    kill -TERM -- "-$pid" 2>/dev/null || return 0
    for _ in $(seq 1 100); do
        kill -0 -- "-$pid" 2>/dev/null || return 0
        sleep 0.1
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
}

cleanup() {
    # Ignore, don't reset: a second Ctrl+C during the (up to 10 s per group)
    # shutdown would otherwise kill this shell and orphan whatever is left.
    trap - EXIT
    trap '' INT TERM HUP
    # On hangup the terminal is already gone and every write to it fails with
    # EIO. Under set -e the first failed echo would abort cleanup before any
    # group is stopped, so nothing in here may be fatal.
    set +e
    [[ -n "$rosbridge_pid$react_pid" ]] || return 0
    echo
    echo "Stopping React dev server and rosbridge..."
    stop_group "$react_pid"
    stop_group "$rosbridge_pid"
}

# Ctrl+C, kill, and a closed or detached terminal (SIGHUP) all end up in
# cleanup. The children never see the hangup themselves: setsid puts them in
# their own sessions, which is what makes kill -TERM -<pgid> reach exactly
# their groups. So SIGKILL of this script (kill -9, OOM) is the one case that
# still orphans them; the port checks below then refuse to start on top of
# the leftovers.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

port_open() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Isolated from the robot: drop the devcontainer's Zenoh client config (which
# dials mars-jetson:7447 and fails hard if it isn't there) and don't let
# ros-env.sh rebuild it from JETSON_IP.
unset JETSON_IP ZENOH_CONFIG_OVERRIDE

# ROS 2 / Zenoh host environment. No-op on machines without ROS 2
# installed, so this is safe for UI-only teammates. See docs/ros-env-setup.md.
if [ -f "ros/ros-env.sh" ]; then
    source "ros/ros-env.sh"
fi

# Standalone Zenoh peer: don't wait for a router that isn't running here, and
# don't scout the LAN for one (which could pull in a real robot's graph).
export ZENOH_ROUTER_CHECK_ATTEMPTS=-1
export ZENOH_CONFIG_OVERRIDE='scouting/multicast/enabled=false'

if ! command -v ros2 >/dev/null 2>&1; then
    echo "error: ros2 not found. Run this inside the ROS devcontainer (see docs/devcontainer-ros-setup.md)." >&2
    exit 1
fi

if ! ros2 pkg prefix rosbridge_server >/dev/null 2>&1; then
    echo "error: rosbridge_server is not installed (apt install ros-\$ROS_DISTRO-rosbridge-server)." >&2
    exit 1
fi

# rosbridge can only advertise/subscribe types it can import itself. A missing
# package makes every advertise fail, after which each publish is logged as
# "Cannot infer topic type ... not yet advertised" - which hides the real cause.
missing_pkgs=()
for pkg in serial_msgs teleop_msgs robot_control_msgs autonomy_msgs; do
    ros2 pkg prefix "$pkg" >/dev/null 2>&1 || missing_pkgs+=("$pkg")
done
if [ ${#missing_pkgs[@]} -gt 0 ]; then
    echo "warning: rosbridge cannot load ${missing_pkgs[*]}; topics of those types will fail." >&2
    echo "         Build them with ros/setup-ros-ws.sh (see docs/devcontainer-ros-setup.md)." >&2
fi

if port_open "$ROSBRIDGE_PORT"; then
    echo "error: port $ROSBRIDGE_PORT is already in use (a previous rosbridge still running?)." >&2
    exit 1
fi

# Without this, react-scripts offers the next free port instead, and a second
# dev server comes up next to a leftover one - each with its own rosbridge
# client and browser tab.
if port_open "$REACT_PORT"; then
    echo "error: port $REACT_PORT is already in use (a previous React dev server still running?)." >&2
    exit 1
fi

echo "Starting rosbridge on ws://localhost:$ROSBRIDGE_PORT..."
setsid ros2 launch ros/rosbridge.launch.py &
rosbridge_pid=$!

for ((i = 0; i < ROSBRIDGE_WAIT_SECS * 4; i++)); do
    if ! kill -0 "$rosbridge_pid" 2>/dev/null; then
        echo "error: rosbridge exited before opening port $ROSBRIDGE_PORT; see its output above." >&2
        exit 1
    fi
    port_open "$ROSBRIDGE_PORT" && break
    sleep 0.25
done

if ! port_open "$ROSBRIDGE_PORT"; then
    echo "error: rosbridge did not accept connections on port $ROSBRIDGE_PORT within ${ROSBRIDGE_WAIT_SECS}s." >&2
    exit 1
fi

echo
echo "rosbridge is up on ws://localhost:$ROSBRIDGE_PORT."
echo "NOTE: no robot nodes are running. The UI should show rosbridge as"
echo "connected with no live telemetry - that is expected for this check."
echo

# Explicit <&0: a backgrounded command otherwise gets /dev/null on stdin, and
# react-scripts exits as soon as stdin hits EOF.
cd react-app
PORT=$REACT_PORT REACT_APP_USE_ROSBRIDGE=true setsid npm start <&0 &
react_pid=$!

# Return as soon as either side exits; the EXIT trap stops the other.
wait -n "$rosbridge_pid" "$react_pid"
