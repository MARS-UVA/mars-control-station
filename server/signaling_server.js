const WebSocket = require('ws');


class SignalingServer {
    // Local Variables
    /**
     * 
     * @param {Number} port
     */
    constructor (port) {
        this.PORT = port;

        // Initialize websocket server
        this.server = new WebSocket.Server({ port: this.PORT});
        console.log('Signaling Server running on ws://${this.port}')

        // On client connection
        this.server.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
    }

    handleConnection(ws, req) {
    const remoteAddress = req.socket.remoteAddress;
    console.log('Signaling Client connected: ${remoteAddress}');

    // Received message from client
    ws.on('message', (message) => {
        this.broadcast(ws, message);
    });

    // Connection Closed
    ws.on('close', () => {
        console.log('Signaling Client disconnected: ${remoteAddress}');
    })

    // Error
    ws.on('error', (e) => {
        console.error('Signaling Clinet error: ${e}')
    })
}

    /**
     * Sends the message to all clients except the sender
     * @param {WebSocket} sender - The client who sent the message
     * @param {RawData} message - The message data
     */
    broadcast(sender, message) {
        this.server.clients.forEach((client) => {
            // Check if client is open and is NOT the sender
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

    

module.exports = SignalingServer;