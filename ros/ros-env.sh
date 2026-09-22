#!/usr/bin/env bash
# ROS 2 host environment for mars-control-station.
#
# Source this (do not execute it) before running anything that needs to see the
# robot's ROS graph:
#
#     source ros/ros-env.sh
#
# It is intentionally a no-op on machines without ROS 2 installed (Windows, and
# teammates who only run the React/Node UI), so start.sh can source it blindly.

# --- Where the message workspace lives -------------------------------------
# Built by ros/setup-ros-ws.sh. Kept OUTSIDE the repo by default: this repo is
# checked out on a Windows drive, and colcon build artifacts are both slow to
# write over the DrvFS mount and must never be committed. Override if you keep
# it somewhere else.
: "${MARS_ROS_WS:=$HOME/UVA_Projects/mars-control-station-ros_ws}"
export MARS_ROS_WS

# --- ROS 2 Jazzy ------------------------------------------------------------
: "${MARS_ROS_DISTRO:=jazzy}"
if [ -f "/opt/ros/${MARS_ROS_DISTRO}/setup.bash" ]; then
    # ROS's setup.bash references unset variables; survive a caller's `set -u`.
    _mars_u=$(set +o | grep nounset); set +u
    # shellcheck disable=SC1090
    source "/opt/ros/${MARS_ROS_DISTRO}/setup.bash"
    eval "$_mars_u"; unset _mars_u
else
    # No ROS on this machine - nothing else here applies.
    return 0 2>/dev/null || exit 0
fi

# --- Custom interface packages (serial/teleop/robot_control/autonomy msgs) ---
if [ -f "${MARS_ROS_WS}/install/setup.bash" ]; then
    _mars_u=$(set +o | grep nounset); set +u
    # shellcheck disable=SC1090
    source "${MARS_ROS_WS}/install/setup.bash"
    eval "$_mars_u"; unset _mars_u
else
    echo "ros-env.sh: no build at ${MARS_ROS_WS}/install - run ros/setup-ros-ws.sh" >&2
fi

# --- Middleware -------------------------------------------------------------
# Must match the Jetson, which runs rmw_zenoh_cpp (see mars-jetson deploy.sh).
export RMW_IMPLEMENTATION=rmw_zenoh_cpp

# Deliberately NOT set here:
#   ROS_DOMAIN_ID                 - the Jetson's deploy.sh does not set it, so
#                                   both hosts stay on the default domain 0.
#   ROS_AUTOMATIC_DISCOVERY_RANGE - LOCALHOST is a devcontainer-only isolation
#                                   setting; it would block the cross-host
#                                   discovery this whole setup exists for.

# --- Zenoh router -----------------------------------------------------------
# This host does NOT run its own rmw_zenohd. It attaches to the router the
# Jetson already starts (mars-jetson setup_terminal.sh). JETSON_IP is the same
# variable start.sh already exports.
#
# mode="client" is not optional here. Zenoh's default is peer mode, in which
# this host also opens its own listener and advertises itself as reachable.
# Behind WSL2's default NAT (docs/ros-env-setup.md §7) nothing can dial back in,
# so those advertised endpoints are dead addresses that peers waste time on.
# A client only ever dials out to the router, which is exactly the topology we
# want and sidesteps the NAT question entirely.
if [ -n "${JETSON_IP:-}" ]; then
    export ZENOH_CONFIG_OVERRIDE="mode=\"client\";connect/endpoints=[\"tcp/${JETSON_IP}:7447\"]"
fi
