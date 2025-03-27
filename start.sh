!#/bin/bash

SSID = "MARS-UVA"
PASSWORD = "mars2025"

if [ $# -eq 0 ]; then
    echo "No arguments supplied, please provide the SSID"
    exit 1
fi

if [ $# -gt 1 ]; then
    echo "Too many arguments supplied, please provide the SSID"
    exit 1
fi

SSID = $1

nmcli dev eth connect $SSID password $PASSWORD

cd react-app
npm start

