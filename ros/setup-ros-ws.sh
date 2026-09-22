#!/usr/bin/env bash
# Build the mars-jetson message packages this control station needs.
#
# Usage:   ./ros/setup-ros-ws.sh
#
# Run from a Linux/WSL shell with ROS 2 Jazzy installed. It creates (or
# refreshes) a colcon workspace outside this repo, links in the four IDL-only
# packages from a mars-jetson checkout, and builds them.
#
# The workspace is deliberately NOT inside this repo:
#   - this repo usually lives on a Windows drive, and colcon build artifacts
#     are slower to write over the /mnt/c DrvFS mount than on native ext4;
#   - build/, install/ and log/ must never be committed;
#   - src/ here would be symlinks to a machine-specific path, which is
#     meaningless to anyone else who clones this repo.
set -euo pipefail

MSG_PACKAGES=(serial_msgs teleop_msgs robot_control_msgs autonomy_msgs)

: "${MARS_ROS_DISTRO:=jazzy}"
: "${MARS_ROS_WS:=$HOME/UVA_Projects/mars-control-station-ros_ws}"
# Existing mars-jetson checkout to link the packages out of. If you do not have
# one, clone it first:  git clone git@github.com:MARS-UVA/mars-jetson.git
: "${MARS_JETSON_SRC:=$HOME/UVA_Projects/mars-jetson}"

if [ ! -f "/opt/ros/${MARS_ROS_DISTRO}/setup.bash" ]; then
    echo "error: ROS 2 ${MARS_ROS_DISTRO} not found at /opt/ros/${MARS_ROS_DISTRO}" >&2
    exit 1
fi

if [ ! -d "${MARS_JETSON_SRC}/src" ]; then
    echo "error: no mars-jetson checkout at ${MARS_JETSON_SRC}" >&2
    echo "       clone it, or set MARS_JETSON_SRC to where yours lives." >&2
    exit 1
fi

# ROS's own setup.bash references unset variables, so relax nounset over it.
set +u
# shellcheck disable=SC1090
source "/opt/ros/${MARS_ROS_DISTRO}/setup.bash"
set -u

echo "==> workspace: ${MARS_ROS_WS}"
echo "==> jetson src: ${MARS_JETSON_SRC}"
mkdir -p "${MARS_ROS_WS}/src"

for pkg in "${MSG_PACKAGES[@]}"; do
    if [ ! -d "${MARS_JETSON_SRC}/src/${pkg}" ]; then
        echo "error: ${MARS_JETSON_SRC}/src/${pkg} does not exist" >&2
        exit 1
    fi
    ln -sfn "${MARS_JETSON_SRC}/src/${pkg}" "${MARS_ROS_WS}/src/${pkg}"
    echo "    linked ${pkg}"
done

cd "${MARS_ROS_WS}"
rosdep install --from-paths src --ignore-src -y
colcon build --symlink-install --packages-select "${MSG_PACKAGES[@]}"

echo
echo "Done. Now source the environment:"
echo "    source ros/ros-env.sh"
