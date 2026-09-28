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

cd react-app

node ../server/ws_server.js &
npm start &
wait
