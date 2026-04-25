const express = require('express');
const router = express.Router();

const authSuperAdmin = require('../middlewares/authSuperAdmin');

const {
    login,
    logout,
    me,
    dashboard,
} = require('../controllers/superAdmin.controller');

router.post('/login', login);
router.post('/logout', authSuperAdmin, logout);
router.get('/me', authSuperAdmin, me);
router.get('/dashboard', authSuperAdmin, dashboard);

module.exports = router;