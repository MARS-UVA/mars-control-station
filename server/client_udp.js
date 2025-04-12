const dgram = require('dgram');
const PORT = 8080;
const WebSocket = require('ws');

function crc32bit(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            if ((crc & 1) === 1) {
                crc = (crc >>> 1) ^ 0xEDB88320;
            } else {
                crc >>>= 1;
            }
        }
    }
    return ~crc >>> 0; // Ensure the result is a positive integer
}


const ws = new WebSocket("ws://localhost:3001");

wsWebSocket.onopen = () => {
    const buffer = Buffer.from([2]);
    ws.send(buffer)
    console.log('ws connected');
};
ws.onmessage = (event) => {
    let jsonObj = JSON.parse(event.data);
    console.log(jsonObj);

    const gamepadOut = `${jsonObj.buttons.x},${jsonObj.buttons.y},${jsonObj.buttons.a},${jsonObj.buttons.b},
    ${jsonObj.buttons.lt},${jsonObj.buttons.rt},${jsonObj.buttons.lb},${jsonObj.buttons.rb},${jsonObj.buttons.dd},
    ${jsonObj.buttons.du},${jsonObj.buttons.l3},${jsonObj.buttons.r3},
    ${jsonObj.buttons.back},${jsonObj.buttons.start},${jsonObj.leftStick.x},${jsonObj.leftStick.y},${jsonObj.rightStick.x},
    ${jsonObj.rightStick.y}`;

    let message = "pcktcontnt"+gamepadOut;
    console.log(message);
    client('192.168.0.105', message);
};

function client(ip, data) {
    // Create a UDP socket
    const socket = dgram.createSocket('udp4');

    socket.bind({
        port : PORT,
        address : ip,
        exclusive : false
    }
    )

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
