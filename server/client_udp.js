const dgram = require('dgram');

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

class UDPClient {
    constructor(jetson_port, jetson_ip, esp_port, esp_ip) {
        this.jetson_port = jetson_port;
        this.jetson_ip = jetson_ip;
        this.esp_port = esp_port;
        this.esp_ip = esp_ip;
        this.socket = dgram.createSocket('udp4');
        this.socket.on('error', (err) => {
            console.error('Socket error:', err.message);
        });
    }

    send_jetson(jsonObj) {
        const gamepadOut = `${jsonObj.gamepad.buttons.x},${jsonObj.gamepad.buttons.y},${jsonObj.gamepad.buttons.a},${jsonObj.gamepad.buttons.b},`
            +`${jsonObj.gamepad.buttons.lt},${jsonObj.gamepad.buttons.rt},${jsonObj.gamepad.buttons.lb},${jsonObj.gamepad.buttons.rb},${jsonObj.gamepad.buttons.dd},`
            +`${jsonObj.gamepad.buttons.du},${jsonObj.gamepad.buttons.l3},${jsonObj.gamepad.buttons.r3},`
            +`${jsonObj.gamepad.buttons.back},${jsonObj.gamepad.buttons.start},${jsonObj.gamepad.leftStick.x},${jsonObj.gamepad.leftStick.y},${jsonObj.gamepad.rightStick.x},`
            +`${jsonObj.gamepad.rightStick.y}`;
        let message = "pcktcontnt"+gamepadOut;
        let buffer = Buffer.from(message);
        buffer.writeUInt8(jsonObj.commands.action, 0);
        buffer.writeUInt16LE(buffer.length, 4);
        this.socket.send(buffer, this.jetson_port, this.jetson_ip, (err) => {
            if (err) {
                console.error('Error while sending message to jetson:', err.message);
            }
        });
    }
    send_esp(buffer) {
        this.socket.send(buffer, this.esp_port, this.esp_ip, (err) => {
            if (err) {
                console.error('Error while sending message to esp:', err.message);
            }
        })
    }

    close() {
        this.socket.close();
    }
}

module.exports = UDPClient;
