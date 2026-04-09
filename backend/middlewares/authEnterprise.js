const jwt = require('jsonwebtoken');
const enterpriseModel = require('../models/enterprise.model');

function bearerToken(req) {
    const header = req.headers.authorization?.split(' ')[1];
    if (header) return header;
    return req.cookies.enterpriseToken || req.cookies.token;
}

module.exports = async function authEnterprise(req, res, next) {
    try {
        const token = bearerToken(req);

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const enterprise = await enterpriseModel.findById(decoded._id);

        if (!enterprise) {
            return res.status(401).json({ message: 'Unauthorized enterprise' });
        }

        req.enterprise = enterprise;
        return next();
    } catch (error) {
        console.error('authEnterprise error:', error);
        return res.status(401).json({ message: 'Unauthorized' });
    }
};
