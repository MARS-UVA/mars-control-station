const dgram = require('dgram');
const PORT = 8080;
const WebSocket = require('ws');
const JETSON_IP = process.env.JETSON_IP;

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

function sendMessage(ip, command) { // Function to send UDP message to robot
    if (!ip) {
        console.error('No IP address provided'); // Fails if no IP is provided
        return;
    }
    const socket = dgram.createSocket('udp4'); // Creates UDP4 socket
    const payload = JSON.stringify({ command: command }); // Prepares payload of JSON type command
    const buf = Buffer.from(payload); // Converts payload to buffer for UDP transmission

    socket.send(buf, PORT, ip, (err) => { // Sends message
        if (err) {
            console.error('Error sending message:', err.message);
        } else {
            console.log('Message sent successfully');
        }   
        socket.close();
    });

    socket.on('error', (err) => { // Error handling
        console.error('Socket error:', err.message);
        socket.close();
    });
}

ws.onopen = () => {
    const buffer = Buffer.from([2]);
    ws.send(buffer)
    //console.log('ws connected');
};
ws.onmessage = (event) => {
    console.log('Received ws message: ', event.data);
    let jsonObj;
    try {
        jsonObj = JSON.parse(event.data);
    } catch (e) {
        // not JSON
        console.error('Error parsing JSON:', e);
        return;
    }
    if (jsonObj && jsonObj.type === 'command') {
        sendMessage(JETSON_IP, jsonObj.cmd);
        return;
    }
    if (!jsonObj.gamepad) {
        console.error('No gamepad data in message');
        return;
    }
    const gamepadOut = `${jsonObj.gamepad.buttons.x},${jsonObj.gamepad.buttons.y},${jsonObj.gamepad.buttons.a},${jsonObj.gamepad.buttons.b},
    ${jsonObj.gamepad.buttons.lt},${jsonObj.gamepad.buttons.rt},${jsonObj.gamepad.buttons.lb},${jsonObj.gamepad.buttons.rb},${jsonObj.gamepad.buttons.dd},
    ${jsonObj.gamepad.buttons.du},${jsonObj.gamepad.buttons.l3},${jsonObj.gamepad.buttons.r3},
    ${jsonObj.gamepad.buttons.back},${jsonObj.gamepad.buttons.start},${jsonObj.gamepad.leftStick.x},${jsonObj.gamepad.leftStick.y},${jsonObj.gamepad.rightStick.x},
    ${jsonObj.gamepad.rightStick.y}`;

    let message = "pcktcontnt"+gamepadOut;
    //console.log(message);
    client(JETSON_IP, message);
};

function client(ip, data) {
    // Create a UDP socket
    const socket = dgram.createSocket('udp4');
    buffer = Buffer.from(data);
    buffer.writeUInt16LE(buffer.length, 4)

    // Send the message to the server
    socket.send(buffer, PORT, ip, (err) => {
        if (err) {
            console.error('Error while sending message:', err.message);
            socket.close();
            return;
        }
        //console.log('Message sent successfully');
        socket.close();
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
