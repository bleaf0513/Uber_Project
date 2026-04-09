const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const {
    getEnterpriseDeliveries,
    createEnterpriseDelivery,
    deleteEnterpriseDelivery,
} = require('../controllers/enterpriseDelivery.controller');

router.get('/enterprise-deliveries', authEnterprise, getEnterpriseDeliveries);
router.post('/enterprise-deliveries', authEnterprise, createEnterpriseDelivery);
router.delete('/enterprise-deliveries/:id', authEnterprise, deleteEnterpriseDelivery);

module.exports = router;
