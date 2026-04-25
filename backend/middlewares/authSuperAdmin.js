const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/superAdmin.model');

module.exports = async function authSuperAdmin(req, res, next) {
    try {
        const bearerToken =
            req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
                ? req.headers.authorization.split(' ')[1]
                : null;

        const cookieToken = req.cookies?.superAdminToken || null;

        const token = bearerToken || cookieToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado. Falta token de Super Admin.',
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'JWT_SECRET no está configurado en el backend.',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded?.type !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Token inválido para Super Admin.',
            });
        }

        const admin = await SuperAdmin.findOne({
            _id: decoded._id || decoded.id,
            active: true,
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Super Admin no encontrado o inactivo.',
            });
        }

        req.superAdmin = admin;
        next();
    } catch (error) {
        console.error('Error en authSuperAdmin:', error);

        return res.status(401).json({
            success: false,
            message: 'Sesión de Super Admin inválida o expirada.',
        });
    }
};