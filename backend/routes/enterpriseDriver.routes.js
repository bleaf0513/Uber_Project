const express = require('express');
const router = express.Router();
const enterpriseDriverController = require('../controllers/enterpriseDriver.controller');

router.get('/', enterpriseDriverController.getDrivers);
router.post('/', enterpriseDriverController.createDriver);
router.post('/login', enterpriseDriverController.loginDriverByCedula);
router.delete('/:id', enterpriseDriverController.deleteDriver);

module.exports = router;
