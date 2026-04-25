const express = require('express');
const router = express.Router();

const authSuperAdmin = require('../middlewares/authSuperAdmin');

const {
    login,
    logout,
    me,
    dashboard,
    getDriverApplications,
    approveDriverApplication,
    rejectDriverApplication,
} = require('../controllers/superAdmin.controller');

router.post('/login', login);
router.post('/logout', authSuperAdmin, logout);
router.get('/me', authSuperAdmin, me);
router.get('/dashboard', authSuperAdmin, dashboard);

router.get('/driver-applications', authSuperAdmin, getDriverApplications);
router.patch('/driver-applications/:id/approve', authSuperAdmin, approveDriverApplication);
router.patch('/driver-applications/:id/reject', authSuperAdmin, rejectDriverApplication);

module.exports = router;