const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Game State
const players = {};
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

// Physics Config
const ACCEL = 0.4;
const FRICTION = 0.96;       // Normal grip
const DRIFT_FRICTION = 0.99; // Slippery grip
const TURN_SPEED = 0.06;

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle Join
    socket.on('join', (name) => {
        players[socket.id] = {
            id: socket.id,
            name: name.substring(0, 12) || "Racer",
            x: Math.random() * 500 + 1250, // Spawn near center
            y: Math.random() * 500 + 1250,
            angle: 0,
            speed: 0,
            drift: false, // Is drifting?
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        };

        // Send initial data to new player
        socket.emit('init', { 
            selfId: socket.id, 
            players, 
            world: { w: WORLD_WIDTH, h: WORLD_HEIGHT } 
        });

        // Notify others
        socket.broadcast.emit('playerJoined', players[socket.id]);
    });

    // Handle Input & Physics Loop
    socket.on('input', (input) => {
        const p = players[socket.id];
        if (!p) return;

        // Acceleration
        if (input.up) p.speed += ACCEL;
        if (input.down) p.speed -= ACCEL;

        // Turning (only works if moving)
        if (Math.abs(p.speed) > 0.1) {
            const dir = p.speed > 0 ? 1 : -1;
            if (input.left) p.angle -= TURN_SPEED * dir;
            if (input.right) p.angle += TURN_SPEED * dir;
        }

        // Drifting Logic
        p.drift = input.drift;
        const currentFriction = p.drift ? DRIFT_FRICTION : FRICTION;
        p.speed *= currentFriction;

        // Apply Velocity
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Map Boundaries
        p.x = Math.max(0, Math.min(WORLD_WIDTH, p.x));
        p.y = Math.max(0, Math.min(WORLD_HEIGHT, p.y));
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

// Broadcast Game State (60 FPS)
setInterval(() => {
    io.emit('stateUpdate', players);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
