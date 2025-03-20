const dgram = require('dgram');
const PORT = 8080;
const WebSocket = require('ws');


const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => {
    const buffer = Buffer.from([2]);
    ws.send(buffer)
    console.log('ws connected');
};
ws.onmessage = (event) => {
    console.log(JSON.parse(event.data));
    client('127.0.0.1', event.data);
};

function client(ip, data) {
    // Create a UDP socket
    const socket = dgram.createSocket('udp4');

    // Send the message to the server
    socket.send(Buffer.from(data), PORT, ip, (err) => {
        if (err) {
            console.error('Error while sending message:', err.message);
            socket.close();
            return;
        }
        console.log('Message sent successfully');
    });

    // Listen for a response from the server
    /*socket.on('message', (message) => {
        console.log("Server's response:", message.toString());
        socket.close(); // Close the socket after receiving the response
    });*/

    // Handle socket errors
    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
        socket.close();
    });
}


/*
// Run the client function
if (process.argv.length !== 4) {
    console.error('Usage: node client.js <IP_ADDRESS> <DATA>');
    process.exit(1);
}


const ip = process.argv[2];
const data = process.argv[3];
client(ip, data);
*/


//export default client;