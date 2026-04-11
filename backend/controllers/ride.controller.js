const rideService = require('../services/ride.service');
const { validationResult } = require('express-validator');
const mapService = require('../services/maps.service');
const { sendMessageToSocketId } = require('../socket');
const rideModel = require('../models/ride.model');
const { mapsErrorStatus } = require('../utils/mapsHttpStatus');

module.exports.createRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, vehicle, offeredFare } = req.body;

    try {
        const ride = await rideService.createRide({
            user: req.user,
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        const pickupCoordinates = await mapService.getAddressCoordinates(pickup);

        const captainsInRadius = await mapService.getCaptainsInTheRadius(
            pickupCoordinates.ltd,
            pickupCoordinates.lng,
            2
        );

        ride.otp = "";

        const rideWithUser = await rideModel
            .findOne({ _id: ride._id })
            .populate('user');

        captainsInRadius.forEach((captain) => {
            if (!captain?.socketId) return;

            sendMessageToSocketId(captain.socketId, {
                event: 'new-ride',
                data: rideWithUser
            });
        });

        return res.status(201).json(ride);
    } catch (err) {
        console.error('Error en createRide:', err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.getFare = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination } = req.query;

    try {
        const fare = await rideService.getFare(pickup, destination);
        return res.status(200).json(fare);
    } catch (err) {
        console.error('Error en getFare:', err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.confirmRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.confirmRide({
            rideId,
            captain: req.captain
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-confirmed',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en confirmRide:', err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.startRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, otp } = req.query;

    try {
        const ride = await rideService.startRide({
            rideId,
            otp,
            captain: req.captain
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-started',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en startRide:', err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.endRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.endRide({
            rideId,
            captain: req.captain
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: 'ride-ended',
            data: ride
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error('Error en endRide:', err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.cancelRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.cancelRide({
            rideId,
            user: req.user
        });

        return res.status(200).json({
            message: 'Solicitud cancelada correctamente',
            ride
        });
    } catch (err) {
        console.error('Error en cancelRide:', err);
        return res.status(500).json({ message: err.message });
    }
};
