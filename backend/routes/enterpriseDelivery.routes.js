const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const authEnterpriseDriver = require('../middlewares/authEnterpriseDriver');

const {
    getEnterpriseDeliveries,
    getMyEnterpriseDeliveries,
    createEnterpriseDelivery,
    deleteEnterpriseDelivery,
} = require('../controllers/enterpriseDelivery.controller');

router.get('/', authEnterprise, getEnterpriseDeliveries);
router.get('/me', authEnterpriseDriver, getMyEnterpriseDeliveries);
router.post('/', authEnterprise, createEnterpriseDelivery);
router.delete('/:id', authEnterprise, deleteEnterpriseDelivery);

module.exports = router;
