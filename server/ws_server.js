const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');

const ServerSocket = require('./udp_server');


const MESSAGE_LENGTH = 1500;
const HEADER_LENGTH = 10;
const WS_PORT = 3001;

const DATA_RATE_UPDATE_INTERVAL_MS = 1000;

const webSocketServer = new WebSocket.Server({port: WS_PORT});

let websockets = {
    image: null,
    image2: null,
    motorCurrent: null,
    client: null,
    potentiometer: null,
    dataRate: null,
    gyroRate: null
};
let webrtc = {
    rosSocket: [null, null],
    displaySocket: [null, null]
};

webSocketServer.on('connection', (ws) => {
    firstMessage = true;

    ws.on('message', (message) => {
        if(firstMessage) {
            switch (message.readUInt8()) {
                case 1:
                    websockets.motorCurrent = ws;
                    console.log("connected motor current ws");
                    break;
                case 2:
                    websockets.client = ws;
                    console.log("connected client_udp ws");
                    break;
                case 3:
                    websockets.potentiometer = ws;
                    console.log("connected potentiometer ws");
                    const floats = new Float32Array([1, 1, 1, 1, 1]);
                    ws.send(floats.buffer);
                    break;
                case 5:
                    websockets.dataRate = ws;
                    console.log("connected data rate ws");
                    break;
                case 6:
                    websockets.gyroRate = ws;
                    console.log("connected gyro ws");
                    break;
                case 99:
                    const j = JSON.parse(msg);
                    if (j.role == 'ros') {
                        rosSocket[j.camID] = ws;
                    } else if (j.role == 'display') {
                        displaySocket[j.camID] = ws;
                    }
                    break;
                default:
                    break;
            }
            firstMessage = false;
        } else {
            if(websockets.client) {
                websockets.client.send(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('Disconnected Websocket client');
    });
});


const motorFeedbackSocket = new ServerSocket(2001, (ServerSocket.motorFeedbackOnMessage));
const gyroPort = new ServerSocket(2027, ServerSocket.gyroOnMessage);
