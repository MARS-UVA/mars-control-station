const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');


const MESSAGE_LENGTH = 1500;
const HEADER_LENGTH = 10;
const WS_PORT = 3001;

const webSocketServer = new WebSocket.Server({port: WS_PORT});
let lastImageBuffer = null;

let websockets = {
    image: null,
    motorCurrent: null,
    client: null,
    potentiometer: null
};


webSocketServer.on('connection', (ws) => {
    let firstMessage = true;

    ws.on('message', (message) => {
        if(firstMessage) {
            switch (message.readUInt8()) {
                case 0:
                    websockets.image = ws;
                    console.log("connected webcam ws");
                    if(lastImageBuffer) {
                        ws.send(lastImageBuffer);
                    }
                    break;
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
                default:
                    break;
            }
            firstMessage = false;
        } else {
            websockets.client.send(message);
        }
    });

    ws.on('close', () => {
        console.log('Disconnected Websocket client');
    });
});


class ServerSocket {
    // Local Variables
    /**
     * 
     * @param {Number} port 
     * @param {(receivedChunks: object) => void} onMessage 
     */
    constructor (port, onMessage) {
        this.PORT = port;
        this.receivedChunks = {}
        this.packetCount = 0;
        
        // Create a UDP socket
        this.server = dgram.createSocket('udp4');
    
        // Event: On server start
        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`Server is listening on ${address.address}:${address.port}`);
            // Set buffer size
            this.server.setRecvBufferSize(MESSAGE_LENGTH * 10000);    // This buffer could change size here to be more optimal im sure
        });

        this.receivedChunks = {}
        this.packetCount = 0;

        // Event: On receiving a message
        this.server.on('message', (message, remote) => {
            console.log(message.subarray(0, 10));
            //console.log(`Received message from IP: ${remote.address} and port: ${remote.port}`);
            //console.log(`Msg from client: ${message.toString()}`);

            // const receivedChunks = {}
            const sequenceNumber = (message[1] << 8) | message[0];
            const totalPackets = (message[3] << 8) | message[2];
            const chunkData = message.subarray(10);

            console.log(`Received packet ${sequenceNumber + 1} of ${totalPackets}`);
            console.log(chunkData.length);
            this.receivedChunks[sequenceNumber] = chunkData;
            const totalChunks = totalPackets;
            //Check if all packets have been received
            //Probably keep check recievedChunks length in default, rest in logic
            if(sequenceNumber+1 >= totalChunks) {
                // This variable (function) does logic speicific to type of data socket handles
                onMessage(this.receivedChunks)
                this.receivedChunks = {}
            }
            
            /*
            // Echo the message back to the client
            server.send(message, 0, message.length, remote.port, remote.address, (err) => {
                if (err) {
                    console.error("Error sending message:", err.message);
                } else {
                    console.log("Message echoed back to client");
                }
            });
            */
        });

        // Bind the server to the port and IP
        this.server.bind(this.PORT, '0.0.0.0', () => {
            console.log("Socket bound successfully");
        });

        // Event: On error
        this.server.on('error', (err) => {
            console.error(`Server error: ${err.stack}`);
            this.server.close();
        });

        // Event: On close
        this.server.on('close', () => {
            console.log("Server socket closed");
        });
    }
}

const imageOnMessage = (receivedChunks) => {
    console.log("All chunks received. Reassembling image.");
    console.log(Object.keys(receivedChunks));
    const fullImage = Buffer.concat(Object.values(receivedChunks));
    lastImageBuffer = fullImage;

    // Send to websocket
    websockets.image.send(lastImageBuffer);
    console.log("sent image to client");
}

const motorFeedbackOnMessage = (data) => {
    const buffer = Buffer.concat(Object.values(data));
    if(websockets.motorCurrent) websockets.motorCurrent.send(buffer.subarray(0, 36));
}

const imageSocket = new ServerSocket(2000, imageOnMessage);
const motorFeedbackSocket = new ServerSocket(2001, (motorFeedbackOnMessage));
const robotPosePort = new ServerSocket(2003, imageOnMessage);   // if time permits
const obstaclePoesePort = new ServerSocket(2008, imageOnMessage);   // if time permits
const pathPort = new ServerSocket(2025, imageOnMessage);    // if time permits
