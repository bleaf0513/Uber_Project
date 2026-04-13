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
        // ignore
    }

    return false;
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function isValidCoordinate(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isValidLatitude(lat) {
    return isValidCoordinate(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
    return isValidCoordinate(lng) && lng >= -180 && lng <= 180;
}

function isColombiaCoordinate(lat, lng) {
    // Rango amplio y seguro para Colombia
    return lat >= -4.5 && lat <= 16.5 && lng >= -81.9 && lng <= -66.0;
}

function describeCoordinateIssue(lat, lng) {
    if (!isValidLatitude(lat)) return 'Invalid latitude';
    if (!isValidLongitude(lng)) return 'Invalid longitude';
    if (!isColombiaCoordinate(lat, lng)) return 'Location outside Colombia bounds';
    return '';
}

async function clearCaptainSocketIfMatches(userId, socketId) {
    if (!userId || !socketId) return;

    await captainModel.findOneAndUpdate(
        { _id: userId, socketId },
        {
            $set: {
                socketId: null,
                'onlineSession.lastSeenAt': new Date(),
            },
        }
    );
}

async function clearUserSocketIfMatches(userId, socketId) {
    if (!userId || !socketId) return;

    await userModel.findOneAndUpdate(
        { _id: userId, socketId },
        { $set: { socketId: null } }
    );
}

function initializeSocket(server) {
    io = socketIo(server, {
        cors: {
            origin(origin, callback) {
                if (origin && !isOriginAllowed(origin)) {
                    console.warn('[socket] Connect from non-listed Origin (still allowed):', origin);
                }
                callback(null, true);
            },
            methods: ['GET', 'POST'],
        },
        connectTimeout: 60000,
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
    });

    io.on('connection', (socket) => {
        console.log('[socket] connected:', socket.id);

        socket.on('join', async (data = {}) => {
            try {
                const { userId, userType } = data;

                if (!userId || !userType) {
                    console.warn('[socket] join rejected: missing userId or userType', data);
                    return socket.emit('socket-joined', {
                        ok: false,
                        message: 'Missing userId or userType',
                    });
                }

                socket.data.userId = String(userId);
                socket.data.userType = String(userType);

                if (userType === 'user') {
                    const updatedUser = await userModel.findByIdAndUpdate(
                        userId,
                        { socketId: socket.id },
                        { new: true }
                    );

                    if (!updatedUser) {
                        console.warn('[socket] join user not found:', userId);
                        return socket.emit('socket-joined', {
                            ok: false,
                            message: 'User not found',
                        });
                    }

                    console.log('[socket] user joined:', {
                        socketId: socket.id,
                        userId: String(userId),
                    });
                } else if (userType === 'captain') {
                    const updatedCaptain = await captainModel.findByIdAndUpdate(
                        userId,
                        {
                            socketId: socket.id,
                            'onlineSession.lastSeenAt': new Date(),
                        },
                        { new: true }
                    );

                    if (!updatedCaptain) {
                        console.warn('[socket] join captain not found:', userId);
                        return socket.emit('socket-joined', {
                            ok: false,
                            message: 'Captain not found',
                        });
                    }

                    console.log('[socket] captain joined:', {
                        socketId: socket.id,
                        captainId: String(userId),
                    });
                } else {
                    console.warn('[socket] join rejected: invalid userType', userType);
                    return socket.emit('socket-joined', {
                        ok: false,
                        message: 'Invalid userType',
                    });
                }

                socket.emit('socket-joined', {
                    ok: true,
                    socketId: socket.id,
                    userId: String(userId),
                    userType: String(userType),
                });
            } catch (err) {
                console.error('[socket] join error:', err);
                socket.emit('socket-joined', {
                    ok: false,
                    message: 'Join failed',
                });
            }
        });

        socket.on('update-location-captain', async (data = {}) => {
            try {
                const { userId, location } = data || {};
                const ltd = toNumber(location?.ltd);
                const lng = toNumber(location?.lng);

                if (!userId) {
                    console.warn('[socket] update-location-captain missing userId');
                    return socket.emit('location-updated', {
                        ok: false,
                        message: 'Missing userId',
                    });
                }

                const issue = describeCoordinateIssue(ltd, lng);
                if (issue) {
                    console.warn('[socket] rejected captain location:', {
                        captainId: String(userId),
                        socketId: socket.id,
                        received: location,
                        parsed: { ltd, lng },
                        reason: issue,
                    });

                    return socket.emit('location-updated', {
                        ok: false,
                        message: issue,
                    });
                }

                const updatedCaptain = await captainModel.findByIdAndUpdate(
                    userId,
                    {
                        socketId: socket.id,
                        location: {
                            ltd,
                            lng,
                        },
                        'onlineSession.lastSeenAt': new Date(),
                    },
                    { new: true }
                );

                if (!updatedCaptain) {
                    console.warn('[socket] update-location-captain captain not found:', userId);
                    return socket.emit('location-updated', {
                        ok: false,
                        message: 'Captain not found',
                    });
                }

                console.log('[socket] captain location updated:', {
                    captainId: String(userId),
                    socketId: socket.id,
                    ltd,
                    lng,
                });

                socket.emit('location-updated', {
                    ok: true,
                    captainId: String(userId),
                    location: { ltd, lng },
                });
            } catch (err) {
                console.error('[socket] update-location-captain error:', err);
                socket.emit('location-updated', {
                    ok: false,
                    message: 'Location update failed',
                });
            }
        });

        socket.on('disconnect', async (reason) => {
            try {
                console.log('[socket] disconnected:', socket.id, 'reason:', reason);

                const { userId, userType } = socket.data || {};
                if (!userId || !userType) return;

                if (userType === 'user') {
                    await clearUserSocketIfMatches(userId, socket.id);
                } else if (userType === 'captain') {
                    await clearCaptainSocketIfMatches(userId, socket.id);
                }
            } catch (err) {
                console.error('[socket] disconnect cleanup error:', err);
            }
        });
    });
}

const sendMessageToSocketId = (socketId, messageObject) => {
    if (!socketId) {
        console.warn('[socket] sendMessageToSocketId skipped: empty socketId');
        return false;
    }

    if (!io) {
        console.warn('[socket] sendMessageToSocketId skipped: io not initialized');
        return false;
    }

    if (!messageObject?.event) {
        console.warn('[socket] sendMessageToSocketId skipped: missing event');
        return false;
    }

    console.log('[socket] emitting event:', {
        socketId,
        event: messageObject.event,
    });

    io.to(socketId).emit(messageObject.event, messageObject.data);
    return true;
};

module.exports = { initializeSocket, sendMessageToSocketId };
