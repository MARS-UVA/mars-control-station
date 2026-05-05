#!/bin/bash

SSID="Team_39"
PASSWORD="lunabotics#1"

if [ $# -eq 0 ]; then
    echo "No arguments supplied, connecting to MARS network"
    nmcli device wifi connect "$SSID" password "$PASSWORD"
    export JETSON_IP="192.168.50.105"
    export ESP_IP="192.168.50.205"
elif [ $# -eq 1 ]; then
    if [ "$1" == "eduroam" ]; then
        echo "Connecting to eduroam network..."
        nmcli device wifi connect "eduroam"
        export JETSON_IP="172.25.149.82"
    elif [ "$1" == "MARS" ] || [ "$1" == "mars" ]; then
        echo "Connecting to MARS network..."
        nmcli device wifi connect "$SSID" password "$PASSWORD"
    fi
elif [ $# -eq 2 ]; then
    echo "Connecting to $1 network..."
    SSID=$1
    PASSWORD=$2
    nmcli device wifi connect "$SSID" password "$PASSWORD"
elif [ $# -gt 2 ]; then
    echo "Too many arguments supplied, please provide the SSID"
    exit 1
fi

# nmcli dev eth connect $SSID password $PASSWORD

if [ -n "$JETSON_IP" ]; then
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

