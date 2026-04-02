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
        cookie: false,
        // Slightly shorter than many edge idle timeouts; reduces stale long-polls when client uses polling fallback.
        pingTimeout: 20000,
        pingInterval: 10000,
        connectTimeout: 45000,
        perMessageDeflate: false,
        httpCompression: false,
        // Let clients upgrade to WebSocket (recommended on Render; polling-only sees more 502s behind the proxy).
        transports: ['websocket', 'polling'],
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (isOriginAllowed(origin)) return callback(null, origin);
                console.warn('[socket] CORS rejected origin:', origin);
                return callback(null, false);
            },
            methods: ['GET', 'POST', 'OPTIONS'],
            credentials: false,
            allowedHeaders: ['Content-Type', 'Authorization'],
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
};

module.exports = { initializeSocket, sendMessageToSocketId };
