const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');


const MESSAGE_LENGTH = 1500;
const WS_PORT = 3001;

const webSocketServer = new WebSocket.Server({port: WS_PORT});
let lastImageBuffer = null;

const websockets = {
    image: null,
    motorCurent: null,
    client: null
};


webSocketServer.on('connection', (ws) => {
    let firstMessage = true;
    console.log('Websocket client connected');
    if(lastImageBuffer) {
        ws.send(lastImageBuffer);
        console.log('Sent image to client')
    }

    ws.on('message', (message) => {
        if(firstMessage) {
            switch (message.readUInt8(0)) {
                case 0:
                    websockets.image = ws;
                    if(lastImageBuffer) {
                        ws.send(lastImageBuffer)
                    }
                    break;
                case 1:
                    websockets.motorCurent = ws;
                    break;
                case 2:
                    websockets.client = ws;
                    break;
                default:
                    break;
            }
            firstMessage = false;
        } else {
            websockets[client].send(message);
        }
    });

    ws.on('close', () => {
        console.log('Disconnected Websocket server');
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
        
        // Create a UDP socket
        this.server = dgram.createSocket('udp4');
    
        // Event: On server start
        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`Server is listening on ${address.address}:${address.port}`);
            // Set buffer size
            this.server.setRecvBufferSize(MESSAGE_LENGTH * 100);    // This buffer could change size here to be more optimal im sure
        });

        this.receivedChunks = {}

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

            // Check if all packets have been received
            // Probably keep check recievedChunks length in default, rest in logic
            if(sequenceNumber + 1 == totalChunks) {
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
        this.server.bind(this.PORT, '127.0.0.1', () => {
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
    console.log("All chunks received. Reassembling image.")
    console.log(Object.keys(receivedChunks))
    const fullImage = Buffer.concat(Object.values(receivedChunks));
    lastImageBuffer = fullImage;

    // Send to websocket
    websockets[image].send(lastImageBuffer) ;
    console.log("sent image to client");
}

const imageSocket = new ServerSocket(2000, imageOnMessage)
const motorFeedbackSocket = new ServerSocket(2001, (receivedChunks) => {
    console.log("packet received")
    console.log(receivedChunks)
})