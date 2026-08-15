const captainModel = require("../models/captain.model");
const captainSerivce = require("../services/captain.service");
const DriverApplication = require("../models/driverApplication.model");
const { validationResult } = require("express-validator");
const blacklistTokenModel = require("../models/blacklistToken.model");

const VALID_PUSH_PLATFORMS = ["web", "android", "ios", "unknown"];

const VALID_VEHICLE_TYPES = [
    "motorcycle",
    "car",
    "motocarro",
    "pickup",
    "van",
    "light_truck",
    "medium_truck",
    "heavy_truck",
    "simple_truck",
    "double_troque",
    "dump_truck",
    "mini_trailer",
    "tractor_trailer",
    "lowboy",
    "special_vehicle",
];

const VALID_BODY_TYPES = [
    "not_specified",
    "closed_van",
    "stakes",
    "platform",
    "refrigerated",
    "dump",
    "tank",
    "container_carrier",
    "lowboy",
    "open_body",
    "other",
];

const VALID_CAPACITY_UNITS = ["kg", "ton"];


function normalizePushPlatform(platform) {
    const value = String(platform || "unknown").trim().toLowerCase();

    if (VALID_PUSH_PLATFORMS.includes(value)) {
        return value;
    }

    return "unknown";
}

function cleanString(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

/**
 * Convierte cualquier valor a número seguro
 */
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizeCapacityUnit(value) {
    const unit = cleanString(value, 10).toLowerCase();

    if (VALID_CAPACITY_UNITS.includes(unit)) {
        return unit;
    }

    return "kg";
}

function capacityToKg(capacity, unit) {
    const numericCapacity = toNumber(capacity, 0);
    const normalizedUnit = normalizeCapacityUnit(unit);

    if (numericCapacity <= 0) {
        return 0;
    }

    return normalizedUnit === "ton"
        ? numericCapacity * 1000
        : numericCapacity;
}

function normalizeDocumentPair(documentValue = {}) {
    return {
        front: cleanString(documentValue?.front, 10_000_000),
        back: cleanString(documentValue?.back, 10_000_000),
    };
}

/**
 * Convierte milisegundos a horas con 2 decimales
 */
function msToHours(ms = 0) {
    const hours = ms / (1000 * 60 * 60);
    return Number(hours.toFixed(2));
}

/**
 * Distancia entre dos puntos en metros
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Arma la respuesta del captain para el frontend
 * sin exponer password y dejando stats listas para el panel.
 */
function buildCaptainResponse(captainDoc) {
    if (!captainDoc) return null;

    const captain = captainDoc.toObject ? captainDoc.toObject() : captainDoc;

    return {
        _id: captain._id,
        fullname: {
            firstname: captain?.fullname?.firstname || "",
            lastname: captain?.fullname?.lastname || "",
        },
        email: captain.email || "",
        socketId: captain.socketId || "",
        status: captain.status || "inactive",
        identification: {
            number: captain?.identification?.number || "",
            type: captain?.identification?.type || "CC",
        },

        verification: {
            status:
                captain?.verification?.status ||
                "pending",
            reviewedAt:
                captain?.verification?.reviewedAt ||
                null,
            notes:
                captain?.verification?.notes ||
                "",
        },

        vehicle: {
            color: captain?.vehicle?.color || "",
            plate: captain?.vehicle?.plate || "",
            brand: captain?.vehicle?.brand || "",
            reference: captain?.vehicle?.reference || "",
            model: captain?.vehicle?.model || "",
            capacity: captain?.vehicle?.capacity || 0,
            capacityUnit:
                captain?.vehicle?.capacityUnit ||
                "kg",
            capacityKg:
                captain?.vehicle?.capacityKg ||
                captain?.vehicle?.capacity ||
                0,
            vehicleType:
                captain?.vehicle?.vehicleType ||
                "",
            bodyType:
                captain?.vehicle?.bodyType ||
                "not_specified",
            axleCount:
                captain?.vehicle?.axleCount ||
                null,
        },

        profileImage:
            captain.profileImage ||
            captain.photo ||
            captain.avatar ||
            captain.image ||
            "",

        rating: toNumber(
            captain.rating ??
                captain.avgRating ??
                captain.stars ??
                5
        ),

        location: {
            ltd: toNumber(captain?.location?.ltd, 0),
            lng: toNumber(captain?.location?.lng, 0),
        },

        onlineSession: {
            isOnline: Boolean(captain?.onlineSession?.isOnline),
            sessionStartedAt: captain?.onlineSession?.sessionStartedAt || null,
            startedAt: captain?.onlineSession?.startedAt || null,
            lastSeenAt: captain?.onlineSession?.lastSeenAt || null,
        },

        stats: {
            hoursOnline: toNumber(
                captain?.stats?.hoursOnline ??
                    captain?.hoursOnline ??
                    0
            ),
            totalDistanceKm: toNumber(
                captain?.stats?.totalDistanceKm ??
                    captain?.totalDistanceKm ??
                    captain?.distanceKm ??
                    0
            ),
            totalEarning: toNumber(
                captain?.stats?.totalEarning ??
                    captain?.totalEarning ??
                    captain?.earnings ??
                    0
            ),
            cashCollected: toNumber(
                captain?.stats?.cashCollected ??
                    captain?.cashCollected ??
                    captain?.cash ??
                    0
            ),
            transferCollected: toNumber(
                captain?.stats?.transferCollected ??
                    captain?.transferCollected ??
                    captain?.transfer ??
                    0
            ),
            totalTrips: toNumber(
                captain?.stats?.totalTrips ??
                    captain?.totalTrips ??
                    captain?.completedTrips ??
                    0
            ),
            pendingToSettle: toNumber(
                captain?.stats?.pendingToSettle ??
                    captain?.pendingToSettle ??
                    0
            ),
        },
    };
}

/**
 * NUEVO FLUJO:
 * El registro del conductor ya NO crea un captain activo.
 * Ahora crea una solicitud pendiente para revisión del Super Admin.
 */
module.exports.registerCaptain = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            fullname,
            email,
            password,
            identification,
            vehicle,
            documents,
        } = req.body;

        const cleanEmail = String(email || "").trim().toLowerCase();
        const plate = String(vehicle?.plate || "").trim().toUpperCase();

        const identificationNumber =
            cleanString(
                identification?.number,
                40
            );

        const identificationType =
            cleanString(
                identification?.type || "CC",
                20
            ).toUpperCase();

        const capacityUnit =
            normalizeCapacityUnit(
                vehicle?.capacityUnit
            );

        const capacity =
            toNumber(
                vehicle?.capacity,
                0
            );

        const capacityKg =
            capacityToKg(
                capacity,
                capacityUnit
            );

        const bodyType =
            VALID_BODY_TYPES.includes(
                vehicle?.bodyType
            )
                ? vehicle.bodyType
                : "not_specified";

        const identificationCard =
            normalizeDocumentPair(
                documents?.identificationCard
            );

        const drivingLicense =
            normalizeDocumentPair(
                documents?.drivingLicense
            );

        const vehicleRegistration =
            normalizeDocumentPair(
                documents?.vehicleRegistration
            );

        /*
         * Compatibilidad con el formulario anterior:
         * acepta los campos antiguos de una sola imagen.
         */
        if (
            !drivingLicense.front &&
            documents?.drivingLicenseImage
        ) {
            drivingLicense.front =
                cleanString(
                    documents.drivingLicenseImage,
                    10_000_000
                );
        }

        if (
            !vehicleRegistration.front &&
            documents?.vehicleRegistrationImage
        ) {
            vehicleRegistration.front =
                cleanString(
                    documents.vehicleRegistrationImage,
                    10_000_000
                );
        }

        if (!fullname?.firstname || String(fullname.firstname).trim().length < 3) {
            return res.status(400).json({
                message: "El nombre debe tener mínimo 3 caracteres.",
            });
        }

        if (!cleanEmail) {
            return res.status(400).json({
                message: "El correo es obligatorio.",
            });
        }

        if (!password || String(password).length < 6) {
            return res.status(400).json({
                message: "La contraseña debe tener mínimo 6 caracteres.",
            });
        }

        if (!vehicle?.color || String(vehicle.color).trim().length < 3) {
            return res.status(400).json({
                message: "El color del vehículo es obligatorio.",
            });
        }

        if (!plate || plate.length < 3) {
            return res.status(400).json({
                message: "La placa del vehículo es obligatoria.",
            });
        }

        if (capacity <= 0 || capacityKg <= 0) {
            return res.status(400).json({
                message:
                    "La capacidad del vehículo debe ser válida.",
            });
        }

        if (
            !identificationNumber ||
            identificationNumber.length < 5
        ) {
            return res.status(400).json({
                message:
                    "El número de identificación es obligatorio.",
            });
        }

        if (!VALID_VEHICLE_TYPES.includes(vehicle?.vehicleType)) {
            return res.status(400).json({
                message: "El tipo de vehículo no es válido.",
            });
        }

        if (
            !identificationCard.front ||
            !identificationCard.back
        ) {
            return res.status(400).json({
                message:
                    "Debes subir la cédula por delante y por detrás.",
            });
        }

        if (
            !drivingLicense.front ||
            !drivingLicense.back
        ) {
            return res.status(400).json({
                message:
                    "Debes subir la licencia de conducción por delante y por detrás.",
            });
        }

        if (
            !vehicleRegistration.front ||
            !vehicleRegistration.back
        ) {
            return res.status(400).json({
                message:
                    "Debes subir la tarjeta de propiedad por delante y por detrás.",
            });
        }

        const existingCaptain = await captainModel.findOne({
            email: cleanEmail,
        });

        if (existingCaptain) {
            return res.status(400).json({
                message: "Ya existe un conductor registrado con ese correo.",
            });
        }

        const existingIdentificationCaptain =
            await captainModel.findOne({
                "identification.number":
                    identificationNumber,
            });

        if (existingIdentificationCaptain) {
            return res.status(400).json({
                message:
                    "Ya existe un conductor registrado con ese número de identificación.",
            });
        }

        const existingPlateCaptain = await captainModel.findOne({
            "vehicle.plate": plate,
        });

        if (existingPlateCaptain) {
            return res.status(400).json({
                message: "Ya existe un conductor registrado con esa placa.",
            });
        }

        const existingPendingApplication = await DriverApplication.findOne({
            $or: [
                { email: cleanEmail },
                { "vehicle.plate": plate },
                {
                    "identification.number":
                        identificationNumber,
                },
            ],
            status: "pending",
        });

        if (existingPendingApplication) {
            return res.status(409).json({
                message: "Ya existe una solicitud pendiente con ese correo o esa placa.",
            });
        }

        const hashedPassword = await captainModel.hashPassword(password);

        const application = await DriverApplication.create({
            fullname: {
                firstname:
                    String(
                        fullname.firstname ||
                            ""
                    ).trim(),
                lastname:
                    String(
                        fullname.lastname ||
                            ""
                    ).trim(),
            },

            email: cleanEmail,
            password: hashedPassword,

            identification: {
                number:
                    identificationNumber,
                type:
                    identificationType,
            },

            vehicle: {
                color:
                    cleanString(
                        vehicle.color,
                        80
                    ),
                plate,
                brand:
                    cleanString(
                        vehicle?.brand,
                        80
                    ),
                reference:
                    cleanString(
                        vehicle?.reference,
                        80
                    ),
                model:
                    cleanString(
                        vehicle?.model,
                        40
                    ),
                capacity,
                capacityUnit,
                capacityKg,
                vehicleType:
                    vehicle.vehicleType,
                bodyType,
                axleCount:
                    toNumber(
                        vehicle?.axleCount,
                        0
                    ) || null,
                photo:
                    cleanString(
                        vehicle?.photo,
                        10_000_000
                    ),
            },

            documents: {
                identificationCard: {
                    front:
                        identificationCard.front,
                    back:
                        identificationCard.back,
                },
                drivingLicense: {
                    front:
                        drivingLicense.front,
                    back:
                        drivingLicense.back,
                },
                vehicleRegistration: {
                    front:
                        vehicleRegistration.front,
                    back:
                        vehicleRegistration.back,
                },
            },

            status: "pending",
        });

        return res.status(201).json({
            success: true,
            message: "Solicitud enviada correctamente. Un administrador revisará tus documentos.",
            application: {
                _id: application._id,
                id: application._id,
                status: application.status,
                email: application.email,
                identification: {
                    type:
                        application?.identification?.type ||
                        identificationType,
                },
                vehicle: application.vehicle,
                documentsReceived: {
                    identificationCard: true,
                    drivingLicense: true,
                    vehicleRegistration: true,
                },
                createdAt: application.createdAt,
            },
        });
    } catch (error) {
        console.error("registerCaptain application error:", error);

        return res.status(500).json({
            message: "No se pudo enviar la solicitud del conductor.",
            error: error.message,
        });
    }
};

module.exports.loginCaptain = async (req, res, next) => {
    const { email, password } = req.body;
    const error = validationResult(req);

    if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
    }

    try {
        const cleanEmail = String(email || "").trim().toLowerCase();

        const captain = await captainModel.findOne({ email: cleanEmail }).select("+password");

        if (!captain) {
            const pendingApplication = await DriverApplication.findOne({
                email: cleanEmail,
                status: "pending",
            });

            const rejectedApplication = await DriverApplication.findOne({
                email: cleanEmail,
                status: "rejected",
            }).sort({ updatedAt: -1 });

            if (pendingApplication) {
                return res.status(403).json({
                    message: "Tu solicitud como conductor aún está pendiente de revisión.",
                    status: "pending_application",
                });
            }

            if (rejectedApplication) {
                return res.status(403).json({
                    message: rejectedApplication.rejectionReason
                        ? `Tu solicitud fue rechazada. Motivo: ${rejectedApplication.rejectionReason}`
                        : "Tu solicitud como conductor fue rechazada.",
                    status: "rejected_application",
                });
            }

            return res.status(404).json({ message: "Captain not found" });
        }

        const isMatch = await captain.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        if (captain.status !== "active") {
            return res.status(403).json({
                message: "Tu cuenta de conductor no está activa.",
            });
        }

        const now = new Date();

        captain.onlineSession = {
            ...(captain.onlineSession || {}),
            isOnline: true,
            sessionStartedAt: now,
            startedAt: captain.onlineSession?.startedAt || now,
            lastSeenAt: now,
        };

        await captain.save();

        const token = captain.generateAuthToken();

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        return res.status(200).json({
            token,
            captain: buildCaptainResponse(captain),
        });
    } catch (err) {
        console.error("loginCaptain error:", err);
        return res.status(500).json({
            message: "Error logging in captain",
            error: err.message,
        });
    }
};

module.exports.getCaptainProfile = async (req, res, next) => {
    try {
        if (req.captain?._id) {
            await captainModel.findByIdAndUpdate(req.captain._id, {
                $set: {
                    "onlineSession.lastSeenAt": new Date(),
                },
            });

            const freshCaptain = await captainModel.findById(req.captain._id);
            return res.status(200).json({
                captain: buildCaptainResponse(freshCaptain),
            });
        }

        return res.status(200).json({
            captain: buildCaptainResponse(req.captain),
        });
    } catch (err) {
        console.error("getCaptainProfile error:", err);
        return res.status(500).json({
            message: "Error getting captain profile",
            error: err.message,
        });
    }
};

module.exports.logoutCaptain = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

        if (req.captain?._id) {
            const freshCaptain = await captainModel.findById(req.captain._id);

            if (freshCaptain) {
                const sessionStartedAt = freshCaptain?.onlineSession?.sessionStartedAt
                    ? new Date(freshCaptain.onlineSession.sessionStartedAt)
                    : null;

                const now = new Date();

                let additionalHours = 0;

                if (sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())) {
                    const diffMs = Math.max(0, now.getTime() - sessionStartedAt.getTime());
                    additionalHours = msToHours(diffMs);
                }

                await captainModel.findByIdAndUpdate(freshCaptain._id, {
                    $inc: {
                        "stats.hoursOnline": additionalHours,
                    },
                    $set: {
                        "onlineSession.isOnline": false,
                        "onlineSession.lastSeenAt": now,
                    },
                    $unset: {
                        "onlineSession.sessionStartedAt": 1,
                    },
                });
            }
        }

        if (token) {
            const blackToken = await blacklistTokenModel.create({ token });
            await blackToken.save();
        }

        res.clearCookie("token");

        return res.status(200).json({ message: "Logged out" });
    } catch (err) {
        console.error("logoutCaptain error:", err);
        return res.status(500).json({
            message: "Error logging out",
            error: err.message,
        });
    }
};

module.exports.getNearbyCaptains = async (req, res) => {
    try {
        const lat = toNumber(req.query.lat, NaN);
        const lng = toNumber(req.query.lng, NaN);
        const radiusKm = Math.max(toNumber(req.query.radiusKm, 8), 1);
        const radiusM = radiusKm * 1000;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({
                message: "Latitud y longitud inválidas.",
            });
        }

        const captains = await captainModel.find({
            status: "active",
            socketId: { $exists: true, $ne: null },
            "location.ltd": { $exists: true, $ne: null },
            "location.lng": { $exists: true, $ne: null },
        });

        const nearbyCaptains = captains
            .map((captain) => {
                const captainLat = toNumber(captain?.location?.ltd, NaN);
                const captainLng = toNumber(captain?.location?.lng, NaN);

                if (!Number.isFinite(captainLat) || !Number.isFinite(captainLng)) {
                    return null;
                }

                const distanceMeters = haversineMeters(
                    lat,
                    lng,
                    captainLat,
                    captainLng
                );

                if (!Number.isFinite(distanceMeters) || distanceMeters > radiusM) {
                    return null;
                }

                return {
                    _id: captain._id,
                    captainId: captain._id,
                    name:
                        `${captain?.fullname?.firstname || ""} ${captain?.fullname?.lastname || ""}`.trim() ||
                        captain?.name ||
                        "Conductor activo",
                    socketId: captain.socketId || "",
                    status: captain.status || "active",
                    vehicleType:
                        captain?.vehicle?.vehicleType ||
                        captain?.vehicleType ||
                        "car",
                    location: {
                        ltd: captainLat,
                        lng: captainLng,
                    },
                    distanceMeters: Math.round(distanceMeters),
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceMeters - b.distanceMeters);

        return res.status(200).json({
            captains: nearbyCaptains,
        });
    } catch (err) {
        console.error("getNearbyCaptains error:", err);
        return res.status(500).json({
            message: "Error obteniendo conductores cercanos",
            error: err.message,
        });
    }
};

/**
 * Guarda el token FCM del conductor.
 * Este token permite enviarle notificaciones cuando reciba ofertas
 * de mercancía, espacio, cupos o eventos importantes estando fuera de la app.
 */
module.exports.registerPushToken = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        const token = cleanString(req.body.token, 4096);
        const platform = normalizePushPlatform(req.body.platform);
        const deviceId = cleanString(req.body.deviceId, 250);
        const userAgent = cleanString(
            req.body.userAgent || req.headers["user-agent"],
            500
        );

        if (!token) {
            return res.status(400).json({
                message: "Token push requerido.",
            });
        }

        const captain = await captainModel.findById(captainId);

        if (!captain) {
            return res.status(404).json({
                message: "Conductor no encontrado.",
            });
        }

        const tokens = Array.isArray(captain.fcmTokens)
            ? captain.fcmTokens
            : [];

        const existingIndex = tokens.findIndex(
            (item) => String(item?.token || "") === token
        );

        const tokenPayload = {
            token,
            platform,
            deviceId,
            userAgent,
            active: true,
            lastUsedAt: new Date(),
        };

        if (existingIndex >= 0) {
            captain.fcmTokens[existingIndex] = {
                ...captain.fcmTokens[existingIndex],
                ...tokenPayload,
                createdAt:
                    captain.fcmTokens[existingIndex]?.createdAt || new Date(),
            };
        } else {
            captain.fcmTokens.push({
                ...tokenPayload,
                createdAt: new Date(),
            });
        }

        captain.fcmTokens = captain.fcmTokens
            .filter((item) => item?.token)
            .sort((a, b) => {
                const aTime = new Date(a.lastUsedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.lastUsedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, 10);

        await captain.save();

        return res.status(200).json({
            ok: true,
            message: "Token push del conductor registrado correctamente.",
            tokensCount: captain.fcmTokens.length,
        });
    } catch (error) {
        console.error("[captain.registerPushToken] error:", error);

        return res.status(500).json({
            message: error.message || "Error registrando token push.",
        });
    }
};

/**
 * Desactiva token push del conductor.
 */
module.exports.unregisterPushToken = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        const token = cleanString(req.body.token, 4096);

        if (!token) {
            return res.status(400).json({
                message: "Token push requerido.",
            });
        }

        await captainModel.updateOne(
            {
                _id: captainId,
                "fcmTokens.token": token,
            },
            {
                $set: {
                    "fcmTokens.$.active": false,
                    "fcmTokens.$.lastUsedAt": new Date(),
                },
            }
        );

        return res.status(200).json({
            ok: true,
            message: "Token push del conductor desactivado correctamente.",
        });
    } catch (error) {
        console.error("[captain.unregisterPushToken] error:", error);

        return res.status(500).json({
            message: error.message || "Error desactivando token push.",
        });
    }
};