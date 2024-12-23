// server.js
const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 8080 });

server.on("connection", (socket) => {
    socket.on("message", (message) => {
        // Broadcast message to all clients except the sender
        server.clients.forEach((client) => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

console.log("WebSocket server running on ws://localhost:8080");
