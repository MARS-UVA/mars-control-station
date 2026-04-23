const dgram = require('dgram');
const { json } = require('stream/consumers');

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
        this.bucket_ladder_state = 127;
        this.current_trigger = 0; // 1 for right trigger, -1 for left trigger, 0 for neither
        this.lb_on = false;
        this.rb_on = false;
    }

    send_controller_jetson(jsonObj) {
        const buffer = new ArrayBuffer(46);
        const view = new DataView(buffer);
        
        // Set headers
        view.setInt8(0, 0x00); // reserve byte
        view.setInt8(1, 0x00); // packet type 0 for controller data
        view.setUint16(2, 18, true); // number of bytes of actual data (not including header)
        view.setUint16(4, 1, true); // num of packets
        view.setUint16(6, 1, true); // batch packet count
        view.setUint16(8, 0, true); // TODO: crc number

        // Populate the buffer with gamepad data
        view.setInt8(10, jsonObj.gamepad.buttons.x);
        view.setInt8(11, jsonObj.gamepad.buttons.y);
        view.setInt8(12, jsonObj.gamepad.buttons.a);
        view.setInt8(13, jsonObj.gamepad.buttons.b);
        view.setFloat32(14, jsonObj.gamepad.buttons.lt, true);
        view.setFloat32(18, jsonObj.gamepad.buttons.rt, true);
        view.setInt8(22, jsonObj.gamepad.buttons.lb);
        view.setInt8(23, jsonObj.gamepad.buttons.rb);
        view.setInt8(24, jsonObj.gamepad.buttons.dd);
        view.setInt8(25, jsonObj.gamepad.buttons.du);
        view.setInt8(26, jsonObj.gamepad.buttons.l3);
        view.setInt8(27, jsonObj.gamepad.buttons.r3);
        view.setInt8(28, jsonObj.gamepad.buttons.back);
        view.setInt8(29, jsonObj.gamepad.buttons.start);
        view.setFloat32(30, jsonObj.gamepad.leftStick.x, true);
        view.setFloat32(34, jsonObj.gamepad.leftStick.y, true);
        view.setFloat32(38, jsonObj.gamepad.rightStick.x, true);
        view.setFloat32(42, jsonObj.gamepad.rightStick.y, true);
        
        this.socket.send(view, this.jetson_port, this.jetson_ip, (err) => {
            if (err) {
                console.error('Error while sending message to jetson:', err.message);
            }
        });
    }
    send_autonomous_action_jetson(jsonObj) {
        const buffer = new ArrayBuffer(11);
        const view = new DataView(buffer);

        // Set headers
        view.setInt8(0, 0x00); // reserve byte
        view.setInt8(1, 0x01); // packet type 1 for autonomous action data
        view.setUint16(2, 18, true); // number of bytes of actual data (not including header)
        view.setUint16(4, 1, true); // num of packets
        view.setUint16(6, 1, true); // batch packet count
        view.setUint16(8, 0, true); // TODO: crc number

        // Populate the buffer with action data
        view.setInt8(10, jsonObj.actionType);

        this.socket.send(view, this.jetson_port, this.jetson_ip, (err) => {
            if (err) {
                console.error('Error while sending message to jetson:', err.message);
            }
        });
    }

    send_esp(jsonObj) {
        const applyDeadband = (value, deadband = 0.05) => {
            if (Math.abs(value) < deadband) return 0;
            return value;
        }
        const clamp = (value) => {
            return Math.max(-1, Math.min(1, value));
        }
        const toUInt8 = (value) => {
            return Math.round((value + 1) * 127);
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
        if (jsonObj.gamepad2.buttons.lb) {
            if (!this.lb_on) {
                console.log('left bumper pressed');
                this.bucket_ladder_state -= 8;
                this.lb_on = true;
            }
        } else {
            this.lb_on = false;
        }

        if (jsonObj.gamepad2.buttons.rb) {
            if (!this.rb_on) {
                console.log('right bumper pressed');
                this.bucket_ladder_state += 8;
                this.rb_on = true;
            }
        } else {
            this.rb_on = false;
        }

        if (jsonObj.gamepad2.buttons.y) {
            console.log('y pressed');
            this.bucket_ladder_state = 127;
        }

        this.bucket_ladder_state = Math.max(0, Math.min(255, this.bucket_ladder_state));
        let bucket_ladder_actuator = Math.min(254, this.bucket_ladder_state);
        // Conveyor Belt
        let conveyor_belt = 127 * (1 + jsonObj.gamepad2.buttons.rt - jsonObj.gamepad2.buttons.lt);
        // Track Actuators
        let track_actuators = 127;
        if (jsonObj.gamepad2.buttons.dd) {
            console.log('dd pressed');
            track_actuators -= 127;
        } else if (jsonObj.gamepad2.buttons.du) {
            console.log('du pressed');
            track_actuators += 127;
        }

        let buffer = Buffer.alloc(9);
        // header/start stuff
        buffer.writeUInt8(0xFF, 0);
        buffer.writeUInt8(0x00, 1);
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
