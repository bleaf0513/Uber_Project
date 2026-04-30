const mongoose = require('mongoose');
const Enterprise = require('../models/enterprise.model');
const EnterpriseDelivery = require('../models/enterpriseDelivery.model');
const EnterpriseDriver = require('../models/enterpriseDriver.model');
const EnterpriseClient = require('../models/enterpriseClient.model');

let mapService = null;

try {
    mapService = require('../services/maps.service');
} catch (error) {
    console.warn(
        '[enterpriseDelivery.controller] No se pudo cargar maps.service. La optimización seguirá funcionando solo con coordenadas ya guardadas.'
    );
}

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
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return false;
    }

    if (lat === 0 && lng === 0) {
        return false;
    }

    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const buildEmptyRouteMeta = () => ({
    estimatedDistanceKm: 0,
    estimatedDurationMin: 0,
    totalStopsInRoute: 0,
    origin: {
        lat: null,
        lng: null,
        address: '',
        formattedAddress: '',
        placeId: '',
    },
    modifiedAfterOptimization: false,
    needsRecalculation: false,
    lastAddedDeliveryId: '',
    lastModifiedAt: null,
    recalculatedAt: null,
    recalculationWarning: '',
    version: 1,
});

const normalizeGoogleCoordinates = (coordinates) => {
    if (!coordinates) return null;

    const lat = Number(
        coordinates.lat ??
            coordinates.ltd ??
            coordinates.latitude ??
            coordinates.location?.lat ??
            coordinates.geometry?.location?.lat ??
            coordinates.coordinates?.lat
    );

    const lng = Number(
        coordinates.lng ??
            coordinates.longitude ??
            coordinates.location?.lng ??
            coordinates.geometry?.location?.lng ??
            coordinates.coordinates?.lng
    );

    const location = {
        lat,
        lng,
        formattedAddress: normalizeString(
            coordinates.formattedAddress ||
                coordinates.formatted_address ||
                coordinates.address ||
                coordinates.name
        ),
    };

    return hasValidLocation(location) ? location : null;
};

const callMapServiceCoordinates = async (address) => {
    const cleanAddress = normalizeString(address);

    if (!cleanAddress || !mapService) {
        return null;
    }

    const possibleMethods = [
        'getAddressCoordinates',
        'getCoordinates',
        'getCoordinatesFromAddress',
        'getLocationFromAddress',
        'geocodeAddress',
    ];

    for (const methodName of possibleMethods) {
        if (typeof mapService[methodName] !== 'function') {
            continue;
        }

        try {
            const coordinates = await mapService[methodName](cleanAddress);
            const normalized = normalizeGoogleCoordinates(coordinates);

            if (normalized) {
                return normalized;
            }
        } catch (error) {
            console.error(`[maps.service.${methodName}] No resolvió coordenadas:`, {
                address: cleanAddress,
                error: error.message,
            });
        }
    }

    return null;
};

const resolveDeliveryLocation = async ({
    currentLocation,
    address,
    formattedAddress,
}) => {
    if (hasValidLocation(currentLocation)) {
        return {
            lat: Number(currentLocation.lat),
            lng: Number(currentLocation.lng),
            formattedAddress: normalizeString(
                currentLocation.formattedAddress ||
                    formattedAddress ||
                    address
            ),
        };
    }

    const cleanAddress = normalizeString(formattedAddress || address);

    if (!cleanAddress) {
        return null;
    }

    const resolved = await callMapServiceCoordinates(cleanAddress);

    if (!resolved) {
        return null;
    }

    return {
        lat: resolved.lat,
        lng: resolved.lng,
        formattedAddress: resolved.formattedAddress || cleanAddress,
    };
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

const resolveRouteOrigin = async ({ req, baseLocation, routeDeliveries = [] }) => {
    const enterprise = await Enterprise.findOne({
        _id: req.enterprise._id,
    });

    if (!enterprise) {
        return {
            enterprise: null,
            origin: null,
        };
    }

    const bodyOrigin = {
        lat: normalizeCoordinate(baseLocation?.lat),
        lng: normalizeCoordinate(baseLocation?.lng),
        formattedAddress: normalizeString(
            baseLocation?.formattedAddress || baseLocation?.address
        ),
        placeId: normalizeString(baseLocation?.placeId || ''),
    };

    let origin = hasValidLocation(bodyOrigin)
        ? {
              lat: bodyOrigin.lat,
              lng: bodyOrigin.lng,
              address:
                  normalizeString(baseLocation?.formattedAddress || baseLocation?.address) ||
                  normalizeString(enterprise.companyName),
              placeId: bodyOrigin.placeId,
          }
        : null;

    const savedRouteOrigin =
        routeDeliveries[0]?.routeMeta?.origin ||
        routeDeliveries.find((delivery) => delivery?.routeMeta?.origin)?.routeMeta?.origin ||
        null;

    if (!origin && hasValidLocation(savedRouteOrigin)) {
        origin = {
            lat: Number(savedRouteOrigin.lat),
            lng: Number(savedRouteOrigin.lng),
            address:
                normalizeString(
                    savedRouteOrigin.formattedAddress ||
                        savedRouteOrigin.address
                ) || 'Punto de salida',
            placeId: normalizeString(savedRouteOrigin.placeId || ''),
        };
    }

    if (!origin && hasValidLocation(enterprise.baseLocation)) {
        origin = {
            lat: Number(enterprise.baseLocation.lat),
            lng: Number(enterprise.baseLocation.lng),
            address:
                normalizeString(enterprise.baseLocation.formattedAddress) ||
                normalizeString(enterprise.baseLocation.address) ||
                normalizeString(enterprise.companyName),
            placeId: normalizeString(enterprise.baseLocation.placeId || ''),
        };
    }

    if (!origin) {
        const originAddress =
            normalizeString(baseLocation?.formattedAddress || baseLocation?.address) ||
            normalizeString(savedRouteOrigin?.formattedAddress || savedRouteOrigin?.address) ||
            normalizeString(enterprise.baseLocation?.formattedAddress) ||
            normalizeString(enterprise.baseLocation?.address);

        const resolvedOrigin = await resolveDeliveryLocation({
            currentLocation: null,
            address: originAddress,
            formattedAddress: originAddress,
        });

        if (resolvedOrigin) {
            origin = {
                lat: resolvedOrigin.lat,
                lng: resolvedOrigin.lng,
                address: resolvedOrigin.formattedAddress,
                placeId: normalizeString(baseLocation?.placeId || savedRouteOrigin?.placeId || ''),
            };
        }
    }

    return {
        enterprise,
        origin,
    };
};

const populateDeliveryQuery = (query) =>
    query
        .populate('assignedDriverId', 'name cedula phone email vehicle plate status')
        .populate('clientId', 'name phone address neighborhood reference placeId isActive');

module.exports.getEnterpriseDeliveries = async (req, res) => {
    try {
        const deliveries = await populateDeliveryQuery(
            EnterpriseDelivery.find({
                enterprise: req.enterprise._id,
            })
        ).sort({ createdAt: -1 });

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

        const deliveries = await populateDeliveryQuery(
            EnterpriseDelivery.find({
                assignedDriverId: driverId,
            })
        ).sort({ routeGroupId: 1, routeOrder: 1, createdAt: -1 });

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

        const incomingLat = normalizeCoordinate(deliveryLat ?? lat);
        const incomingLng = normalizeCoordinate(deliveryLng ?? lng);

        const resolvedDeliveryLocation = await resolveDeliveryLocation({
            currentLocation: {
                lat: incomingLat,
                lng: incomingLng,
                formattedAddress: normalizeString(formattedAddress || resolvedAddress),
            },
            address: resolvedAddress,
            formattedAddress: formattedAddress || resolvedAddress,
        });

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
            routeMeta: buildEmptyRouteMeta(),
            optimizedAt: null,
            assignedAt: isPendingRoute ? null : new Date(),
        };

        if (resolvedDeliveryLocation) {
            deliveryPayload.deliveryLocation = resolvedDeliveryLocation;
        }

        const delivery = await EnterpriseDelivery.create(deliveryPayload);

        const populatedDelivery = await populateDeliveryQuery(
            EnterpriseDelivery.findById(delivery._id)
        );

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

module.exports.optimizeEnterpriseRoutes = async (req, res) => {
    try {
        const { routeName, baseLocation, deliveryIds } = req.body;

        const { enterprise, origin } = await resolveRouteOrigin({
            req,
            baseLocation,
            routeDeliveries: [],
        });

        if (!enterprise) {
            return res.status(404).json({
                message: 'Empresa no encontrada.',
            });
        }

        if (!hasValidLocation(origin)) {
            return res.status(400).json({
                message:
                    'Primero debes configurar el punto de carga de la empresa o enviar baseLocation con lat y lng válidos.',
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

        const deliveriesReadyForOptimization = [];

        for (const delivery of deliveries) {
            if (hasValidLocation(delivery.deliveryLocation)) {
                deliveriesReadyForOptimization.push(delivery);
                continue;
            }

            const resolvedLocation = await resolveDeliveryLocation({
                currentLocation: delivery.deliveryLocation,
                address: delivery.address,
                formattedAddress:
                    delivery.deliveryLocation?.formattedAddress || delivery.address,
            });

            if (resolvedLocation) {
                delivery.deliveryLocation = resolvedLocation;
                await delivery.save();
            }

            deliveriesReadyForOptimization.push(delivery);
        }

        const deliveriesWithLocation = deliveriesReadyForOptimization.filter((delivery) =>
            hasValidLocation(delivery.deliveryLocation)
        );

        const deliveriesWithoutLocation = deliveriesReadyForOptimization.filter(
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
            normalizeString(routeName) ||
            `Ruta inteligente ${new Date().toLocaleDateString('es-CO')}`;

        const optimized = optimizeNearestNeighbor(origin, deliveriesWithLocation);
        const optimizedAt = new Date();

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
                            origin: {
                                lat: origin.lat,
                                lng: origin.lng,
                                address: origin.address || '',
                                formattedAddress: origin.address || '',
                                placeId: origin.placeId || '',
                            },
                            modifiedAfterOptimization: false,
                            needsRecalculation: false,
                            lastAddedDeliveryId: '',
                            lastModifiedAt: null,
                            recalculatedAt: null,
                            recalculationWarning: '',
                            version: 1,
                        },
                        optimizedAt,
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
                needsRecalculation: false,
                version: 1,
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
            message: error.message || 'Error optimizando rutas.',
            error: error.name || 'Error',
            details: error.errors || null,
        });
    }
};

module.exports.assignOptimizedRoute = async (req, res) => {
    try {
        const { routeGroupId, assignedDriverId } = req.body;

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

        const needsRecalculation = deliveries.some((delivery) => {
            return (
                delivery?.routeMeta?.needsRecalculation ||
                delivery?.routeMeta?.modifiedAfterOptimization
            );
        });

        if (needsRecalculation) {
            return res.status(400).json({
                message:
                    'Esta ruta fue modificada después de optimizar. Debes recalcularla antes de asignarla.',
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

        const assignedDeliveries = await populateDeliveryQuery(
            EnterpriseDelivery.find({
                enterprise: req.enterprise._id,
                routeGroupId,
            })
        ).sort({ routeOrder: 1 });

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

module.exports.addDeliveryToOptimizedRoute = async (req, res) => {
    try {
        const { routeGroupId, deliveryId } = req.body;

        if (!routeGroupId) {
            return res.status(400).json({
                message: 'routeGroupId es obligatorio.',
            });
        }

        if (!deliveryId || !mongoose.Types.ObjectId.isValid(String(deliveryId))) {
            return res.status(400).json({
                message: 'deliveryId inválido.',
            });
        }

        const routeDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
            status: 'Pendiente',
        }).sort({ routeOrder: 1 });

        if (!routeDeliveries.length) {
            return res.status(404).json({
                message: 'No se encontró una ruta inteligente pendiente con ese routeGroupId.',
            });
        }

        const routeAlreadyAssigned = routeDeliveries.some((delivery) =>
            Boolean(delivery.assignedDriverId)
        );

        if (routeAlreadyAssigned) {
            return res.status(400).json({
                message:
                    'Esta ruta ya fue asignada a un conductor. Para agregar una parada urgente, crea una nueva ruta o usa un flujo de reasignación.',
            });
        }

        const deliveryToAdd = await EnterpriseDelivery.findOne({
            _id: deliveryId,
            enterprise: req.enterprise._id,
            status: 'Pendiente',
        });

        if (!deliveryToAdd) {
            return res.status(404).json({
                message: 'No se encontró la entrega que deseas agregar.',
            });
        }

        if (deliveryToAdd.assignedDriverId) {
            return res.status(400).json({
                message: 'Esta entrega ya está asignada a un conductor.',
            });
        }

        if (
            deliveryToAdd.optimizationStatus === 'optimized' &&
            deliveryToAdd.routeGroupId &&
            String(deliveryToAdd.routeGroupId) !== String(routeGroupId)
        ) {
            return res.status(400).json({
                message: 'Esta entrega ya pertenece a otra ruta optimizada.',
            });
        }

        let resolvedLocation = null;

        if (hasValidLocation(deliveryToAdd.deliveryLocation)) {
            resolvedLocation = {
                lat: Number(deliveryToAdd.deliveryLocation.lat),
                lng: Number(deliveryToAdd.deliveryLocation.lng),
                formattedAddress:
                    deliveryToAdd.deliveryLocation.formattedAddress ||
                    deliveryToAdd.address,
            };
        } else {
            resolvedLocation = await resolveDeliveryLocation({
                currentLocation: deliveryToAdd.deliveryLocation,
                address: deliveryToAdd.address,
                formattedAddress:
                    deliveryToAdd.deliveryLocation?.formattedAddress ||
                    deliveryToAdd.address,
            });
        }

        if (!resolvedLocation) {
            return res.status(400).json({
                message:
                    'La entrega no tiene coordenadas válidas. Revisa la dirección antes de agregarla a la ruta.',
                delivery: {
                    _id: deliveryToAdd._id,
                    invoiceNumber: deliveryToAdd.invoiceNumber,
                    clientName: deliveryToAdd.clientName,
                    address: deliveryToAdd.address,
                },
            });
        }

        const maxRouteOrder = routeDeliveries.reduce((max, delivery) => {
            const currentOrder = Number(delivery.routeOrder || 0);
            return currentOrder > max ? currentOrder : max;
        }, 0);

        const currentRouteMeta = routeDeliveries[0]?.routeMeta || buildEmptyRouteMeta();
        const now = new Date();

        deliveryToAdd.deliveryLocation = resolvedLocation;
        deliveryToAdd.optimizationStatus = 'optimized';
        deliveryToAdd.routeGroupId = routeGroupId;
        deliveryToAdd.routeName = routeDeliveries[0]?.routeName || 'Ruta inteligente';
        deliveryToAdd.routeOrder = maxRouteOrder + 1;
        deliveryToAdd.optimizedAt = now;
        deliveryToAdd.assignedDriverId = null;
        deliveryToAdd.assignedDriverName = PENDING_ROUTE_NAME;
        deliveryToAdd.routeMeta = {
            ...currentRouteMeta,
            totalStopsInRoute: routeDeliveries.length + 1,
            modifiedAfterOptimization: true,
            needsRecalculation: true,
            lastAddedDeliveryId: String(deliveryToAdd._id),
            lastModifiedAt: now,
            recalculationWarning: '',
            version: Number(currentRouteMeta.version || 1),
        };

        await deliveryToAdd.save();

        await EnterpriseDelivery.updateMany(
            {
                enterprise: req.enterprise._id,
                routeGroupId,
                status: 'Pendiente',
            },
            {
                $set: {
                    'routeMeta.modifiedAfterOptimization': true,
                    'routeMeta.needsRecalculation': true,
                    'routeMeta.lastAddedDeliveryId': String(deliveryToAdd._id),
                    'routeMeta.lastModifiedAt': now,
                    'routeMeta.totalStopsInRoute': routeDeliveries.length + 1,
                },
            }
        );

        const updatedRouteDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
        })
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
            .sort({ routeOrder: 1 });

        return res.status(200).json({
            message:
                'Parada agregada correctamente. Recalcula la ruta antes de asignarla al conductor.',
            route: {
                routeGroupId,
                routeName: routeDeliveries[0]?.routeName || 'Ruta inteligente',
                totalStops: updatedRouteDeliveries.length,
                needsRecalculation: true,
                deliveries: updatedRouteDeliveries,
            },
        });
    } catch (error) {
        console.error('Error agregando entrega a ruta optimizada:', error);
        return res.status(500).json({
            message: error.message || 'Error agregando entrega a ruta optimizada.',
            error: error.name || 'Error',
            details: error.errors || null,
        });
    }
};

module.exports.recalculateOptimizedRoute = async (req, res) => {
    try {
        const { routeGroupId, baseLocation } = req.body;

        if (!routeGroupId) {
            return res.status(400).json({
                message: 'routeGroupId es obligatorio.',
            });
        }

        const routeDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
            status: 'Pendiente',
        }).sort({ routeOrder: 1 });

        if (!routeDeliveries.length) {
            return res.status(404).json({
                message: 'No se encontraron entregas pendientes para recalcular esta ruta.',
            });
        }

        const routeAlreadyAssigned = routeDeliveries.some((delivery) =>
            Boolean(delivery.assignedDriverId)
        );

        if (routeAlreadyAssigned) {
            return res.status(400).json({
                message:
                    'Esta ruta ya fue asignada. No se puede recalcular desde logística sin crear una nueva versión o reasignación.',
            });
        }

        const { enterprise, origin } = await resolveRouteOrigin({
            req,
            baseLocation,
            routeDeliveries,
        });

        if (!enterprise) {
            return res.status(404).json({
                message: 'Empresa no encontrada.',
            });
        }

        if (!hasValidLocation(origin)) {
            return res.status(400).json({
                message:
                    'No se pudo recalcular la ruta porque no hay un punto de salida válido.',
            });
        }

        const deliveriesReadyForOptimization = [];

        for (const delivery of routeDeliveries) {
            if (hasValidLocation(delivery.deliveryLocation)) {
                deliveriesReadyForOptimization.push(delivery);
                continue;
            }

            const resolvedLocation = await resolveDeliveryLocation({
                currentLocation: delivery.deliveryLocation,
                address: delivery.address,
                formattedAddress:
                    delivery.deliveryLocation?.formattedAddress || delivery.address,
            });

            if (resolvedLocation) {
                delivery.deliveryLocation = resolvedLocation;
                await delivery.save();
            }

            deliveriesReadyForOptimization.push(delivery);
        }

        const deliveriesWithLocation = deliveriesReadyForOptimization.filter((delivery) =>
            hasValidLocation(delivery.deliveryLocation)
        );

        const deliveriesWithoutLocation = deliveriesReadyForOptimization.filter(
            (delivery) => !hasValidLocation(delivery.deliveryLocation)
        );

        if (!deliveriesWithLocation.length) {
            return res.status(400).json({
                message:
                    'No hay entregas con coordenadas válidas para recalcular esta ruta.',
                withoutLocation: deliveriesWithoutLocation.map((delivery) => ({
                    _id: delivery._id,
                    invoiceNumber: delivery.invoiceNumber,
                    clientName: delivery.clientName,
                    address: delivery.address,
                })),
            });
        }

        const optimized = optimizeNearestNeighbor(origin, deliveriesWithLocation);
        const recalculatedAt = new Date();

        const routeName =
            normalizeString(routeDeliveries[0]?.routeName) ||
            `Ruta inteligente ${new Date().toLocaleDateString('es-CO')}`;

        const currentVersion = Number(routeDeliveries[0]?.routeMeta?.version || 1);
        const nextVersion = currentVersion + 1;

        const bulkOps = optimized.ordered.map((item, index) => ({
            updateOne: {
                filter: {
                    _id: item.delivery._id,
                    enterprise: req.enterprise._id,
                    routeGroupId,
                    status: 'Pendiente',
                },
                update: {
                    $set: {
                        optimizationStatus: 'optimized',
                        routeGroupId,
                        routeName,
                        routeOrder: index + 1,
                        routeMeta: {
                            estimatedDistanceKm: optimized.totalDistanceKm,
                            estimatedDurationMin: optimized.estimatedDurationMin,
                            totalStopsInRoute: optimized.ordered.length,
                            origin: {
                                lat: origin.lat,
                                lng: origin.lng,
                                address: origin.address || '',
                                formattedAddress: origin.address || '',
                                placeId: origin.placeId || '',
                            },
                            modifiedAfterOptimization: false,
                            needsRecalculation: false,
                            lastAddedDeliveryId: '',
                            lastModifiedAt: null,
                            recalculatedAt,
                            recalculationWarning: '',
                            version: nextVersion,
                        },
                        optimizedAt: recalculatedAt,
                    },
                },
            },
        }));

        if (bulkOps.length > 0) {
            await EnterpriseDelivery.bulkWrite(bulkOps);
        }

        if (deliveriesWithoutLocation.length > 0) {
            await EnterpriseDelivery.updateMany(
                {
                    enterprise: req.enterprise._id,
                    routeGroupId,
                    _id: {
                        $in: deliveriesWithoutLocation.map((delivery) => delivery._id),
                    },
                },
                {
                    $set: {
                        'routeMeta.needsRecalculation': true,
                        'routeMeta.modifiedAfterOptimization': true,
                        'routeMeta.recalculationWarning':
                            'Esta entrega no tiene coordenadas válidas.',
                    },
                }
            );
        }

        const updatedRouteDeliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            routeGroupId,
        })
            .populate('clientId', 'name phone address neighborhood reference placeId isActive')
            .sort({ routeOrder: 1 });

        return res.status(200).json({
            message: 'Ruta recalculada correctamente.',
            route: {
                routeGroupId,
                routeName,
                origin,
                totalStops: updatedRouteDeliveries.length,
                estimatedDistanceKm: optimized.totalDistanceKm,
                estimatedDurationMin: optimized.estimatedDurationMin,
                needsRecalculation: deliveriesWithoutLocation.length > 0,
                version: nextVersion,
                deliveries: updatedRouteDeliveries,
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
        console.error('Error recalculando ruta optimizada:', error);
        return res.status(500).json({
            message: error.message || 'Error recalculando ruta optimizada.',
            error: error.name || 'Error',
            details: error.errors || null,
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

        const populatedDelivery = await populateDeliveryQuery(
            EnterpriseDelivery.findById(delivery._id)
        );

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