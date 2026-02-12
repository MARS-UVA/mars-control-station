const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');

const ServerSocket = require('./udp_server');

const WS_PORT = 3001;

const FEEDBACK_PORT = 2001;
const SIGNALING_PORT = 6767;


const webSocketServer = new WebSocket.Server({port: WS_PORT});

let websockets = {
    udpServer: null,
    udpClient: null,
    motorCurrent: null,
    gyroRate: null
};

webSocketServer.on('connection', (ws) => {
    firstMessage = true;

    ws.on('message', (message) => {
        if(firstMessage) {
            switch (message.readUInt8()) {
                case 0:
                    websockets.udpServer = ws;
                    console.log("connected udp server ws");
                    break;
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

const feedbackSocket = new ServerSocket(FEEDBACK_PORT, (ServerSocket.feedbackOnMessage));
const signalingServer = new SignalingServer(SIGNALING_PORT);
