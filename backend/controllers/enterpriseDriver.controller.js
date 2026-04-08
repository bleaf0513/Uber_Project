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

        if (!name || !cedula || !phone || !email || !vehicle || !plate) {
            return res.status(400).json({
                success: false,
                message: 'Por favor completa todos los campos del conductor.',
            });
        }

        const normalizedCedula = normalizeCedula(cedula);

        const existingDriver = await EnterpriseDriver.findOne({
            cedula: normalizedCedula,
        });

        if (existingDriver) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un conductor registrado con esa cédula.',
            });
        }

        const newDriver = await EnterpriseDriver.create({
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
        const drivers = await EnterpriseDriver.find({ active: true }).sort({
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

module.exports.deleteDriver = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedDriver = await EnterpriseDriver.findByIdAndUpdate(
            id,
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
