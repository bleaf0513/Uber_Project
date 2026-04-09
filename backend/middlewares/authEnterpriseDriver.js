const jwt = require('jsonwebtoken');
const EnterpriseDriver = require('../models/enterpriseDriver.model');

function bearerToken(req) {
    const header = req.headers.authorization?.split(' ')[1];
    if (header) return header;
    return req.cookies.enterpriseDriverToken || null;
}

module.exports = async function authEnterpriseDriver(req, res, next) {
    try {
        const token = bearerToken(req);

        if (!token) {
            return res.status(401).json({ message: 'Conductor no autorizado.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const driver = await EnterpriseDriver.findById(decoded._id);

        if (!driver) {
            return res.status(401).json({ message: 'Conductor no autorizado.' });
        }

        req.driver = driver;
        return next();
    } catch (error) {
        console.error('authEnterpriseDriver error:', error);
        return res.status(401).json({ message: 'Conductor no autorizado.' });
    }
};
