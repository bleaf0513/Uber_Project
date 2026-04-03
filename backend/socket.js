const socketIo = require('socket.io');
const userModel = require('./models/user.model');
const captainModel = require('./models/captain.model');

let io;

const DEFAULT_ORIGINS = [
    'https://centralgo.mercalan.com.co',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

function parseClientOrigins() {
    const raw = process.env.CLIENT_ORIGINS;
    const fromEnv =
        raw && String(raw).trim()
            ? String(raw).split(',').map((s) => s.trim()).filter(Boolean)
            : [];
    return [...new Set([...fromEnv, ...DEFAULT_ORIGINS])];
}

function normalizeOrigin(origin) {
    if (!origin) return '';
    try {
        const u = new URL(origin);
        u.pathname = '';
        u.search = '';
        u.hash = '';
        return u.href.replace(/\/$/, '');
    } catch {
        return String(origin).replace(/\/$/, '');
    }
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    const list = parseClientOrigins();
    if (list.includes('*')) return true;
    const norm = normalizeOrigin(origin);
    if (list.some((o) => normalizeOrigin(o) === norm)) return true;
    try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host.endsWith('.vercel.app')) return true;
        if (host.endsWith('.onrender.com')) return true;
        if (host === 'mercalan.com.co' || host.endsWith('.mercalan.com.co')) return true;
    } catch {
        /* ignore */
    }
    return false;
}

function initializeSocket(server) {
    io = socketIo(server, {
        cors: {
            // Reflect / allow any origin (same as previous "*"). Optional CLIENT_ORIGINS is for logging only.
            origin(origin, callback) {
                if (origin && !isOriginAllowed(origin)) {
                    console.warn('[socket] Connect from non-listed Origin (still allowed):', origin);
                }
                callback(null, true);
            },
            methods: ['GET', 'POST'],
        },
        // Render / free proxies: long cold-starts and idle disconnects — keep handshakes alive longer.
        connectTimeout: 60000,
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
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
            // //console.log("update-location-captain", data);
            const { userId, location } = data;

            if (!location || !location.ltd || !location.lng) {
                return socket.emit('error', { message: 'Invalid location data' });
            }

            await captainModel.findByIdAndUpdate(userId, {
                location: {
                    ltd: location.ltd,
                    lng: location.lng
                }
            });
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
};

module.exports = { initializeSocket, sendMessageToSocketId };
