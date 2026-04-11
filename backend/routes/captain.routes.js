const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const captainController = require('../controllers/captain.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/register', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('fullname.firstname')
        .isLength({ min: 3 })
        .withMessage('First name must be at least 3 characters long'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('vehicle.color')
        .isLength({ min: 3 })
        .withMessage('Color must be at least 3 characters long'),
    body('vehicle.plate')
        .isLength({ min: 3 })
        .withMessage('Plate must be at least 3 characters long'),
    body('vehicle.capacity')
        .isInt({ min: 1 })
        .withMessage('Capacity must be at least 1'),
    body('vehicle.vehicleType')
        .isIn(['motorcycle', 'car', 'light_cargo', 'van', 'truck'])
        .withMessage('Please enter a valid vehicle type'),
], (req, res) => {
    captainController.registerCaptain(req, res);
});

router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
], (req, res) => {
    captainController.loginCaptain(req, res);
});

router.get('/profile', authMiddleware.authCaptain, (req, res) => {
    captainController.getCaptainProfile(req, res);
});

router.get('/logout', authMiddleware.authCaptain, (req, res) => {
    captainController.logoutCaptain(req, res);
});

router.get('/', (req, res) => {
    res.send('Hello World');
});

module.exports = router;
