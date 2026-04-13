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

        // Foto real del conductor
        profileImage:
            captain.profileImage ||
            captain.photo ||
            captain.avatar ||
            captain.image ||
            '',

        // Rating real si existe, si no deja base segura
        rating: toNumber(
            captain.rating ??
            captain.avgRating ??
            captain.stars ??
            5
        ),

        // Estadísticas reales si ya existen en Mongo
        // Si aún no existen, devuelve 0 sin romper el frontend
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
