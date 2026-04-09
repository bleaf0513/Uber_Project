const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const {
  createDriver,
  getDrivers,
  loginDriverByCedula,
  deleteDriver,
} = require('../controllers/enterpriseDriver.controller');

router.get('/', authEnterprise, getDrivers);
router.post('/', authEnterprise, createDriver);
router.delete('/:id', authEnterprise, deleteDriver);

// este sí puede quedar sin authEnterprise si es acceso por cédula del conductor
router.post('/login', loginDriverByCedula);

module.exports = router;
