const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const enterpriseModel = require('../models/enterprise.model');

const createToken = (enterprise) => {
    return jwt.sign(
        { _id: enterprise._id, email: enterprise.email, role: 'enterprise' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports.signupEnterprise = async (req, res) => {
    try {
        const { companyName, nit, email, phone, password } = req.body;

        if (!companyName || !nit || !email || !phone || !password) {
            return res.status(400).json({
                message: 'Todos los campos son obligatorios.',
            });
        }

        const existingEnterprise = await enterpriseModel.findOne({
            email: email.trim().toLowerCase(),
        });

        if (existingEnterprise) {
            return res.status(400).json({
                message: 'Ya existe una empresa registrada con ese correo.',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const enterprise = await enterpriseModel.create({
            companyName: companyName.trim(),
            nit: nit.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            password: hashedPassword,
        });

        return res.status(201).json({
            message: 'Empresa registrada correctamente.',
            enterprise: {
                _id: enterprise._id,
                companyName: enterprise.companyName,
                nit: enterprise.nit,
                email: enterprise.email,
                phone: enterprise.phone,
            },
        });
    } catch (error) {
        console.error('Error registrando empresa:', error);
        return res.status(500).json({
            message: 'Error registrando empresa.',
        });
    }
};

module.exports.loginEnterprise = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Correo y contraseña son obligatorios.',
            });
        }

        const enterprise = await enterpriseModel.findOne({
            email: email.trim().toLowerCase(),
        });

        if (!enterprise) {
            return res.status(401).json({
                message: 'Correo o contraseña incorrectos.',
            });
        }

        const isMatch = await bcrypt.compare(password, enterprise.password);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Correo o contraseña incorrectos.',
            });
        }

        const token = createToken(enterprise);

        res.cookie('enterpriseToken', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            message: 'Login exitoso.',
            enterprise: {
                _id: enterprise._id,
                companyName: enterprise.companyName,
                nit: enterprise.nit,
                email: enterprise.email,
                phone: enterprise.phone,
            },
        });
    } catch (error) {
        console.error('Error en login empresarial:', error);
        return res.status(500).json({
            message: 'Error iniciando sesión empresarial.',
        });
    }
};

module.exports.getEnterpriseProfile = async (req, res) => {
    try {
        return res.status(200).json({
            enterprise: {
                _id: req.enterprise._id,
                companyName: req.enterprise.companyName,
                nit: req.enterprise.nit,
                email: req.enterprise.email,
                phone: req.enterprise.phone,
            },
        });
    } catch (error) {
        console.error('Error obteniendo perfil empresarial:', error);
        return res.status(500).json({
            message: 'Error obteniendo perfil empresarial.',
        });
    }
};
