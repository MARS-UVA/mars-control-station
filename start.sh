#!/bin/bash

# Each profile maps to its own UI in react-app/src/apps/ (see react-app/src/App.js).
ROBOT_PROFILE=bruno
usage() {
    printf 'Usage: %s [--robot bruno|frontloader|groundDrum] [--ip JETSON_IP]\n' "$0"
    printf '  --ip  Jetson IP address. Without it, JETSON_IP from the environment is\n'
    printf '        used, and if that is not set either you are asked for it.\n'
}
IP_ARG=

while [ "$#" -gt 0 ]; do
    case "$1" in
        --robot)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                echo "error: --robot requires a profile name." >&2
                usage >&2
                exit 2
            fi
            ROBOT_PROFILE=$2
            shift 2
            ;;
        --robot=*)
            ROBOT_PROFILE=${1#--robot=}
            shift
            ;;
        --ip)
            if [ "$#" -lt 2 ] || [ -z "$2" ]; then
                echo "error: --ip requires an IP address." >&2
                usage >&2
                exit 2
            fi
            IP_ARG=$2
            shift 2
            ;;
        --ip=*)
            IP_ARG=${1#--ip=}
            [ -n "$IP_ARG" ] || { echo "error: --ip requires an IP address." >&2; usage >&2; exit 2; }
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "error: unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

case "$ROBOT_PROFILE" in
    bruno|frontloader|groundDrum) ;;
    *)
        echo "error: unknown robot profile: $ROBOT_PROFILE" >&2
        usage >&2
        exit 2
        ;;
esac

# nmcli dev eth connect $SSID password $PASSWORD

# Jetson IP: --ip wins, then JETSON_IP from the environment, otherwise ask.
if [ -n "$IP_ARG" ]; then
    export JETSON_IP="$IP_ARG"
    echo "Using $JETSON_IP as the Jetson's IP"
elif [ -n "${JETSON_IP:-}" ]; then
    echo "Using $JETSON_IP as the Jetson's IP"
else
    echo "Jetson IP address: "
    read JETSON_IP
    export JETSON_IP
fi

[ -n "$JETSON_IP" ] || { echo "error: JETSON_IP must be set." >&2; exit 1; }

# ROS 2 / Zenoh host environment. No-op on machines without ROS 2
# installed, so this is safe for UI-only teammates. See docs/rosbridge.md.
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

setsid node server/ws_server.js &
signaling_pid=$!

# The UI retries its connection while we wait for the robot and rosbridge.
cd react-app
echo "Starting UI with robot profile: $ROBOT_PROFILE"
REACT_APP_USE_ROSBRIDGE=true REACT_APP_ROBOT="$ROBOT_PROFILE" setsid npm start <&0 &
react_pid=$!
cd ..

check_ui_services() {
    kill -0 "$signaling_pid" 2>/dev/null || { echo "error: camera signaling relay exited; see its output above." >&2; exit 1; }
    kill -0 "$react_pid" 2>/dev/null || { echo "error: React dev server exited; see its output above." >&2; exit 1; }
}

echo "Waiting for Zenoh at $JETSON_IP:7447 (Ctrl+C to stop)..."
# Bound each connection attempt so an unreachable address cannot hang startup
# or prevent us from noticing that the UI or relay has exited. Pass the host
# as an argument rather than interpolating it into shell code.
while true; do
    check_ui_services
    if timeout 2 bash -c 'exec 3<>"/dev/tcp/$1/7447"' _ "$JETSON_IP" 2>/dev/null; then
        break
    fi
    sleep 1
done
echo "Zenoh port is reachable; starting rosbridge..."
setsid ros2 launch ros/rosbridge.launch.py &
rosbridge_pid=$!

for _ in $(seq 1 80); do
    kill -0 "$rosbridge_pid" 2>/dev/null || { echo "error: rosbridge exited; see its output above." >&2; exit 1; }
    check_ui_services
    port_open 9090 && break
    sleep 0.25
done
port_open 9090 || { echo "error: rosbridge did not open port 9090 within 20s." >&2; exit 1; }

wait -n "$rosbridge_pid" "$signaling_pid" "$react_pid"
