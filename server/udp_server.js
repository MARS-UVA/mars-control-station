const fs = require('fs');
const dgram = require('dgram');


const MESSAGE_LENGTH = 1500;

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
            this.server.setRecvBufferSize(MESSAGE_LENGTH);
        });

        // Event: On receiving a message
        this.server.on('message', (message, remote) => {
            //console.log(`Received message from IP: ${remote.address} and port: ${remote.port}`);
            //console.log(`Msg from client: ${message.toString()}`);

            const receivedChunks = {}
            const sequenceNumber = message[0];
            const totalPackets = (message[1] << 8) | message[2];
            const chunkData = message.subarray(3);
            console.log(`Received packet ${sequenceNumber + 1} of ${totalPackets}`);
            receivedChunks[sequenceNumber] = chunkData;
            const totalChunks = totalPackets;

            // Check if all packets have been received
            // Probably keep check recievedChunks length in default, rest in logic
            if(Object.keys(receivedChunks).length == totalChunks) {
                // This variable (function) does logic speicific to type of data socket handles
                onMessage(receivedChunks)
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
    const fullImage = Buffer.concat(Object.values(receivedChunks));

    // Write image to file
    fs.writeFile('output.jpg', fullImage, (err) => {
        if (err) {
            console.error("Error writing file: ", err)
        } else {
            console.log("File reassembled and saved successfully (?)")
        }
    })
}

const imageSocket = new ServerSocket(8080, imageOnMessage)
const motorFeedbackSocket = new ServerSocket(2000, (receivedChunks) => {
    console.log("packet received")
    console.log(receivedChunks)
})