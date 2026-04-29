const fs = require('fs');
const dgram = require('dgram');
const WebSocket = require('ws');

const MESSAGE_LENGTH = 1500;
const HEADER_LENGTH = 10;


class ServerSocket {
    // Local Variables
    /**
     * 
     * @param {Number} port 
     */
    constructor(port) {
        this.PORT = port;
        this.receivedChunks = {}
        this.packetCount = 0;

        this.ws = new WebSocket("ws://localhost:3001");
        this.ws.onopen = () => {
            const buffer = Buffer.from([0]);
            this.ws.send(buffer)
            //console.log('ws connected');
        };

        // Create a UDP socket
        this.server = dgram.createSocket('udp4');

        // Event: On server start
        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`Server is listening on ${address.address}:${address.port}`);
            // Set buffer size
            this.server.setRecvBufferSize(MESSAGE_LENGTH * 10000);    // This buffer could change size here to be more optimal im sure
        });

        // Event: On receiving a message
        this.server.on('message', (message, remote) => {
            const header = {
                reserved: message.readUInt8(0),
                packetType: message.readUInt8(1),
                packetLength: message.readUInt16LE(2),
                numPackets: message.readUInt16LE(4),
                batchPacketCount: message.readUInt16LE(6),
                crc: message.readUInt16LE(8),
            };

            const payload = message.subarray(HEADER_LENGTH);
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(payload);
            }
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

module.exports = ServerSocket;
