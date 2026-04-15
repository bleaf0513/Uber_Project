const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware');

router.post(
    '/create',
    authMiddleware.authUser,
    body('pickup')
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage('Invalid Pickup Address'),
    body('destination')
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage('Invalid Destination Address'),
    body('vehicle')
        .isString()
        .notEmpty()
        .isIn(['motorcycle', 'car', 'light_cargo', 'van', 'truck'])
        .withMessage('Invalid Vehicle Type'),
    body('offeredFare')
        .optional()
        .isNumeric()
        .withMessage('Invalid offered fare'),
    rideController.createRide
);

router.get(
    '/fare',
    authMiddleware.authUser,
    query('pickup')
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage('Invalid Pickup Address'),
    query('destination')
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage('Invalid Destination Address'),
    rideController.getFare
);

router.post(
    '/cancel',
    authMiddleware.authUser,
    body('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    rideController.cancelRide
);

router.post(
    '/confirm',
    authMiddleware.authCaptain,
    body('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    rideController.confirmRide
);

router.post(
    '/captain-offer',
    authMiddleware.authCaptain,
    body('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    body('price')
        .isNumeric()
        .withMessage('Invalid price'),
    body('message')
        .optional()
        .isString()
        .withMessage('Invalid message'),
    rideController.captainOfferRide
);

router.post(
    '/respond-offer',
    authMiddleware.authUser,
    body('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    body('captainId')
        .isMongoId()
        .withMessage('Invalid captain id'),
    body('action')
        .isIn(['accepted', 'rejected'])
        .withMessage('Invalid action'),
    rideController.userRespondToCaptainOffer
);

router.get(
    '/my-active',
    authMiddleware.authUser,
    rideController.getMyActiveRide
);

router.get(
    '/:rideId/offers',
    authMiddleware.authUser,
    param('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    rideController.getRideOffers
);

router.get(
    '/start-ride',
    authMiddleware.authCaptain,
    query('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    query('otp')
        .isString()
        .isLength({ min: 4, max: 4 })
        .withMessage('Código de seguridad inválido'),
    rideController.startRide
);

router.post(
    '/end-ride',
    authMiddleware.authCaptain,
    body('rideId')
        .isMongoId()
        .withMessage('Invalid ride id'),
    rideController.endRide
);

module.exports = router;