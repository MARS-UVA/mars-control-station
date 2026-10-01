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

cd react-app

node ../server/ws_server.js &
npm start &
wait
