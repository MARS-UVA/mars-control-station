#!/bin/bash

SSID="Team_39"
PASSWORD="marsuva!"

if [ $# -eq 0 ]; then
    echo "No arguments supplied, connecting to MARS network"
    nmcli device wifi connect "$SSID" password "$PASSWORD"
elif [ $# -eq 1 ]; then
    if [ "$1" == "eduroam" ]; then
        echo "Connecting to eduroam network..."
        nmcli device wifi connect "eduroam"
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

cd react-app

node ../server/udp_server.js &
node ../server/client_udp.js &
npm start &
wait

