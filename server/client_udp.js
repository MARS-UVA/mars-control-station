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

    send_esp(jsonObj) {
        const applyDeadband = (value, deadband = 0.05) => {
            if(Math.abs(value) < deadband) return 0;
            return value;
        }
        const clamp = (value) => {
            return Math.max(-1, Math.min(1, value));
        }
        const toUInt8 = (value) => {
            return Math.round((value+1) * 127);
        }
        const fullForwardMagnitude = 0.6;
        const deadband = 0.05;
        // --- read inputs ---
        let linearInput = jsonObj.gamepad2.leftStick.y;          // forward/back
        let turnInput = -jsonObj.gamepad2.leftStick.x;           // inverted like "left_x_inverted"
        // --- apply deadband ---
        let linearRate = applyDeadband(linearInput, deadband);
        let turnRate = applyDeadband(turnInput, deadband);
        // --- arcade drive math ---
        const linearComponent = fullForwardMagnitude * linearRate;
        const angularComponent = (1 - fullForwardMagnitude) * turnRate;
        let left_wheel_speed = linearComponent - angularComponent;
        let right_wheel_speed = linearComponent + angularComponent;
        // Convert to Bytes
        left_wheel_speed = toUInt8(clamp(left_wheel_speed));
        right_wheel_speed = toUInt8(clamp(right_wheel_speed));
        // Bucket ladder up and down
        let bucket_ladder_actuator = 127;
        if(jsonObj.gamepad2.buttons.x) {
            console.log('x pressed');
            bucket_ladder_actuator = 127 - 126/2;
        } else if(jsonObj.gamepad2.buttons.a) {
            console.log('a pressed');
            bucket_ladder_actuator = 127 + 126/2;
        }
        // Conveyor Belt
        let conveyor_belt = 127;
        if(jsonObj.gamepad2.buttons.y) {
            console.log('y pressed')
            conveyor_belt = 127 + 126/2;
        }
        // Track Actuators
        let track_actuators = 127;
        if(jsonObj.gamepad2.buttons.dd) {
            console.log('dd pressed');
            track_actuators = 127 - 126/2;
        } else if(jsonObj.gamepad2.buttons.du) {
            console.log('du pressed');
            track_actuators = 127 + 126/2;
        }

        let buffer = Buffer.alloc(10);
        // header/start stuff
        buffer.writeUInt8(0xFF, 0);
        buffer.writeUInt8(0xFF, 1);
        // buffer.writeUInt8(0x04, 2);
        // Calculate wheel speeds
        buffer.writeUInt8(left_wheel_speed, 2);
        buffer.writeUInt8(left_wheel_speed, 3);
        buffer.writeUInt8(right_wheel_speed, 4);
        buffer.writeUInt8(right_wheel_speed, 5);
        // Non-wheel motors
        buffer.writeUInt8(bucket_ladder_actuator, 6);
        buffer.writeUInt8(conveyor_belt, 7);
        buffer.writeUInt8(track_actuators, 8);
        console.log(buffer);
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
