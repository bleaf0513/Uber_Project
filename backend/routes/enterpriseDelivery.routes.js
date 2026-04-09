const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const authEnterpriseDriver = require('../middlewares/authEnterpriseDriver');

const {
    getEnterpriseDeliveries,
    getMyEnterpriseDeliveries,
    createEnterpriseDelivery,
    updateEnterpriseDeliveryStatusByDriver,
    deleteEnterpriseDelivery,
} = require('../controllers/enterpriseDelivery.controller');

router.get('/enterprise-deliveries', authEnterprise, getEnterpriseDeliveries);
router.post('/enterprise-deliveries', authEnterprise, createEnterpriseDelivery);
router.delete('/enterprise-deliveries/:id', authEnterprise, deleteEnterpriseDelivery);

router.get('/enterprise-deliveries/me', authEnterpriseDriver, getMyEnterpriseDeliveries);
router.patch('/enterprise-deliveries/:id/status', authEnterpriseDriver, updateEnterpriseDeliveryStatusByDriver);

module.exports = router;
