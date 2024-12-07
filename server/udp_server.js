const fs = require('fs');
const dgram = require('dgram');

// Constants
const PORT = 8080;
const MESSAGE_LENGTH = 1500;

// Create a UDP socket
const server = dgram.createSocket('udp4');

let recievedChunks = {};
let totalChunks = 0;


// Event: On server start
server.on('listening', () => {
    const address = server.address();
    console.log(`Server is listening on ${address.address}:${address.port}`);
    // Set buffer size
    server.setRecvBufferSize(MESSAGE_LENGTH);
});

// Event: On receiving a message
server.on('message', (message, remote) => {
    //console.log(`Received message from IP: ${remote.address} and port: ${remote.port}`);
    //console.log(`Msg from client: ${message.toString()}`);

    const sequenceNumber = message[0];
    const totalPackets = (message[1] << 8) | message[2];
    const chunkData = message.subarray(3);
    console.log(`Recieved packet ${sequenceNumber + 1} of ${totalPackets}`);
    recievedChunks[sequenceNumber] = chunkData;
    totalChunks = totalPackets;

    // Check if all packets have been recieved
    if(Object.keys(recievedChunks).length == totalChunks) {
        console.log("All chunks recieved. Reassembling image.")
        const fullImage = Buffer.concat(Object.values(recievedChunks));

        // Write image to file
        fs.writeFile('output.jpg', fullImage, (err) => {
            if(err) {
                console.error("Error writing file: ", err)
            } else {
                console.log("File reassembled and saved successfully (?)")
            }
        })

        // Clear chunks to recieve new image
        recievedChunks = {};
    }

    /*
    // output image tetings
    fs.writeFile('output.jpg', message, (err) => {
        if (err) {
            console.error('Error writing the file:', err);
        } else {
            console.log('JPEG file created successfully as output.jpg');
        }
    });
    */

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
server.bind(PORT, '127.0.0.1', () => {
    console.log("Socket bound successfully");
});

// Event: On error
server.on('error', (err) => {
    console.error(`Server error: ${err.stack}`);
    server.close();
});

// Event: On close
server.on('close', () => {
    console.log("Server socket closed");
});
