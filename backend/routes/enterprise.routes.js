const express = require('express');
const router = express.Router();

const {
    signupEnterprise,
    loginEnterprise,
    getEnterpriseProfile,
} = require('../controllers/enterprise.controller');

const authEnterprise = require('../middlewares/authEnterprise');

router.post('/signup', signupEnterprise);
router.post('/login', loginEnterprise);
router.get('/me', authEnterprise, getEnterpriseProfile);

module.exports = router;
