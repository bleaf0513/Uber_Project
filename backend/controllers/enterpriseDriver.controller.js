const jwt = require('jsonwebtoken');
const EnterpriseDriver = require('../models/enterpriseDriver.model');
const EnterpriseDriverShift = require('../models/enterpriseDriverShift.model');
const EnterpriseDriverRoutePoint = require('../models/enterpriseDriverRoutePoint.model');
const EnterpriseDelivery = require('../models/enterpriseDelivery.model');

function normalizeCedula(value) {
    return String(value || '')
        .replace(/\./g, '')
        .replace(/-/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function haversineDistanceKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;

    const dLat = toRad(Number(b.lat) - Number(a.lat));
    const dLng = toRad(Number(b.lng) - Number(a.lng));
    const lat1 = toRad(Number(a.lat));
    const lat2 = toRad(Number(b.lat));

    const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) *
            Math.sin(dLng / 2) *
            Math.cos(lat1) *
            Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function shouldPersistNewPoint(previousPoint, nextPoint) {
    if (!previousPoint) return true;

    const distanceKm = haversineDistanceKm(previousPoint, nextPoint);

    /*
     * Guardamos un nuevo punto si se movió mínimo 30 metros.
     * Esto evita llenar la base de datos con miles de puntos repetidos
     * cuando el conductor está quieto.
     */
    return distanceKm >= 0.03;
}

function getBogotaDateString() {
    return new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Bogota',
    });
}

function normalizeTimeValue(value, fallback) {
    const clean = String(value || '').trim();

    if (!clean) return fallback;

    /*
     * Acepta formatos:
     * 08:00
     * 8:00
     * 08:00:00
     */
    const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!match) return fallback;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        return fallback;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function getOrCreateActiveShift(driver) {
    if (!driver?.enterprise || !driver?._id) return null;

    let shift = null;

    if (driver.activeShiftId) {
        shift = await EnterpriseDriverShift.findOne({
            _id: driver.activeShiftId,
            driverId: driver._id,
            status: 'Activa',
        });
    }

    if (!shift) {
        shift = await EnterpriseDriverShift.findOne({
            enterprise: driver.enterprise,
            driverId: driver._id,
            status: 'Activa',
        }).sort({ startedAt: -1 });
    }

    if (!shift) {
        shift = await EnterpriseDriverShift.create({
            enterprise: driver.enterprise,
            driverId: driver._id,
            driverName: driver.name || '',
            status: 'Activa',
            startedAt: new Date(),
            startedLocation: {
                lat: driver.currentLocation?.lat ?? null,
                lng: driver.currentLocation?.lng ?? null,
            },
            totalPoints: 0,
            totalDistanceKm: 0,
        });
    }

    if (String(driver.activeShiftId || '') !== String(shift._id)) {
        await EnterpriseDriver.findByIdAndUpdate(driver._id, {
            activeShiftId: shift._id,
        });
    }

    return shift;
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
            activeShiftId: null,
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

        if (!process.env.JWT_SECRET) {
            console.error('Falta JWT_SECRET en variables de entorno del backend.');

            return res.status(500).json({
                success: false,
                message: 'Falta configurar JWT_SECRET en el backend.',
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

        const driverPayload = {
            _id: driver._id,
            id: driver._id,
            enterprise: driver.enterprise,
            name: driver.name,
            cedula: driver.cedula,
            phone: driver.phone,
            email: driver.email,
            vehicle: driver.vehicle,
            plate: driver.plate,
            status: driver.status,
            currentLocation: driver.currentLocation || {
                lat: null,
                lng: null,
                updatedAt: null,
            },
            activeShiftId: driver.activeShiftId || null,
            active: driver.active,
        };

        const token = jwt.sign(
            {
                _id: driver._id,
                id: driver._id,
                driverId: driver._id,
                enterprise: driver.enterprise,
                role: 'enterprise_driver',
                type: 'enterprise_driver',
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '30d',
            }
        );

        res.cookie('enterpriseDriverToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: 'Ingreso correcto.',
            token,
            enterpriseDriverToken: token,
            driver: driverPayload,
        });
    } catch (error) {
        console.error('Error en loginDriverByCedula:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Error interno del servidor.',
        });
    }
};

module.exports.updateDriverLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;

        const authDriverId = req.driver?._id || req.enterpriseDriver?._id;

        if (!authDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Conductor no autorizado.',
            });
        }

        if (String(authDriverId) !== String(id)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes actualizar la ubicación de otro conductor.',
            });
        }

        if (!isValidCoordinate(lat, lng)) {
            return res.status(400).json({
                success: false,
                message: 'Latitud y longitud válidas son obligatorias.',
            });
        }

        const driver = await EnterpriseDriver.findOne({
            _id: id,
            active: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        const numericLat = Number(lat);
        const numericLng = Number(lng);
        const now = new Date();

        /*
         * Siempre actualizamos la ubicación actual para que el panel en vivo
         * siga funcionando aunque falle el guardado histórico.
         */
        const shift = await getOrCreateActiveShift(driver);

        if (!shift) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo crear o encontrar la jornada activa del conductor.',
            });
        }

        const lastPoint = await EnterpriseDriverRoutePoint.findOne({
            driverId: driver._id,
            shiftId: shift._id,
        }).sort({ recordedAt: -1 });

        const nextPoint = { lat: numericLat, lng: numericLng };
        let totalDistanceKm = Number(shift.totalDistanceKm || 0);
        let totalPoints = Number(shift.totalPoints || 0);
        let pointSaved = false;

        if (shouldPersistNewPoint(lastPoint, nextPoint)) {
            await EnterpriseDriverRoutePoint.create({
                enterprise: driver.enterprise,
                driverId: driver._id,
                shiftId: shift._id,
                lat: numericLat,
                lng: numericLng,
                recordedAt: now,
                source: 'gps',
            });

            pointSaved = true;

            if (lastPoint) {
                totalDistanceKm += haversineDistanceKm(
                    { lat: lastPoint.lat, lng: lastPoint.lng },
                    nextPoint
                );
            }

            totalPoints += 1;

            await EnterpriseDriverShift.findByIdAndUpdate(shift._id, {
                totalPoints,
                totalDistanceKm: Number(totalDistanceKm.toFixed(4)),
            });
        }

        const updatedDriver = await EnterpriseDriver.findOneAndUpdate(
            {
                _id: id,
                active: true,
            },
            {
                currentLocation: {
                    lat: numericLat,
                    lng: numericLng,
                    updatedAt: now,
                },
                activeShiftId: shift._id,
            },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Ubicación actualizada correctamente.',
            driver: updatedDriver,
            pointSaved,
            shift: {
                _id: shift._id,
                totalPoints,
                totalDistanceKm: Number(totalDistanceKm.toFixed(4)),
            },
        });
    } catch (error) {
        console.error('Error en updateDriverLocation:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar la ubicación.',
        });
    }
};

module.exports.updateDriverStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const authDriverId = req.driver?._id || req.enterpriseDriver?._id;

        if (!authDriverId) {
            return res.status(401).json({
                success: false,
                message: 'Conductor no autorizado.',
            });
        }

        if (String(authDriverId) !== String(id)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes actualizar el estado de otro conductor.',
            });
        }

        if (!['Disponible', 'En ruta'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido.',
            });
        }

        const updatePayload = { status };
        const driver = await EnterpriseDriver.findOne({
            _id: id,
            active: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        if (status === 'Disponible' && driver.activeShiftId) {
            const endedLocation = {
                lat: driver.currentLocation?.lat ?? null,
                lng: driver.currentLocation?.lng ?? null,
            };

            await EnterpriseDriverShift.findByIdAndUpdate(driver.activeShiftId, {
                status: 'Finalizada',
                endedAt: new Date(),
                endedLocation,
            });

            updatePayload.activeShiftId = null;
        }

        const updatedDriver = await EnterpriseDriver.findOneAndUpdate(
            {
                _id: id,
                active: true,
            },
            updatePayload,
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Estado actualizado correctamente.',
            driver: updatedDriver,
        });
    } catch (error) {
        console.error('Error en updateDriverStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar el estado.',
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

module.exports.getDriverRouteSummary = async (req, res) => {
    try {
        const { id } = req.params;

        const date = String(req.query.date || '').trim();
        const from = normalizeTimeValue(req.query.from, '00:00');
        const to = normalizeTimeValue(req.query.to, '23:59');

        if (!req.enterprise?._id) {
            return res.status(401).json({
                success: false,
                message: 'Empresa no autorizada.',
            });
        }

        const driver = await EnterpriseDriver.findOne({
            _id: id,
            enterprise: req.enterprise._id,
            active: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado para esta empresa.',
            });
        }

        /*
         * Zona horaria correcta para Colombia.
         * Antes se usaba T00:00:00.000Z, que consulta en UTC.
         * En Colombia, desde las 7:00 p. m. ya puede existir diferencia de día
         * contra UTC. Eso podía dejar el recorrido vacío.
         */
        const selectedDate = date || getBogotaDateString();

        const startDate = new Date(`${selectedDate}T${from}:00.000-05:00`);
        const endDate = new Date(`${selectedDate}T${to}:59.999-05:00`);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Fecha u horas inválidas para consultar el recorrido.',
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'La hora inicial no puede ser mayor que la hora final.',
            });
        }

        /*
         * Consulta robusta:
         * Ya no dependemos solamente de que la jornada startedAt caiga en ese día.
         * Buscamos directamente los puntos GPS por recordedAt.
         */
        const routePoints = await EnterpriseDriverRoutePoint.find({
            enterprise: req.enterprise._id,
            driverId: driver._id,
            recordedAt: {
                $gte: startDate,
                $lte: endDate,
            },
        }).sort({ recordedAt: 1 });

        const shiftIds = [
            ...new Set(
                routePoints
                    .map((point) => String(point.shiftId || ''))
                    .filter(Boolean)
            ),
        ];

        const shifts = shiftIds.length
            ? await EnterpriseDriverShift.find({
                  _id: { $in: shiftIds },
                  enterprise: req.enterprise._id,
                  driverId: driver._id,
              }).sort({ startedAt: -1 })
            : [];

        const shift =
            shifts[0] ||
            (await EnterpriseDriverShift.findOne({
                enterprise: req.enterprise._id,
                driverId: driver._id,
                $or: [
                    {
                        startedAt: {
                            $gte: startDate,
                            $lte: endDate,
                        },
                    },
                    {
                        endedAt: {
                            $gte: startDate,
                            $lte: endDate,
                        },
                    },
                    {
                        startedAt: { $lte: startDate },
                        $or: [
                            { endedAt: null },
                            { endedAt: { $gte: startDate } },
                        ],
                    },
                ],
            }).sort({ startedAt: -1 }));

        const deliveries = await EnterpriseDelivery.find({
            enterprise: req.enterprise._id,
            assignedDriverId: driver._id,
            $or: [
                { createdAt: { $gte: startDate, $lte: endDate } },
                { startedAt: { $gte: startDate, $lte: endDate } },
                { finishedAt: { $gte: startDate, $lte: endDate } },
            ],
        }).sort({ createdAt: -1 });

        const finishedDeliveries = deliveries.filter(
            (d) => d.status === 'Finalizada' && d.startedAt && d.finishedAt
        );

        const realDurationsSeconds = finishedDeliveries.map((d) => {
            const started = new Date(d.startedAt).getTime();
            const finished = new Date(d.finishedAt).getTime();

            return Math.max(0, Math.round((finished - started) / 1000));
        });

        const avgRealDurationSeconds =
            realDurationsSeconds.length > 0
                ? Math.round(
                      realDurationsSeconds.reduce((sum, val) => sum + val, 0) /
                          realDurationsSeconds.length
                  )
                : 0;

        let calculatedDistanceKm = 0;

        for (let i = 1; i < routePoints.length; i += 1) {
            const previous = routePoints[i - 1];
            const current = routePoints[i];

            if (
                isValidCoordinate(previous.lat, previous.lng) &&
                isValidCoordinate(current.lat, current.lng)
            ) {
                calculatedDistanceKm += haversineDistanceKm(
                    { lat: previous.lat, lng: previous.lng },
                    { lat: current.lat, lng: current.lng }
                );
            }
        }

        const firstPoint = routePoints[0] || null;
        const lastPoint = routePoints[routePoints.length - 1] || null;

        const shiftDurationSeconds =
            firstPoint && lastPoint
                ? Math.max(
                      0,
                      Math.round(
                          (new Date(lastPoint.recordedAt).getTime() -
                              new Date(firstPoint.recordedAt).getTime()) /
                              1000
                      )
                  )
                : shift?.startedAt
                ? Math.max(
                      0,
                      Math.round(
                          (
                              (shift.endedAt
                                  ? new Date(shift.endedAt)
                                  : new Date()
                              ).getTime() -
                              new Date(shift.startedAt).getTime()
                          ) / 1000
                      )
                  )
                : 0;

        return res.status(200).json({
            success: true,
            driver: {
                _id: driver._id,
                id: driver._id,
                name: driver.name,
                cedula: driver.cedula,
                vehicle: driver.vehicle,
                plate: driver.plate,
                status: driver.status,
                currentLocation: driver.currentLocation || null,
            },
            summary: {
                date: selectedDate,
                from,
                to,
                timezone: 'America/Bogota',
                queryRange: {
                    startDate,
                    endDate,
                },
                shift: shift
                    ? {
                          _id: shift._id,
                          status: shift.status,
                          startedAt: shift.startedAt,
                          endedAt: shift.endedAt,
                          startedLocation: shift.startedLocation || null,
                          endedLocation: shift.endedLocation || null,
                          totalPoints: routePoints.length,
                          totalDistanceKm: Number(
                              calculatedDistanceKm.toFixed(4)
                          ),
                          shiftDurationSeconds,
                      }
                    : routePoints.length
                    ? {
                          _id: null,
                          status: 'Con puntos GPS sin jornada encontrada',
                          startedAt: firstPoint?.recordedAt || null,
                          endedAt: lastPoint?.recordedAt || null,
                          startedLocation: firstPoint
                              ? {
                                    lat: firstPoint.lat,
                                    lng: firstPoint.lng,
                                }
                              : null,
                          endedLocation: lastPoint
                              ? {
                                    lat: lastPoint.lat,
                                    lng: lastPoint.lng,
                                }
                              : null,
                          totalPoints: routePoints.length,
                          totalDistanceKm: Number(
                              calculatedDistanceKm.toFixed(4)
                          ),
                          shiftDurationSeconds,
                      }
                    : null,
                deliveries: {
                    total: deliveries.length,
                    finished: finishedDeliveries.length,
                    avgRealDurationSeconds,
                },
                routePoints,
                deliveryItems: deliveries,
            },
        });
    } catch (error) {
        console.error('Error en getDriverRouteSummary:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo obtener el resumen de ruta del conductor.',
        });
    }
};