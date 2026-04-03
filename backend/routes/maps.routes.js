const express = require('express');
const router = express.Router();
const mapController = require('../controllers/map.controller');
const { query } = require('express-validator');

// Read-only geocoding / fare hints — no JWT (avoids 401 when token expired, wrong secret after redeploy, or shared `token` key across roles).

router.get('/get-coordinates',
    query('address').isString().notEmpty().isLength({ min: 3 }),
    mapController.getCoordinates
);

router.get('/get-distance', query('origin').isString().notEmpty().isLength({ min: 3 }),
    query('destination').isString().notEmpty().isLength({ min: 3 }),
    mapController.getDistance
);



router.get('/get-suggestions',
    query('address').isString().notEmpty().isLength({ min: 3 }),
    mapController.getSuggestions
)

router.get('/get-prices',
    query('origin').isString().notEmpty().isLength({ min: 3 }),
    query('destination').isString().notEmpty().isLength({ min: 3 }),
    mapController.getPrices
);

module.exports = router;