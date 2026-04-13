const rideService = require('../services/ride.service');
const { validationResult } = require('express-validator');
const mapService = require('../services/maps.service');
const { sendMessageToSocketId } = require('../socket');
const rideModel = require('../models/ride.model');
const captainModel = require('../models/captain.model');
const { mapsErrorStatus } = require('../utils/mapsHttpStatus');

console.log('🔥🔥🔥 RIDE CONTROLLER NUEVO EN PRODUCCION 🔥🔥🔥');

function safeId(value) {
    try {
        return value ? String(value) : null;
    } catch {
        return null;
    }
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function isValidLatitude(lat) {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
    return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function isValidLatLng(lat, lng) {
    return isValidLatitude(lat) && isValidLongitude(lng);
}

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

function kmText(meters) {
    if (!Number.isFinite(meters)) return null;
    return `${(meters / 1000).toFixed(2)} km`;
}

module.exports.createRide = async (req, res) => {
    console.log('🔥 CREATE RIDE NUEVO FUNCIONANDO 🔥');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, vehicle, offeredFare } = req.body;

    try {
        console.log('[ride] createRide request:', {
            userId: safeId(req.user?._id),
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        const ride = await rideService.createRide({
            user: req.user,
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        console.log('[ride] ride created:', {
            rideId: safeId(ride?._id),
            userId: safeId(req.user?._id),
        });

        const pickupCoordinates = await mapService.getAddressCoordinates(pickup);

        console.log('[ride] pickupCoordinates:', pickupCoordinates);

        if (
            !pickupCoordinates ||
            !Number.isFinite(pickupCoordinates.ltd) ||
            !Number.isFinite(pickupCoordinates.lng)
        ) {
            console.error('[ride] invalid pickup coordinates after geocoding:', pickupCoordinates);
            return res.status(500).json({
                message: 'No se pudo determinar la ubicación de recogida.',
            });
        }

        // Subido a 15 km para pruebas reales en Medellín/Itagüí/Envigado/Sabaneta
        const SEARCH_RADIUS_KM = 15;

        const captainsInRadius = await mapService.getCaptainsInTheRadius(
            pickupCoordinates.ltd,
            pickupCoordinates.lng,
            SEARCH_RADIUS_KM
        );

        const captainsSummary = (captainsInRadius || []).map((captain) => ({
            captainId: safeId(captain?._id),
            socketId: captain?.socketId || null,
            status: captain?.status || null,
            location: captain?.location || null,
        }));

        console.log('[ride] captainsInRadius summary:', captainsSummary);
        console.log('[ride] captainsInRadius count:', captainsSummary.length);

        // Diagnóstico adicional: revisar TODOS los capitanes activos para entender por qué uno conectado no entró
        const allActiveCaptains = await captainModel.find({
            status: 'active',
        });

        const allActiveDiagnostic = (allActiveCaptains || []).map((captain) => {
            const captainId = safeId(captain?._id);
            const socketId = captain?.socketId || null;
            const captainLtd = toNumber(captain?.location?.ltd);
            const captainLng = toNumber(captain?.location?.lng);

            const connected = !!socketId;
            const hasValidLocation = isValidLatLng(captainLtd, captainLng);

            let distanceMeters = null;
            let distanceKm = null;
            let insideRadius = false;
            let discardReason = null;

            if (!connected) {
                discardReason = 'not_connected';
            } else if (!hasValidLocation) {
                discardReason = 'invalid_or_missing_location';
            } else {
                distanceMeters = haversineMeters(
                    pickupCoordinates.ltd,
                    pickupCoordinates.lng,
                    captainLtd,
                    captainLng
                );
                distanceKm = kmText(distanceMeters);
                insideRadius = Number.isFinite(distanceMeters)
                    ? distanceMeters <= SEARCH_RADIUS_KM * 1000
                    : false;

                if (!insideRadius) {
                    discardReason = 'outside_radius';
                }
            }

            return {
                captainId,
                connected,
                socketId,
                status: captain?.status || null,
                captainLtd: Number.isFinite(captainLtd) ? captainLtd : null,
                captainLng: Number.isFinite(captainLng) ? captainLng : null,
                hasValidLocation,
                distanceMeters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : null,
                distanceKm,
                insideRadius,
                discardReason,
            };
        });

        console.log('[ride] active captains diagnostic:', allActiveDiagnostic);

        ride.otp = '';

        const rideWithUser = await rideModel
            .findOne({ _id: ride._id })
            .populate('user');

        if (!rideWithUser) {
            console.error('[ride] rideWithUser not found after creation:', {
                rideId: safeId(ride?._id),
            });

            return res.status(500).json({
                message: 'No se pudo cargar la solicitud recién creada.',
            });
        }

        let emittedCount = 0;
        let skippedNoSocket = 0;
        const emittedTo = [];
        const skippedCaptains = [];

        for (const captain of captainsInRadius || []) {
            const captainId = safeId(captain?._id);
            const socketId = captain?.socketId || null;

            console.log('[ride] trying socket emit new-ride:', {
                captainId,
                socketId,
            });

            if (!socketId) {
                skippedNoSocket += 1;
                skippedCaptains.push({
                    captainId,
                    reason: 'missing_socket',
                });
                continue;
            }

            const sent = sendMessageToSocketId(socketId, {
                event: 'new-ride',
                data: rideWithUser,
            });

            if (sent) {
                emittedCount += 1;
                emittedTo.push({
                    captainId,
                    socketId,
                });
            } else {
                skippedCaptains.push({
                    captainId,
                    socketId,
                    reason: 'emit_failed',
                });
            }
        }

        console.log('[ride] new-ride emit result:', {
            rideId: safeId(rideWithUser?._id),
            captainsFound: captainsSummary.length,
            emittedCount,
            skippedNoSocket,
            emittedTo,
            skippedCaptains,
        });

        if ((captainsInRadius || []).length === 0) {
            console.warn('[ride] no captains found in radius for ride:', {
                rideId: safeId(rideWithUser?._id),
                pickup,
                pickupCoordinates,
                radiusKm: SEARCH_RADIUS_KM,
            });

            return res.status(404).json({
                message: 'No hay conductores disponibles cerca en este momento.',
                code: 'NO_CAPTAINS_AVAILABLE',
                pickupCoordinates,
                radiusKm: SEARCH_RADIUS_KM,
                activeCaptainsDiagnostic: allActiveDiagnostic,
            });
        }

        if ((captainsInRadius || []).length > 0 && emittedCount === 0) {
            console.warn('[ride] captains found but no new-ride emitted:', {
                rideId: safeId(rideWithUser?._id),
                captainsFound: captainsSummary.length,
                skippedCaptains,
            });

            return res.status(503).json({
                message: 'Se encontraron conductores, pero no fue posible notificarles.',
                code: 'CAPTAINS_FOUND_BUT_NOT_NOTIFIED',
                captainsFound: captainsSummary.length,
                skippedCaptains,
            });
        }

        return res.status(201).json(ride);
    } catch (err) {
        console.error('Error en createRide:', err);

        const status = typeof mapsErrorStatus === 'function' ? mapsErrorStatus(err) : null;
        if (status) {
            return res.status(status).json({ message: err.message });
        }

        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};

module.exports.getFare = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] getFare validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination } = req.query;

    try {
        console.log('[ride] getFare request:', { pickup, destination });

        const fare = await rideService.getFare(pickup, destination);

        console.log('[ride] getFare response:', fare);

        return res.status(200).json(fare);
    } catch (err) {
        console.error('Error en getFare:', err);

        const status = typeof mapsErrorStatus === 'function' ? mapsErrorStatus(err) : null;
        if (status) {
            return res.status(status).json({ message: err.message });
        }

        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};

module.exports.confirmRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] confirmRide validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.confirmRide({
            rideId,
            captain: req.captain
        });

        console.log('[ride] ride-confirmed emit:', {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-confirmed',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en confirmRide:', err);
        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};

module.exports.startRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] startRide validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, otp } = req.query;

    try {
        const ride = await rideService.startRide({
            rideId,
            otp,
            captain: req.captain
        });

        console.log('[ride] ride-started emit:', {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-started',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en startRide:', err);
        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};

module.exports.endRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] endRide validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.endRide({
            rideId,
            captain: req.captain
        });

        console.log('[ride] ride-ended emit:', {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-ended',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en endRide:', err);
        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};

module.exports.cancelRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[ride] cancelRide validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.cancelRide({
            rideId,
            user: req.user
        });

        console.log('[ride] ride cancelled:', {
            rideId: safeId(ride?._id),
            userId: safeId(req.user?._id),
        });

        return res.status(200).json({
            message: 'Solicitud cancelada correctamente',
            ride
        });
    } catch (err) {
        console.error('Error en cancelRide:', err);
        return res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
};
