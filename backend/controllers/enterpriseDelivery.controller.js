const EnterpriseDelivery = require('../models/enterpriseDelivery.model');
const EnterpriseDriver = require('../models/enterpriseDriver.model');

module.exports.getEnterpriseDeliveries = async (req, res) => {
    try {
        const deliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
        })
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .sort({ createdAt: -1 });

        return res.status(200).json({ deliveries });
    } catch (error) {
        console.error('Error obteniendo entregas:', error);
        return res.status(500).json({
            message: 'Error obteniendo entregas.',
        });
    }
};

module.exports.getMyEnterpriseDeliveries = async (req, res) => {
    try {
        const driverId = req.driver?._id || req.enterpriseDriver?._id;

        if (!driverId) {
            return res.status(401).json({
                message: 'Conductor no autorizado.',
            });
        }

        const deliveries = await EnterpriseDelivery.find({
            assignedDriverId: driverId,
        })
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .sort({ createdAt: -1 });

        return res.status(200).json({ deliveries });
    } catch (error) {
        console.error('Error obteniendo entregas del conductor:', error);
        return res.status(500).json({
            message: 'Error obteniendo entregas del conductor.',
        });
    }
};

module.exports.createEnterpriseDelivery = async (req, res) => {
    try {
        const {
            invoiceNumber,
            clientName,
            address,
            clientPhone,
            assignedDriverId,
            notes,
            placeId,
        } = req.body;

        if (
            !invoiceNumber ||
            !clientName ||
            !address ||
            !clientPhone ||
            !assignedDriverId
        ) {
            return res.status(400).json({
                message: 'Todos los campos obligatorios son requeridos.',
            });
        }

        const driver = await EnterpriseDriver.findOne({
            _id: assignedDriverId,
            enterprise: req.enterprise._id,
        });

        if (!driver) {
            return res.status(404).json({
                message: 'Conductor no encontrado para esta empresa.',
            });
        }

        const delivery = await EnterpriseDelivery.create({
            enterprise: req.enterprise._id,
            invoiceNumber,
            clientName,
            address,
            clientPhone,
            assignedDriverId: driver._id,
            assignedDriverName: driver.name,
            notes: notes || '',
            placeId: placeId || '',
            status: 'Pendiente',
        });

        return res.status(201).json({
            message: 'Entrega creada correctamente.',
            delivery,
        });
    } catch (error) {
        console.error('Error creando entrega:', error);
        return res.status(500).json({
            message: 'Error creando entrega.',
        });
    }
};

module.exports.deleteEnterpriseDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await EnterpriseDelivery.findOneAndDelete({
            _id: id,
            enterprise: req.enterprise._id,
        });

        if (!deleted) {
            return res.status(404).json({
                message: 'Entrega no encontrada.',
            });
        }

        return res.status(200).json({
            message: 'Entrega eliminada correctamente.',
        });
    } catch (error) {
        console.error('Error eliminando entrega:', error);
        return res.status(500).json({
            message: 'Error eliminando entrega.',
        });
    }
};
