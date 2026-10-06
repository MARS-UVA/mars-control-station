#!/usr/bin/env bash
# Check that this control station is actually connected to a running
# mars-jetson (e.g. gazebo_deploy.sh there, start.sh here). Run it from a
# second terminal in this container while both are up. Exits non-zero if any
# check fails.
#
#   ros/verify-jetson-link.sh
#
# The camera check counts signaling websockets (streamer + browser per port);
# whether video actually renders still has to be seen in the browser.

cd "$(dirname "$0")/.."
source ros/ros-env.sh

fail=0
check() {
    local name=$1; shift
    if out=$("$@" 2>&1); then
        printf 'PASS  %s\n' "$name"
    else
        printf 'FAIL  %s\n' "$name"
        fail=1
    fi
    [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/      /'
}

jetson=${JETSON_IP:-}
if [ -z "$jetson" ]; then
    echo "error: JETSON_IP is not set." >&2
    exit 1
fi

check "JETSON_IP ($jetson) resolves" getent hosts "$jetson"
check "Zenoh router reachable at $jetson:7447" \
    timeout 3 bash -c "exec 3<>/dev/tcp/$jetson/7447"
check "ros2 node list shows the Jetson's nodes" bash -c '
    nodes=$(ros2 node list --no-daemon)
    echo "$nodes"
    for n in /teleop /robot_state_controller /controller_manager; do
        grep -qx "$n" <<<"$nodes" || { echo "missing $n"; exit 1; }
    done'
check "/robot_state returns a value" \
    timeout 15 ros2 topic echo --once --no-daemon \
        --qos-durability transient_local --qos-reliability reliable /robot_state
for port in 6767 6969; do
    check "camera signaling on $port has 2 clients (streamer + browser)" bash -c "
        n=\$(ss -Htn state established '( sport = :$port )' | wc -l)
        echo \"\$n client(s)\"
        [ \"\$n\" -ge 2 ]"
done

exit $fail
