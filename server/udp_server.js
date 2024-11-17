const dgram = require('dgram');

// Constants
const PORT = 8080;
const MESSAGE_LENGTH = 100;

// Create a UDP socket
const server = dgram.createSocket('udp4');

// Event: On server start
server.on('listening', () => {
    const address = server.address();
    console.log(`Server is listening on ${address.address}:${address.port}`);
});

// Event: On receiving a message
server.on('message', (message, remote) => {
    console.log(`Received message from IP: ${remote.address} and port: ${remote.port}`);
    console.log(`Msg from client: ${message.toString()}`);

    // Echo the message back to the client
    server.send(message, 0, message.length, remote.port, remote.address, (err) => {
        if (err) {
            console.error("Error sending message:", err.message);
        } else {
            console.log("Message echoed back to client");
        }
    });
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
