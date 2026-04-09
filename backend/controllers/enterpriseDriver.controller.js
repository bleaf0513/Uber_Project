const jwt = require('jsonwebtoken');
const EnterpriseDriver = require('../models/enterpriseDriver.model');

function normalizeCedula(value) {
    return String(value || '')
        .replace(/\./g, '')
        .replace(/-/g, '')
        .replace(/\s+/g, '')
        .trim();
}

module.exports.createDriver = async (req, res) => {
    try {
        const { name, cedula, phone, email, vehicle, plate } = req.body;

        if (!req.enterprise?._id) {
            return res.status(401).json({
                success: false,
                message: 'Empresa no autorizada.',
            });
        }

        if (!name || !cedula || !phone || !email || !vehicle || !plate) {
            return res.status(400).json({
                success: false,
                message: 'Por favor completa todos los campos del conductor.',
            });
        }

        const normalizedCedula = normalizeCedula(cedula);

        const existingDriver = await EnterpriseDriver.findOne({
            enterprise: req.enterprise._id,
            cedula: normalizedCedula,
            active: true,
        });

        if (existingDriver) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un conductor registrado con esa cédula en tu empresa.',
            });
        }

        const newDriver = await EnterpriseDriver.create({
            enterprise: req.enterprise._id,
            name: String(name).trim(),
            cedula: normalizedCedula,
            phone: String(phone).trim(),
            email: String(email).trim().toLowerCase(),
            vehicle: String(vehicle).trim(),
            plate: String(plate).trim().toUpperCase(),
            status: 'Disponible',
            currentLocation: {
                lat: null,
                lng: null,
                updatedAt: null,
            },
            active: true,
        });

        return res.status(201).json({
            success: true,
            message: 'Conductor guardado correctamente.',
            driver: newDriver,
        });
    } catch (error) {
        console.error('Error en createDriver:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo guardar el conductor.',
        });
    }
};

module.exports.getDrivers = async (req, res) => {
    try {
        if (!req.enterprise?._id) {
            return res.status(401).json({
                success: false,
                message: 'Empresa no autorizada.',
            });
        }

        const drivers = await EnterpriseDriver.find({
            enterprise: req.enterprise._id,
            active: true,
        }).sort({
            createdAt: -1,
        });

        return res.status(200).json({
            success: true,
            drivers,
        });
    } catch (error) {
        console.error('Error en getDrivers:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudieron obtener los conductores.',
        });
    }
};

module.exports.loginDriverByCedula = async (req, res) => {
    try {
        const { cedula } = req.body;

        const normalizedCedula = normalizeCedula(cedula);

        if (!normalizedCedula) {
            return res.status(400).json({
                success: false,
                message: 'La cédula es obligatoria.',
            });
        }

        const driver = await EnterpriseDriver.findOne({
            cedula: normalizedCedula,
            active: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Esa cédula no corresponde a un conductor empresarial registrado.',
            });
        }

        const token = jwt.sign(
            { _id: driver._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('enterpriseDriverToken', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: 'Ingreso correcto.',
            driver,
        });
    } catch (error) {
        console.error('Error en loginDriverByCedula:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
        });
    }
};

module.exports.updateDriverLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;

        if (!req.driver?._id) {
            return res.status(401).json({
                success: false,
                message: 'Conductor no autorizado.',
            });
        }

        if (String(req.driver._id) !== String(id)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes actualizar la ubicación de otro conductor.',
            });
        }

        if (
            lat === undefined ||
            lng === undefined ||
            !Number.isFinite(Number(lat)) ||
            !Number.isFinite(Number(lng))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Latitud y longitud válidas son obligatorias.',
            });
        }

        const updatedDriver = await EnterpriseDriver.findOneAndUpdate(
            {
                _id: id,
                active: true,
            },
            {
                currentLocation: {
                    lat: Number(lat),
                    lng: Number(lng),
                    updatedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!updatedDriver) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Ubicación actualizada correctamente.',
            driver: updatedDriver,
        });
    } catch (error) {
        console.error('Error en updateDriverLocation:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar la ubicación.',
        });
    }
};

module.exports.deleteDriver = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.enterprise?._id) {
            return res.status(401).json({
                success: false,
                message: 'Empresa no autorizada.',
            });
        }

        const deletedDriver = await EnterpriseDriver.findOneAndUpdate(
            {
                _id: id,
                enterprise: req.enterprise._id,
            },
            { active: false },
            { new: true }
        );

        if (!deletedDriver) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Conductor eliminado correctamente.',
        });
    } catch (error) {
        console.error('Error en deleteDriver:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar el conductor.',
        });
    }
};
