const mapService = require('../services/maps.service');
const { validationResult } = require('express-validator');
const rideService = require('../services/ride.service');

/** Maps/geocoding failures should be 400 — only true infra faults use 500. */
function mapsErrorStatus(message) {
    const msg = String(message || '');
    if (/MongoServerError|mongoose|ECONNREFUSED|PrismaClient|Sequelize/i.test(msg)) {
        return 500;
    }
    return 400;
}

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
}

module.exports.getDistance = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const origin = req.query.origin;
        const destination = req.query.destination;
        const distance = await mapService.getDistance(origin, destination);
        res.json(distance);
    } catch (error) {
        console.error(error);
        const msg = error?.message || 'Could not compute distance for this route';
        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
}

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
}

module.exports.getPrices = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { origin, destination } = req.query;
        // ////console.log(origin, destination, " origin and destination");
        const prices = await rideService.getFare(origin, destination);
        res.json(prices);
    } catch (error) {
        console.error(error);
        const msg = error?.message || 'Could not compute fare for this route';
        res.status(mapsErrorStatus(msg)).json({ message: msg });
    }
}
