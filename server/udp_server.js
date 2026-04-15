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
    constructor (port) {
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
             console.log(message.subarray(0, 10));
            console.log(`Received message from IP: ${remote.address} and port: ${remote.port}`);
            console.log(`Msg from client: ${new Uint8Array(message.buffer)}`);

            // const receivedChunks = {}
            const sequenceNumber = (message[1] << 8) | message[0];
            const totalPackets = (message[3] << 8) | message[2];
            const chunkData = message.subarray(10);

             console.log(`Received packet ${sequenceNumber + 1} of ${totalPackets}`);
            // console.log(chunkData.length);
            this.receivedChunks[sequenceNumber] = chunkData;
            const totalChunks = totalPackets;
            //Check if all packets have been received
            //Probably keep check recievedChunks length in default, rest in logic
            if(sequenceNumber+1 >= totalChunks) {
                // This variable (function) does logic speicific to type of data socket handles
                this.onMessage(this.receivedChunks)
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

    onMessage = (data) => {
        const buffer = Buffer.concat(Object.values(data));
        const messageBuf = buffer.subarray(0, 72);
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(messageBuf);
        } else {
            console.error("WebSocket is not open. Cannot send message.");
        }
    }
}

module.exports = ServerSocket;
