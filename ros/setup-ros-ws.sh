#!/usr/bin/env bash
# Build the MARS interface packages this control station needs.
#
# Usage:   ./ros/setup-ros-ws.sh
#
# Run from a Linux/WSL shell with ROS 2 Jazzy installed. It creates (or
# refreshes) a colcon workspace outside this repo, links in the four IDL-only
# packages from the ros/mars-ros-interfaces submodule, and builds them.
#
# The submodule is the only source. mars-jetson pins the same submodule commit,
# so both sides of the bridge build identical interface definitions. A package
# missing from it is skipped with a warning rather than failing the whole build:
# one missing package must not leave the others unbuilt.
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
INTERFACES_SRC="$(cd "$(dirname "$0")" && pwd)/mars-ros-interfaces/src"

if [ ! -f "/opt/ros/${MARS_ROS_DISTRO}/setup.bash" ]; then
    echo "error: ROS 2 ${MARS_ROS_DISTRO} not found at /opt/ros/${MARS_ROS_DISTRO}" >&2
    exit 1
fi

if [ ! -d "${INTERFACES_SRC}" ]; then
    echo "error: ${INTERFACES_SRC} does not exist - the mars-ros-interfaces" >&2
    echo "       submodule is not checked out. Run:" >&2
    echo "           git submodule update --init --recursive" >&2
    exit 1
fi

# ROS's own setup.bash references unset variables, so relax nounset over it.
set +u
# shellcheck disable=SC1090
source "/opt/ros/${MARS_ROS_DISTRO}/setup.bash"
set -u

echo "==> workspace: ${MARS_ROS_WS}"
echo "==> interfaces src: ${INTERFACES_SRC}"
mkdir -p "${MARS_ROS_WS}/src"

found=()
missing=()
for pkg in "${MSG_PACKAGES[@]}"; do
    if [ ! -d "${INTERFACES_SRC}/${pkg}" ]; then
        # Drop a link left by an earlier run, which may now dangle.
        rm -f "${MARS_ROS_WS}/src/${pkg}"
        missing+=("$pkg")
        continue
    fi
    ln -sfn "${INTERFACES_SRC}/${pkg}" "${MARS_ROS_WS}/src/${pkg}"
    found+=("$pkg")
    echo "    linked ${pkg}"
done

if [ ${#found[@]} -eq 0 ]; then
    echo "error: none of ${MSG_PACKAGES[*]} found under ${INTERFACES_SRC}" >&2
    exit 1
fi

cd "${MARS_ROS_WS}"
rosdep install --from-paths src --ignore-src -y
colcon build --symlink-install --packages-select "${found[@]}"

if [ ${#missing[@]} -gt 0 ]; then
    echo >&2
    echo "WARNING: not in the mars-ros-interfaces submodule, so not built: ${missing[*]}" >&2
    echo "         rosbridge cannot publish or subscribe to topics of these types." >&2
fi

echo
echo "Done. Now source the environment:"
echo "    source ros/ros-env.sh"
