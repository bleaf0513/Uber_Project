const jwt = require('jsonwebtoken');
const EnterpriseDriver = require('../models/enterpriseDriver.model');

module.exports = async function authEnterpriseDriver(req, res, next) {
    try {
        let token = null;

        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7).trim();
        }

        if (!token && req.cookies?.enterpriseDriverToken) {
            token = req.cookies.enterpriseDriverToken;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Conductor no autorizado.',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const driver = await EnterpriseDriver.findOne({
            _id: decoded._id,
            active: true,
        });

        if (!driver) {
            return res.status(401).json({
                success: false,
                message: 'Conductor no autorizado.',
            });
        }

        req.enterpriseDriver = driver;
        req.driver = driver;

        next();
    } catch (error) {
        console.error('Error en authEnterpriseDriver:', error);
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado.',
        });
    }
};