const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const authEnterpriseDriver = require('../middlewares/authEnterpriseDriver');

const {
  createDriver,
  getDrivers,
  loginDriverByCedula,
  updateDriverLocation,
  deleteDriver,
} = require('../controllers/enterpriseDriver.controller');

router.get('/', authEnterprise, getDrivers);
router.post('/', authEnterprise, createDriver);
router.delete('/:id', authEnterprise, deleteDriver);

// login del conductor
router.post('/login', loginDriverByCedula);

// actualizar ubicación del conductor autenticado
router.patch('/:id/location', authEnterpriseDriver, updateDriverLocation);

module.exports = router;
