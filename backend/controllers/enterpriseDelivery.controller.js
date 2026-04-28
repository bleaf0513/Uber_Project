const mongoose = require('mongoose');
const Enterprise = require('../models/enterprise.model');
const EnterpriseDelivery = require('../models/enterpriseDelivery.model');
const EnterpriseDriver = require('../models/enterpriseDriver.model');
const EnterpriseClient = require('../models/enterpriseClient.model');

const PENDING_ROUTE_VALUE = 'PENDING_ROUTE';
const PENDING_ROUTE_NAME = 'Pendiente de ruta inteligente';

const normalizeString = (value, fallback = '') =>
    String(value ?? fallback).trim();

const normalizeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCoordinate = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const hasValidLocation = (location) => {
    return (
        location &&
        Number.isFinite(Number(location.lat)) &&
        Number.isFinite(Number(location.lng))
    );
};

const toRad = (degrees) => {
    return (Number(degrees) * Math.PI) / 180;
};

const haversineDistanceKm = (pointA, pointB) => {
    if (!hasValidLocation(pointA) || !hasValidLocation(pointB)) {
        return Number.POSITIVE_INFINITY;
    }

    const R = 6371;
    const lat1 = toRad(pointA.lat);
    const lat2 = toRad(pointB.lat);
    const dLat = toRad(Number(pointB.lat) - Number(pointA.lat));
    const dLng = toRad(Number(pointB.lng) - Number(pointA.lng));

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const buildRouteGroupId = () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `RUTA-${date}-${random}`;
};

const estimateDurationMin = (distanceKm) => {
    /**
     * Estimación sencilla para V1:
     * velocidad urbana promedio aproximada de 22 km/h.
     * Más adelante podemos reemplazar esto por Google Distance Matrix / Routes API.
     */
    const avgUrbanSpeedKmH = 22;

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        return 0;
    }

    return Math.round((distanceKm / avgUrbanSpeedKmH) * 60);
};

const optimizeNearestNeighbor = (origin, deliveries) => {
    const pending = deliveries
        .filter((delivery) => hasValidLocation(delivery.deliveryLocation))
        .map((delivery) => ({
            delivery,
            location: {
                lat: Number(delivery.deliveryLocation.lat),
                lng: Number(delivery.deliveryLocation.lng),
            },
        }));

    const ordered = [];
    let currentPoint = {
        lat: Number(origin.lat),
        lng: Number(origin.lng),
    };

    let totalDistanceKm = 0;

    while (pending.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < pending.length; i += 1) {
            const distance = haversineDistanceKm(currentPoint, pending[i].location);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        const [nearest] = pending.splice(nearestIndex, 1);

        totalDistanceKm += Number.isFinite(nearestDistance) ? nearestDistance : 0;

        ordered.push({
            delivery: nearest.delivery,
            distanceFromPreviousKm: Number.isFinite(nearestDistance)
                ? Number(nearestDistance.toFixed(2))
                : 0,
        });

        currentPoint = nearest.location;
    }

    return {
        ordered,
        totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
        estimatedDurationMin: estimateDurationMin(totalDistanceKm),
    };
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
            .sort({ routeGroupId: 1, routeOrder: 1, createdAt: -1 });

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

            lat,
            lng,
            deliveryLat,
            deliveryLng,
            formattedAddress,
        } = req.body;

        if (!invoiceNumber) {
            return res.status(400).json({
                message: 'Número de factura es obligatorio.',
            });
        }

        if (!assignedDriverId) {
            return res.status(400).json({
                message:
                    'Debes seleccionar un conductor o la opción Pendiente de ruta inteligente.',
            });
        }

        const isPendingRoute = String(assignedDriverId) === PENDING_ROUTE_VALUE;

        let driver = null;

        if (!isPendingRoute) {
            if (!mongoose.Types.ObjectId.isValid(String(assignedDriverId))) {
                return res.status(400).json({
                    message: 'Conductor inválido.',
                });
            }

            driver = await EnterpriseDriver.findOne({
                _id: assignedDriverId,
                enterprise: req.enterprise._id,
            });

            if (!driver) {
                return res.status(404).json({
                    message: 'Conductor no encontrado para esta empresa.',
                });
            }
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

        const finalLat = normalizeCoordinate(deliveryLat ?? lat);
        const finalLng = normalizeCoordinate(deliveryLng ?? lng);

        const deliveryPayload = {
            enterprise: req.enterprise._id,
            invoiceNumber: normalizeString(invoiceNumber),
            clientId: resolvedClientId,
            clientName: resolvedClientName,
            address: resolvedAddress,
            clientPhone: resolvedClientPhone,
            neighborhood: resolvedNeighborhood,
            reference: resolvedReference,
            placeId: resolvedPlaceId,

            assignedDriverId: isPendingRoute ? null : driver._id,
            assignedDriverName: isPendingRoute ? PENDING_ROUTE_NAME : driver.name,

            invoiceValue: safeInvoiceValue,
            paymentMethod: safePaymentMethod,
            notes: normalizeString(notes),
            status: 'Pendiente',

            optimizationStatus: isPendingRoute ? 'pending' : 'none',
            routeGroupId: '',
            routeName: '',
            routeOrder: null,
            routeMeta: {
                estimatedDistanceKm: 0,
                estimatedDurationMin: 0,
                totalStopsInRoute: 0,
            },
            optimizedAt: null,
            assignedAt: isPendingRoute ? null : new Date(),
        };

        if (finalLat !== null || finalLng !== null || formattedAddress) {
            deliveryPayload.deliveryLocation = {
                lat: finalLat,
                lng: finalLng,
                formattedAddress: normalizeString(formattedAddress || resolvedAddress),
            };
        }

        const delivery = await EnterpriseDelivery.create(deliveryPayload);

        const populatedDelivery = await EnterpriseDelivery.findById(delivery._id)
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .populate('clientId', 'name phone address neighborhood reference placeId isActive');

        return res.status(201).json({
            message: isPendingRoute
                ? 'Entrega creada correctamente y enviada a rutas inteligentes.'
                : 'Entrega creada correctamente.',
            delivery: populatedDelivery,
        });
    } catch (error) {
    console.error('Error creando entrega:', error);

    return res.status(500).json({
        message: error.message || 'Error creando entrega.',
        error: error.name || 'Error',
        details: error.errors || null,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
}
};

/**
 * RUTAS INTELIGENTES
 * Trae las entregas pendientes de optimización.
 */
module.exports.getPendingRouteDeliveries = async (req, res) => {
    try {
        const deliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            optimizationStatus: 'pending',
            assignedDriverId: null,
            status: 'Pendiente',
        })
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
            .sort({ createdAt: 1 });

        const withLocation = [];
        const withoutLocation = [];

        deliveries.forEach((delivery) => {
            if (hasValidLocation(delivery.deliveryLocation)) {
                withLocation.push(delivery);
            } else {
                withoutLocation.push(delivery);
            }
        });

        return res.status(200).json({
            deliveries,
            summary: {
                total: deliveries.length,
                withLocation: withLocation.length,
                withoutLocation: withoutLocation.length,
            },
        });
    } catch (error) {
        console.error('Error obteniendo entregas pendientes de ruta:', error);
        return res.status(500).json({
            message: 'Error obteniendo entregas pendientes de ruta.',
        });
    }
};

/**
 * RUTAS INTELIGENTES
 * Optimiza por cercanía desde el punto base de la empresa.
 *
 * V1:
 * - Toma pedidos pendientes.
 * - Usa baseLocation de la empresa o baseLocation enviada en el body.
 * - Ordena por el vecino más cercano.
 * - Guarda routeGroupId, routeName y routeOrder.
 */
module.exports.optimizeEnterpriseRoutes = async (req, res) => {
    try {
        const {
            routeName,
            baseLocation,
            deliveryIds,
        } = req.body;

        const enterprise = await Enterprise.findOne({
            _id: req.enterprise._id,
        });

        if (!enterprise) {
            return res.status(404).json({
                message: 'Empresa no encontrada.',
            });
        }

        const bodyBaseLat = normalizeCoordinate(baseLocation?.lat);
        const bodyBaseLng = normalizeCoordinate(baseLocation?.lng);

        const origin = {
            lat: bodyBaseLat ?? normalizeCoordinate(enterprise.baseLocation?.lat),
            lng: bodyBaseLng ?? normalizeCoordinate(enterprise.baseLocation?.lng),
            address:
                normalizeString(baseLocation?.address) ||
                normalizeString(enterprise.baseLocation?.address) ||
                normalizeString(enterprise.companyName),
        };

        if (!hasValidLocation(origin)) {
            return res.status(400).json({
                message:
                    'Primero debes configurar el punto de carga de la empresa o enviar baseLocation con lat y lng.',
            });
        }

        const query = {
            enterprise: req.enterprise._id,
            optimizationStatus: 'pending',
            assignedDriverId: null,
            status: 'Pendiente',
        };

        if (Array.isArray(deliveryIds) && deliveryIds.length > 0) {
            const validIds = deliveryIds.filter((id) =>
                mongoose.Types.ObjectId.isValid(String(id))
            );

            query._id = { $in: validIds };
        }

        const deliveries = await EnterpriseDelivery.find(query).sort({ createdAt: 1 });

        if (!deliveries.length) {
            return res.status(404).json({
                message: 'No hay entregas pendientes para optimizar.',
            });
        }

        const deliveriesWithLocation = deliveries.filter((delivery) =>
            hasValidLocation(delivery.deliveryLocation)
        );

        const deliveriesWithoutLocation = deliveries.filter(
            (delivery) => !hasValidLocation(delivery.deliveryLocation)
        );

        if (!deliveriesWithLocation.length) {
            return res.status(400).json({
                message:
                    'No hay entregas con coordenadas válidas para optimizar. Debes guardar lat/lng de cada dirección.',
                withoutLocation: deliveriesWithoutLocation.map((delivery) => ({
                    _id: delivery._id,
                    invoiceNumber: delivery.invoiceNumber,
                    clientName: delivery.clientName,
                    address: delivery.address,
                })),
            });
        }

        const routeGroupId = buildRouteGroupId();
        const finalRouteName =
            normalizeString(routeName) || `Ruta inteligente ${new Date().toLocaleDateString('es-CO')}`;

        const optimized = optimizeNearestNeighbor(origin, deliveriesWithLocation);

        const bulkOps = optimized.ordered.map((item, index) => ({
            updateOne: {
                filter: {
                    _id: item.delivery._id,
                    enterprise: req.enterprise._id,
                    optimizationStatus: 'pending',
                },
                update: {
                    $set: {
                        optimizationStatus: 'optimized',
                        routeGroupId,
                        routeName: finalRouteName,
                        routeOrder: index + 1,
                        routeMeta: {
                            estimatedDistanceKm: optimized.totalDistanceKm,
                            estimatedDurationMin: optimized.estimatedDurationMin,
                            totalStopsInRoute: optimized.ordered.length,
                        },
                        optimizedAt: new Date(),
                    },
                },
            },
        }));

        if (bulkOps.length > 0) {
            await EnterpriseDelivery.bulkWrite(bulkOps);
        }

        const routeDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
        })
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
            .sort({ routeOrder: 1 });

        return res.status(200).json({
            message: 'Ruta optimizada correctamente.',
            route: {
                routeGroupId,
                routeName: finalRouteName,
                origin,
                totalStops: routeDeliveries.length,
                estimatedDistanceKm: optimized.totalDistanceKm,
                estimatedDurationMin: optimized.estimatedDurationMin,
                deliveries: routeDeliveries,
                withoutLocation: deliveriesWithoutLocation.map((delivery) => ({
                    _id: delivery._id,
                    invoiceNumber: delivery.invoiceNumber,
                    clientName: delivery.clientName,
                    address: delivery.address,
                    reason: 'Sin coordenadas válidas',
                })),
            },
        });
    } catch (error) {
        console.error('Error optimizando rutas:', error);
        return res.status(500).json({
            message: 'Error optimizando rutas.',
        });
    }
};

/**
 * RUTAS INTELIGENTES
 * Asigna una ruta ya optimizada a un conductor.
 */
module.exports.assignOptimizedRoute = async (req, res) => {
    try {
        const {
            routeGroupId,
            assignedDriverId,
        } = req.body;

        if (!routeGroupId) {
            return res.status(400).json({
                message: 'routeGroupId es obligatorio.',
            });
        }

        if (!assignedDriverId || !mongoose.Types.ObjectId.isValid(String(assignedDriverId))) {
            return res.status(400).json({
                message: 'Conductor inválido.',
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

        const deliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
            optimizationStatus: 'optimized',
            status: 'Pendiente',
        }).sort({ routeOrder: 1 });

        if (!deliveries.length) {
            return res.status(404).json({
                message:
                    'No se encontraron entregas optimizadas pendientes para esta ruta.',
            });
        }

        await EnterpriseDelivery.updateMany(
            {
                enterprise: req.enterprise._id,
                routeGroupId,
                optimizationStatus: 'optimized',
                status: 'Pendiente',
            },
            {
                $set: {
                    assignedDriverId: driver._id,
                    assignedDriverName: driver.name,
                    optimizationStatus: 'assigned',
                    assignedAt: new Date(),
                },
            }
        );

        const assignedDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
        })
            .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
            .sort({ routeOrder: 1 });

        return res.status(200).json({
            message: `Ruta asignada correctamente a ${driver.name}.`,
            route: {
                routeGroupId,
                assignedDriver: {
                    _id: driver._id,
                    name: driver.name,
                    cedula: driver.cedula,
                    phone: driver.phone,
                    vehicle: driver.vehicle,
                    plate: driver.plate,
                    status: driver.status,
                },
                deliveries: assignedDeliveries,
            },
        });
    } catch (error) {
        console.error('Error asignando ruta optimizada:', error);
        return res.status(500).json({
            message: 'Error asignando ruta optimizada.',
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