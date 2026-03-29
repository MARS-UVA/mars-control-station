const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');

const ServerSocket = require('./udp_server');
const SignalingServer = require('./signaling_server')
const UDPClient = require('./client_udp')

const WS_PORT = 3001;

const FEEDBACK_PORT = 2001;
const CAMERA1_SIGNALING_PORT = 6767;
const CAMERA2_SIGNALING_PORT = 6969;
const JETSON_IP = process.env.JETSON_IP;
const ESP_IP = process.env.ESP_IP;
const JETSON_PORT = 8080;
const ESP_PORT = 2001;

const webSocketServer = new WebSocket.Server({ port: WS_PORT });
const feedbackSocket = new ServerSocket(FEEDBACK_PORT, (ServerSocket.feedbackOnMessage));
const signalingServer1 = new SignalingServer(CAMERA1_SIGNALING_PORT);
const signalingServer2 = new SignalingServer(CAMERA2_SIGNALING_PORT);
const udpClient = new UDPClient(JETSON_PORT, JETSON_IP, ESP_PORT, ESP_IP);

let websockets = {
    udpServer: null,
    robotFeedback: null,
    gamepad: null,
};

webSocketServer.on('connection', (ws) => {
    let firstMessage = true;

    ws.on('message', (message) => {
        if (firstMessage) {
            console.log(typeof message, message);
            switch (message.readUInt8()) {
                case 0:
                    websockets.udpServer = ws;
                    console.log("connected udp server ws");
                    break;
                case 1:
                    websockets.robotFeedback = ws;
                    console.log("connected robot feedback ws");
                    break;
                case 2:
                    // Removed this, can use for something else later
                    break;
                case 51:
                    websockets.gamepad = ws;
                    console.log('connected gamepad ws');
                    break;
                default:
                    break;
            }
            firstMessage = false;
        } else {
            if (ws === websockets.gamepad) {
                try {
                    data = JSON.parse(message);
                    // console.log('received gamepad data: ', data.gamepad.leftStick, data.gamepad2.leftStick);
                } catch (e) {
                    console.error('error parsing json: ', e);
                    return;
                }
                if (data.type === 'uiState') {            
                    if (data.gamepad2) {
                        // Handle sending to both esp and jetson
                    } else if (data.gamepad) {
                        // Handle sending only to jetson
                        console.log('sending controller to jetson')
                        udpClient.send_controller_jetson(data);
                    }
                }
                else if (data.type === 'action') {
                    udpClient.send_action_jetson(data);
                }
            } else if (ws === websockets.udpServer) {
                // websockets.robotFeedback.send(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('Disconnected Websocket client');
    });
});
