const socketIo = require('socket.io');
const userModel = require('./models/user.model');
const captainModel = require('./models/captain.model');

let io;

/** Comma-separated list in CLIENT_ORIGINS, e.g. https://centralgo.mercalan.com.co,https://app.vercel.app */
function parseClientOrigins() {
    const raw = process.env.CLIENT_ORIGINS;
    if (raw && String(raw).trim()) {
        return String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [
        'https://centralgo.mercalan.com.co',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    const list = parseClientOrigins();
    if (list.includes('*')) return true;
    if (list.includes(origin)) return true;
    try {
        const host = new URL(origin).hostname;
        if (host.endsWith('.vercel.app')) return true;
        if (host.endsWith('.onrender.com')) return true;
    } catch {
        /* ignore */
    }
    return false;
}

function initializeSocket(server) {
    io = socketIo(server, {
        // Shorter ping cycle reduces long-held polling requests (Render proxies sometimes 502 those).
        pingTimeout: 20000,
        pingInterval: 10000,
        // Lighter responses through some CDNs / proxies
        perMessageDeflate: false,
        httpCompression: false,
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (isOriginAllowed(origin)) return callback(null, origin);
                return callback(null, false);
            },
            methods: ['GET', 'POST', 'OPTIONS'],
            credentials: false,
            allowedHeaders: ['Content-Type'],
        },
    });

    io.on('connection', (socket) => {
        socket.on('join', async (data) => {
            try {
                const { userId, userType } = data;
                if (userType === 'user') {
                    await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
                } else if (userType === 'captain') {
                    await captainModel.findByIdAndUpdate(userId, { socketId: socket.id });
                }
            } catch (err) {
                console.error('[socket] join error:', err.message);
            }
        });

        socket.on('update-location-captain', async (data) => {
            try {
                const { userId, location } = data;
                if (!location || location.ltd == null || location.lng == null) {
                    return socket.emit('error', { message: 'Invalid location data' });
                }
                await captainModel.findByIdAndUpdate(userId, {
                    location: {
                        ltd: location.ltd,
                        lng: location.lng,
                    },
                });
            } catch (err) {
                console.error('[socket] update-location-captain:', err.message);
            }
        });

        socket.on('disconnect', () => {});
    });
}

const sendMessageToSocketId = (socketId, messageObject) => {
    if (!socketId) {
        return;
    }
    if (io) {
        io.to(socketId).emit(messageObject.event, messageObject.data);
    }
}

module.exports = { initializeSocket, sendMessageToSocketId };