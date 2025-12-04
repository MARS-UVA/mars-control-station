const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');

const ServerSocket = require('./udp_server');


const MESSAGE_LENGTH = 1500;
const HEADER_LENGTH = 10;
const WS_PORT = 3001;

const webSocketServer = new WebSocket.Server({port: WS_PORT});

let websockets = {
    udpClient: null,
    motorCurrent: null,
    gyroRate: null
};
// 2 of each as we want 2 streams
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
                    websockets.udpClient = ws;
                    console.log("connected client_udp ws");
                    break;
                case 6:
                    websockets.gyroRate = ws;
                    console.log("connected gyro ws");
                    break;
                case 99:
                    const j = JSON.parse(msg);
                    if (j.role == 'ros') {
                        rosSocket[j.camID] = ws;
                        ws.camID = j.camID;
                        console.log("Webcam Feed Connected");
                    } else if (j.role == 'display') {
                        displaySocket[j.camID] = ws;
                        ws.camID = j.camID;
                        console.log("Display Component Connected");
                    }
                    break;
                default:
                    break;
            }
            firstMessage = false;
        } else {
            if(websockets.udpClient) {
                websockets.udpClient.send(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('Disconnected Websocket client');
    });
});


const feedbackSocket = new ServerSocket(2001, (ServerSocket.feedbackOnMessage));
