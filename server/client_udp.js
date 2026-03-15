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

ws.onopen = () => {
    const buffer = Buffer.from([2]);
    ws.send(buffer)
    //console.log('ws connected');
};
ws.onmessage = (event) => {
    //console.log('Received ws message: ', event.data);
    let jsonObj;
    try {
        jsonObj = JSON.parse(event.data);
    } catch (e) {
        // not JSON
        console.error('Error parsing JSON:', e);
        return;
    }

    if (!jsonObj.gamepad) {
        console.error('No gamepad data in message');
        return;
    }
    // commandOut is the action state, 0 = controller, 1 = dig, 2 = dump, 3 = stop
    const commandOut = `${jsonObj.commands.action}`;
    // gamepadOut is the button and stick states, in the order of x, y, a, b, lt, rt, lb, rb, dd, du, l3, r3, back, start, leftStick.x, leftStick.y, rightStick.x, rightStick.y
    const gamepadOut = `${jsonObj.gamepad.buttons.x},${jsonObj.gamepad.buttons.y},${jsonObj.gamepad.buttons.a},${jsonObj.gamepad.buttons.b},`
    +`${jsonObj.gamepad.buttons.lt},${jsonObj.gamepad.buttons.rt},${jsonObj.gamepad.buttons.lb},${jsonObj.gamepad.buttons.rb},${jsonObj.gamepad.buttons.dd},`
    +`${jsonObj.gamepad.buttons.du},${jsonObj.gamepad.buttons.l3},${jsonObj.gamepad.buttons.r3},`
    +`${jsonObj.gamepad.buttons.back},${jsonObj.gamepad.buttons.start},${jsonObj.gamepad.leftStick.x},${jsonObj.gamepad.leftStick.y},${jsonObj.gamepad.rightStick.x},`
    +`${jsonObj.gamepad.rightStick.y}`;
    
    // Combine into a single message
    let message = "pcktcontnt"+gamepadOut;
    // Converts to buffer to let the Jetson read it
    let buffer = Buffer.from(message);

    // write commandOut to the first byte
    buffer.writeUInt8(jsonObj.commands.action, 0);
    buffer.writeUInt16LE(buffer.length, 4);
    //console.log(message);
    client(JETSON_IP, buffer);
};

function client(ip, buffer) {
    // Create a UDP socket
    const socket = dgram.createSocket('udp4');

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
