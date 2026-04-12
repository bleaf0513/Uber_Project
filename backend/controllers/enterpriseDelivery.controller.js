const mongoose = require('mongoose');
const EnterpriseDelivery = require('../models/enterpriseDelivery.model');
const EnterpriseDriver = require('../models/enterpriseDriver.model');
const EnterpriseClient = require('../models/enterpriseClient.model');

const normalizeString = (value, fallback = '') =>
    String(value ?? fallback).trim();

const normalizeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports.getEnterpriseDeliveries = async (req, res) => {
    try {
        const deliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
        })
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
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
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
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
            clientId,
            clientName,
            address,
            clientPhone,
            neighborhood,
            reference,
            assignedDriverId,
            notes,
            placeId,
            invoiceValue,
            paymentMethod,
        } = req.body;

        if (!invoiceNumber || !assignedDriverId) {
            return res.status(400).json({
                message: 'Número de factura y conductor son obligatorios.',
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

        let resolvedClientId = null;
        let resolvedClientName = normalizeString(clientName);
        let resolvedAddress = normalizeString(address);
        let resolvedClientPhone = normalizeString(clientPhone);
        let resolvedNeighborhood = normalizeString(neighborhood);
        let resolvedReference = normalizeString(reference);
        let resolvedPlaceId = normalizeString(placeId);

        if (clientId) {
            if (!mongoose.Types.ObjectId.isValid(String(clientId))) {
                return res.status(400).json({
                    message: 'Cliente inválido.',
                });
            }

            const client = await EnterpriseClient.findOne({
                _id: clientId,
                enterprise: req.enterprise._id,
            });

            if (!client) {
                return res.status(404).json({
                    message: 'Cliente no encontrado para esta empresa.',
                });
            }

            resolvedClientId = client._id;
            resolvedClientName = normalizeString(client.name);
            resolvedAddress = normalizeString(client.address);
            resolvedClientPhone = normalizeString(client.phone);
            resolvedNeighborhood = normalizeString(client.neighborhood);
            resolvedReference = normalizeString(client.reference);
            resolvedPlaceId = normalizeString(client.placeId);
        }

        if (!resolvedClientName || !resolvedAddress || !resolvedClientPhone) {
            return res.status(400).json({
                message: 'Cliente, dirección y teléfono son obligatorios.',
            });
        }

        const safePaymentMethod =
            paymentMethod === 'Transferencia' ? 'Transferencia' : 'Efectivo';

        const safeInvoiceValue = Math.max(0, normalizeNumber(invoiceValue, 0));

        const delivery = await EnterpriseDelivery.create({
            enterprise: req.enterprise._id,
            invoiceNumber: normalizeString(invoiceNumber),
            clientId: resolvedClientId,
            clientName: resolvedClientName,
            address: resolvedAddress,
            clientPhone: resolvedClientPhone,
            neighborhood: resolvedNeighborhood,
            reference: resolvedReference,
            placeId: resolvedPlaceId,
            assignedDriverId: driver._id,
            assignedDriverName: driver.name,
            invoiceValue: safeInvoiceValue,
            paymentMethod: safePaymentMethod,
            notes: normalizeString(notes),
            status: 'Pendiente',
        });

        const populatedDelivery = await EnterpriseDelivery.findById(delivery._id)
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .populate('clientId', 'name phone address neighborhood reference placeId isActive');

        return res.status(201).json({
            message: 'Entrega creada correctamente.',
            delivery: populatedDelivery,
        });
    } catch (error) {
        console.error('Error creando entrega:', error);
        return res.status(500).json({
            message: 'Error creando entrega.',
        });
    }
};

module.exports.updateEnterpriseDeliveryStatusByDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const driverId = req.driver?._id || req.enterpriseDriver?._id;

        if (!driverId) {
            return res.status(401).json({
                message: 'Conductor no autorizado.',
            });
        }

        if (!['Pendiente', 'En curso', 'Finalizada'].includes(status)) {
            return res.status(400).json({
                message: 'Estado no válido.',
            });
        }

        const delivery = await EnterpriseDelivery.findOne({
            _id: id,
            assignedDriverId: driverId,
        });

        if (!delivery) {
            return res.status(404).json({
                message: 'Entrega no encontrada para este conductor.',
            });
        }

        delivery.status = status;

        if (status === 'En curso') {
            delivery.startedAt = new Date();
            delivery.finishedAt = null;
        }

        if (status === 'Finalizada') {
            if (!delivery.startedAt) {
                delivery.startedAt = new Date();
            }
            delivery.finishedAt = new Date();
        }

        if (status === 'Pendiente') {
            delivery.finishedAt = null;
        }

        await delivery.save();

        const populatedDelivery = await EnterpriseDelivery.findById(delivery._id)
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .populate('clientId', 'name phone address neighborhood reference placeId isActive');

        return res.status(200).json({
            message: 'Estado actualizado correctamente.',
            delivery: populatedDelivery,
        });
    } catch (error) {
        console.error('Error actualizando estado de entrega:', error);
        return res.status(500).json({
            message: 'Error actualizando estado de entrega.',
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
