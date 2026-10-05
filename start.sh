#!/bin/bash


# nmcli dev eth connect $SSID password $PASSWORD

# If JETSON_IP is already set for whatever reason, then it uses that, otherwise it takes input from the console.
if [ -n "${JETSON_IP:-}" ]; then
    echo "Using $JETSON_IP as the Jetson's IP"
else
    echo "Jetson IP address: "
    read JETSON_IP
    export JETSON_IP
fi

# ROS 2 / Zenoh host environment. No-op on machines without ROS 2
# installed, so this is safe for UI-only teammates. See docs/ros-env-setup.md.
if [ -f "$(dirname "$0")/ros/ros-env.sh" ]; then
    source "$(dirname "$0")/ros/ros-env.sh"
fi

cd "$(dirname "$0")"

# Same process handling as start-rosbridge.sh: each child gets its own session
# (setsid) so stop_group can signal its whole process group, and a cleanup
# trap stops all three on Ctrl+C, kill, hangup, or when any one of them exits.
rosbridge_pid="" signaling_pid="" react_pid=""
stop_group() {
    [ -n "$1" ] || return 0
    kill -TERM -- "-$1" 2>/dev/null || return 0
    for _ in $(seq 1 100); do kill -0 -- "-$1" 2>/dev/null || return 0; sleep 0.1; done
    kill -KILL -- "-$1" 2>/dev/null
}
cleanup() {
    trap - EXIT; trap '' INT TERM HUP
    stop_group "$react_pid"; stop_group "$signaling_pid"; stop_group "$rosbridge_pid"
}
trap cleanup EXIT
trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
for port in 9090 6767 6969 3000; do
    if port_open "$port"; then
        echo "error: port $port is already in use (a previous run still going?)." >&2
        exit 1
    fi
done

setsid ros2 launch ros/rosbridge.launch.py &
rosbridge_pid=$!
for _ in $(seq 1 80); do
    kill -0 "$rosbridge_pid" 2>/dev/null || { echo "error: rosbridge exited; see its output above." >&2; exit 1; }
    port_open 9090 && break
    sleep 0.25
done
port_open 9090 || { echo "error: rosbridge did not open port 9090 within 20s." >&2; exit 1; }

setsid node server/ws_server.js &
signaling_pid=$!

cd react-app
REACT_APP_USE_ROSBRIDGE=true setsid npm start <&0 &
react_pid=$!

wait -n "$rosbridge_pid" "$signaling_pid" "$react_pid"
