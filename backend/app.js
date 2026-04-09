const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const {
    getEnterpriseDeliveries,
    createEnterpriseDelivery,
    deleteEnterpriseDelivery,
} = require('../controllers/enterpriseDelivery.controller');

router.get('/', authEnterprise, getEnterpriseDeliveries);
router.post('/', authEnterprise, createEnterpriseDelivery);
router.delete('/:id', authEnterprise, deleteEnterpriseDelivery);

module.exports = router;
