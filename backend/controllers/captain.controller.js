const captainModel = require('../models/captain.model');
const captainSerivce = require('../services/captain.service');
const { validationResult } = require('express-validator');
const blacklistTokenModel = require('../models/blacklistToken.model');

/**
 * Convierte cualquier valor a número seguro
 */
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Convierte milisegundos a horas con 2 decimales
 */
function msToHours(ms = 0) {
    const hours = ms / (1000 * 60 * 60);
    return Number(hours.toFixed(2));
}

/**
 * Distancia entre dos puntos en metros
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Arma la respuesta del captain para el frontend
 * sin exponer password y dejando stats listas para el panel.
 */
function buildCaptainResponse(captainDoc) {
    if (!captainDoc) return null;

    const captain = captainDoc.toObject ? captainDoc.toObject() : captainDoc;

    return {
        _id: captain._id,
        fullname: {
            firstname: captain?.fullname?.firstname || '',
            lastname: captain?.fullname?.lastname || '',
        },
        email: captain.email || '',
        socketId: captain.socketId || '',
        status: captain.status || 'inactive',
        vehicle: {
            color: captain?.vehicle?.color || '',
            plate: captain?.vehicle?.plate || '',
            capacity: captain?.vehicle?.capacity || 0,
            vehicleType: captain?.vehicle?.vehicleType || '',
        },

        profileImage:
            captain.profileImage ||
            captain.photo ||
            captain.avatar ||
            captain.image ||
            '',

        rating: toNumber(
            captain.rating ??
            captain.avgRating ??
            captain.stars ??
            5
        ),

        location: {
            ltd: toNumber(captain?.location?.ltd, 0),
            lng: toNumber(captain?.location?.lng, 0),
        },

        onlineSession: {
            isOnline: Boolean(captain?.onlineSession?.isOnline),
            sessionStartedAt: captain?.onlineSession?.sessionStartedAt || null,
            lastSeenAt: captain?.onlineSession?.lastSeenAt || null,
        },

        stats: {
            hoursOnline: toNumber(
                captain?.stats?.hoursOnline ??
                captain?.hoursOnline ??
                0
            ),
            totalDistanceKm: toNumber(
                captain?.stats?.totalDistanceKm ??
                captain?.totalDistanceKm ??
                captain?.distanceKm ??
                0
            ),
            totalEarning: toNumber(
                captain?.stats?.totalEarning ??
                captain?.totalEarning ??
                captain?.earnings ??
                0
            ),
            cashCollected: toNumber(
                captain?.stats?.cashCollected ??
                captain?.cashCollected ??
                captain?.cash ??
                0
            ),
            transferCollected: toNumber(
                captain?.stats?.transferCollected ??
                captain?.transferCollected ??
                captain?.transfer ??
                0
            ),
            totalTrips: toNumber(
                captain?.stats?.totalTrips ??
                captain?.totalTrips ??
                captain?.completedTrips ??
                0
            ),
            pendingToSettle: toNumber(
                captain?.stats?.pendingToSettle ??
                captain?.pendingToSettle ??
                0
            ),
        },
    };
}

module.exports.registerCaptain = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { fullname, email, password, vehicle } = req.body;

        const isCaptainAlreadyExist = await captainModel.findOne({ email });

        if (isCaptainAlreadyExist) {
            return res.status(400).json({ message: 'Captain already exist' });
        }

        const hashedPassword = await captainModel.hashPassword(password);

        const captain = await captainSerivce.createCaptain({
            firstname: fullname.firstname,
            lastname: fullname.lastname,
            email,
            password: hashedPassword,
            color: vehicle.color,
            plate: vehicle.plate,
            capacity: vehicle.capacity,
            vehicleType: vehicle.vehicleType,
        });

        const token = captain.generateAuthToken();

        return res.status(201).json({
            token,
            captain: buildCaptainResponse(captain),
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports.loginCaptain = async (req, res, next) => {
    const { email, password } = req.body;
    const error = validationResult(req);

    if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
    }

    try {
        const captain = await captainModel.findOne({ email }).select('+password');

        if (!captain) {
            return res.status(404).json({ message: 'Captain not found' });
        }

        const isMatch = await captain.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const now = new Date();

        captain.onlineSession = {
            ...(captain.onlineSession || {}),
            isOnline: true,
            sessionStartedAt: now,
            lastSeenAt: now,
        };

        await captain.save();

        const token = captain.generateAuthToken();

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
        });

        return res.status(200).json({
            token,
            captain: buildCaptainResponse(captain),
        });
    } catch (err) {
        console.error('loginCaptain error:', err);
        return res.status(500).json({
            message: 'Error logging in captain',
            error: err.message,
        });
    }
};

module.exports.getCaptainProfile = async (req, res, next) => {
    try {
        if (req.captain?._id) {
            await captainModel.findByIdAndUpdate(req.captain._id, {
                $set: {
                    'onlineSession.lastSeenAt': new Date(),
                },
            });

            const freshCaptain = await captainModel.findById(req.captain._id);
            return res.status(200).json({
                captain: buildCaptainResponse(freshCaptain),
            });
        }

        return res.status(200).json({
            captain: buildCaptainResponse(req.captain),
        });
    } catch (err) {
        console.error('getCaptainProfile error:', err);
        return res.status(500).json({
            message: 'Error getting captain profile',
            error: err.message,
        });
    }
};

module.exports.logoutCaptain = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

        if (req.captain?._id) {
            const freshCaptain = await captainModel.findById(req.captain._id);

            if (freshCaptain) {
                const sessionStartedAt = freshCaptain?.onlineSession?.sessionStartedAt
                    ? new Date(freshCaptain.onlineSession.sessionStartedAt)
                    : null;

                const now = new Date();

                let additionalHours = 0;

                if (sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())) {
                    const diffMs = Math.max(0, now.getTime() - sessionStartedAt.getTime());
                    additionalHours = msToHours(diffMs);
                }

                await captainModel.findByIdAndUpdate(freshCaptain._id, {
                    $inc: {
                        'stats.hoursOnline': additionalHours,
                    },
                    $set: {
                        'onlineSession.isOnline': false,
                        'onlineSession.lastSeenAt': now,
                    },
                    $unset: {
                        'onlineSession.sessionStartedAt': 1,
                    },
                });
            }
        }

        if (token) {
            const blackToken = await blacklistTokenModel.create({ token });
            await blackToken.save();
        }

        res.clearCookie('token');

        return res.status(200).json({ message: 'Logged out' });
    } catch (err) {
        console.error('logoutCaptain error:', err);
        return res.status(500).json({
            message: 'Error logging out',
            error: err.message,
        });
    }
};

module.exports.getNearbyCaptains = async (req, res) => {
    try {
        const lat = toNumber(req.query.lat, NaN);
        const lng = toNumber(req.query.lng, NaN);
        const radiusKm = Math.max(toNumber(req.query.radiusKm, 8), 1);
        const radiusM = radiusKm * 1000;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({
                message: 'Latitud y longitud inválidas.',
            });
        }

        const captains = await captainModel.find({
            status: 'active',
            socketId: { $exists: true, $ne: null },
            'location.ltd': { $exists: true, $ne: null },
            'location.lng': { $exists: true, $ne: null },
        });

        const nearbyCaptains = captains
            .map((captain) => {
                const captainLat = toNumber(captain?.location?.ltd, NaN);
                const captainLng = toNumber(captain?.location?.lng, NaN);

                if (!Number.isFinite(captainLat) || !Number.isFinite(captainLng)) {
                    return null;
                }

                const distanceMeters = haversineMeters(
                    lat,
                    lng,
                    captainLat,
                    captainLng
                );

                if (!Number.isFinite(distanceMeters) || distanceMeters > radiusM) {
                    return null;
                }

                return {
                    _id: captain._id,
                    captainId: captain._id,
                    name:
                        `${captain?.fullname?.firstname || ''} ${captain?.fullname?.lastname || ''}`.trim() ||
                        captain?.name ||
                        'Conductor activo',
                    socketId: captain.socketId || '',
                    status: captain.status || 'active',
                    vehicleType:
                        captain?.vehicle?.vehicleType ||
                        captain?.vehicleType ||
                        'car',
                    location: {
                        ltd: captainLat,
                        lng: captainLng,
                    },
                    distanceMeters: Math.round(distanceMeters),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceMeters - b.distanceMeters);

        return res.status(200).json({
            captains: nearbyCaptains,
        });
    } catch (err) {
        console.error('getNearbyCaptains error:', err);
        return res.status(500).json({
            message: 'Error obteniendo conductores cercanos',
            error: err.message,
        });
    }
};
