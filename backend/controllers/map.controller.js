const mapService = require('../services/maps.service');
const { validationResult } = require('express-validator');
const rideService = require('../services/ride.service');
const { mapsErrorStatus } = require('../utils/mapsHttpStatus');

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

module.exports.getCoordinates = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const address = req.query.address;
        const coordinates = await mapService.getAddressCoordinates(address);

        res.json(coordinates);
    } catch (error) {
        console.error(error);

        const msg = error?.message || 'Unable to fetch coordinates';

        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
};

module.exports.getDistance = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const origin = req.query.origin;
        const destination = req.query.destination;
        const stops = parseStops(req.query.stops);

        let distance;

        /*
         * Si maps.service.js ya soporta paradas, usará el tercer parámetro.
         * Si aún no lo soporta, toca actualizarlo en el siguiente paso.
         */
        distance = await mapService.getDistance(origin, destination, stops);

        res.json(distance);
    } catch (error) {
        console.error(error);

        const msg = error?.message || 'Could not compute distance for this route';

        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
};

module.exports.getSuggestions = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const address = req.query.address;
        const suggestions = await mapService.getSuggestions(address);

        res.json(suggestions);
    } catch (error) {
        console.error(error);

        const msg = error?.message || 'Unable to load suggestions';

        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
};

module.exports.getPrices = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const origin = req.query.origin;
        const destination = req.query.destination;
        const stops = parseStops(req.query.stops);

        /*
         * IMPORTANTE:
         * Ahora enviamos stops al servicio de tarifas.
         * El siguiente archivo a corregir es ride.service.js para que calcule:
         * origen -> paradas -> destino.
         */
        const prices = await rideService.getFare(origin, destination, stops);

        res.json(prices);
    } catch (error) {
        console.error(error);

        const msg = error?.message || 'Could not compute fare for this route';

        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
};