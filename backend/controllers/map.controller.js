const mapService = require('../services/maps.service');
const { validationResult } = require('express-validator');
const rideService = require('../services/ride.service');
const { mapsErrorStatus } = require('../utils/mapsHttpStatus');

/**
 * MAPS CONTROLLER - CENTRAL GO
 *
 * Este controlador NO debe llamar Google directamente.
 * Todo debe pasar por maps.service.js, donde ya bloqueamos Geocoding con:
 *
 * GEOCODING_ENABLED=false
 *
 * Endpoints:
 * GET /maps/get-coordinates
 * GET /maps/get-distance
 * GET /maps/get-suggestions
 * GET /maps/get-prices
 */

const parseStops = (rawStops) => {
    if (!rawStops) return [];

    if (Array.isArray(rawStops)) {
        return rawStops
            .map((stop) => String(stop || '').trim())
            .filter(Boolean);
    }

    return String(rawStops)
        .split('|')
        .map((stop) => stop.trim())
        .filter(Boolean);
};

const cleanQueryText = (value) => {
    return String(value || '').trim();
};

const sendMapError = (res, error, fallbackMessage) => {
    console.error('[maps.controller] error:', error);

    const msg = error?.message || fallbackMessage || 'Error de mapas';

    return res.status(mapsErrorStatus(msg)).json({
        message: msg,
    });
};

module.exports.getCoordinates = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const address = cleanQueryText(req.query.address);

        if (!address || address.length < 3) {
            return res.status(400).json({
                message: 'La dirección es obligatoria.',
            });
        }

        /*
         * IMPORTANTE:
         * Este endpoint pasa por maps.service.js.
         * Si GEOCODING_ENABLED=false, el servicio NO debe llamar geocode/json.
         */
        const coordinates = await mapService.getAddressCoordinates(address);

        return res.json({
            ...coordinates,
            geocodingEnabled: String(process.env.GEOCODING_ENABLED || '').toLowerCase() === 'true',
        });
    } catch (error) {
        return sendMapError(res, error, 'Unable to fetch coordinates');
    }
};

module.exports.getDistance = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const origin = cleanQueryText(req.query.origin);
        const destination = cleanQueryText(req.query.destination);
        const stops = parseStops(req.query.stops);

        if (!origin || !destination) {
            return res.status(400).json({
                message: 'Origen y destino son obligatorios.',
            });
        }

        const distance = await mapService.getDistance(origin, destination, stops);

        return res.json(distance);
    } catch (error) {
        return sendMapError(
            res,
            error,
            'Could not compute distance for this route'
        );
    }
};

module.exports.getSuggestions = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const address = cleanQueryText(req.query.address);

        if (!address || address.length < 3) {
            return res.json([]);
        }

        /*
         * IMPORTANTE:
         * Las sugerencias pasan por maps.service.js.
         * Con GEOCODING_ENABLED=false, NO debe llamar geocode/json.
         * Puede usar Places si GOOGLE_PLACES_ENABLED=true.
         */
        const suggestions = await mapService.getSuggestions(address);

        return res.json(Array.isArray(suggestions) ? suggestions : []);
    } catch (error) {
        return sendMapError(res, error, 'Unable to load suggestions');
    }
};

module.exports.getPrices = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const origin = cleanQueryText(req.query.origin);
        const destination = cleanQueryText(req.query.destination);
        const stops = parseStops(req.query.stops);

        if (!origin || !destination) {
            return res.status(400).json({
                message: 'Origen y destino son obligatorios.',
            });
        }

        /*
         * IMPORTANTE:
         * rideService.getFare debe usar mapService.getDistance.
         * Si getFare llama Geocoding por otro lado, toca corregir ride.service.js.
         */
        const prices = await rideService.getFare(origin, destination, stops);

        return res.json(prices);
    } catch (error) {
        return sendMapError(res, error, 'Could not compute fare for this route');
    }
};