const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const captainModel = require("../models/captain.model");
const userModel = require("../models/user.model");
const { mapsErrorStatus } = require("../utils/mapsHttpStatus");
const walletService = require("../services/wallet.service");

/**
 * HOTFIX ANTI-COBRO GOOGLE:
 *
 * El consumo alto vino por solicitudes duplicadas a Geocoding API.
 * La función más peligrosa era getAvailableForCaptain porque el frontend
 * la consulta cada pocos segundos y antes geocodificaba pickup/destination
 * dentro de un loop.
 *
 * Con este archivo:
 * - NO se geocodifica dentro de getAvailableForCaptain.
 * - Se siguen mostrando solicitudes disponibles.
 * - Temporalmente puede aparecer "-- km de ti".
 * - Se evita quemar solicitudes duplicadas de Geocoding.
 */

function safeId(value) {
    try {
        return value ? String(value) : null;
    } catch {
        return null;
    }
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function isValidLatitude(lat) {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
    return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function isValidLatLng(lat, lng) {
    return isValidLatitude(lat) && isValidLongitude(lng);
}

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

function kmText(meters) {
    if (!Number.isFinite(meters)) return null;
    return `${(meters / 1000).toFixed(2)} km`;
}

function normalizeDistanceToKm(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return null;
    }

    if (number > 300) {
        return Number((number / 1000).toFixed(2));
    }

    return Number(number.toFixed(2));
}

function normalizePaymentMethod(ride) {
    const raw = String(
        ride?.paymentMethod ||
            ride?.paymentType ||
            ride?.payment_method ||
            ride?.method ||
            ride?.payment ||
            ""
    )
        .trim()
        .toLowerCase();

    if (
        raw.includes("cash") ||
        raw.includes("efectivo") ||
        raw.includes("contado")
    ) {
        return "cash";
    }

    if (
        raw.includes("transfer") ||
        raw.includes("nequi") ||
        raw.includes("bancolombia") ||
        raw.includes("daviplata") ||
        raw.includes("digital") ||
        raw.includes("tarjeta")
    ) {
        return "transfer";
    }

    return "unknown";
}

function emitToUser(userLike, payload) {
    const socketId = userLike?.socketId || null;
    if (!socketId) return false;
    return sendMessageToSocketId(socketId, payload);
}

function emitToCaptain(captainLike, payload) {
    const socketId = captainLike?.socketId || null;
    if (!socketId) return false;
    return sendMessageToSocketId(socketId, payload);
}

function ridePayloadWithActiveOffers(rideDoc) {
    const rideObject =
        typeof rideDoc?.toObject === "function" ? rideDoc.toObject() : rideDoc;

    return {
        ...rideObject,
        activeDriverOffers: rideService
            .getActiveDriverOffers(rideDoc)
            .map((offer) =>
                typeof offer?.toObject === "function" ? offer.toObject() : offer
            ),
    };
}

function normalizeOffer(offer) {
    if (!offer) return offer;
    return typeof offer.toObject === "function" ? offer.toObject() : { ...offer };
}

function normalizeRating(value) {
    const rating = Number(value);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return null;
    }

    return rating;
}

function cleanComment(value) {
    return String(value || "").trim().slice(0, 500);
}

async function recalculateCaptainRating(captainId) {
    if (!captainId) {
        return {
            rating: 5,
            ratingCount: 0,
        };
    }

    const result = await rideModel.aggregate([
        {
            $match: {
                captain: captainId,
                status: "completed",
                cancelledAt: null,
                "userRatingToCaptain.rating": {
                    $gte: 1,
                    $lte: 5,
                },
            },
        },
        {
            $group: {
                _id: "$captain",
                rating: {
                    $avg: "$userRatingToCaptain.rating",
                },
                ratingCount: {
                    $sum: 1,
                },
            },
        },
    ]);

    const summary = result[0] || {
        rating: 5,
        ratingCount: 0,
    };

    const finalRating =
        summary.ratingCount > 0
            ? Number(Number(summary.rating).toFixed(2))
            : 5;

    const finalCount = Number(summary.ratingCount || 0);

    await captainModel.findByIdAndUpdate(
        captainId,
        {
            $set: {
                rating: finalRating,
                ratingCount: finalCount,
            },
        },
        {
            runValidators: true,
        }
    );

    return {
        rating: finalRating,
        ratingCount: finalCount,
    };
}

async function recalculateUserRating(userId) {
    if (!userId) {
        return {
            rating: 5,
            ratingCount: 0,
        };
    }

    const result = await rideModel.aggregate([
        {
            $match: {
                user: userId,
                status: "completed",
                cancelledAt: null,
                "captainRatingToUser.rating": {
                    $gte: 1,
                    $lte: 5,
                },
            },
        },
        {
            $group: {
                _id: "$user",
                rating: {
                    $avg: "$captainRatingToUser.rating",
                },
                ratingCount: {
                    $sum: 1,
                },
            },
        },
    ]);

    const summary = result[0] || {
        rating: 5,
        ratingCount: 0,
    };

    const finalRating =
        summary.ratingCount > 0
            ? Number(Number(summary.rating).toFixed(2))
            : 5;

    const finalCount = Number(summary.ratingCount || 0);

    await userModel.findByIdAndUpdate(
        userId,
        {
            $set: {
                rating: finalRating,
                ratingCount: finalCount,
            },
        },
        {
            runValidators: true,
        }
    );

    return {
        rating: finalRating,
        ratingCount: finalCount,
    };
}

function parseRouteStops(rawStops) {
    if (!rawStops) return [];

    if (Array.isArray(rawStops)) {
        return rawStops
            .map((stop) => String(stop || "").trim())
            .filter(Boolean);
    }

    return String(rawStops)
        .split("|")
        .map((stop) => stop.trim())
        .filter(Boolean);
}

function roundToHundred(value) {
    const number = Number(value) || 0;
    return Math.ceil(number / 100) * 100;
}

module.exports.createRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        pickup,
        destination,
        routeStops,
        vehicle,
        offeredFare,
        serviceType = "local_delivery",
        senderType = "personal",
        cargo = {},
        serviceTiming = "now",
        schedule = {},
    } = req.body;

    try {
        const ACTIVE_USER_RIDE_MAX_AGE_HOURS = 6;
        const activeSince = new Date(
            Date.now() - ACTIVE_USER_RIDE_MAX_AGE_HOURS * 60 * 60 * 1000
        );

        const requestedTiming =
            serviceTiming === "scheduled" ? "scheduled" : "now";

        /*
         * CENTRAL GO:
         * - Un usuario puede dejar varios domicilios PROGRAMADOS pendientes.
         * - Un programado pendiente tampoco bloquea un domicilio "Ahora".
         * - Sí bloqueamos si ya existe un servicio físicamente asignado/en curso.
         * - Para "Ahora", evitamos duplicar otra solicitud inmediata pendiente.
         */
        const blockingRideCondition =
            requestedTiming === "scheduled"
                ? {
                      status: {
                          $in: ["accepted", "arrived", "ongoing"],
                      },
                  }
                : {
                      $or: [
                          {
                              status: {
                                  $in: ["accepted", "arrived", "ongoing"],
                              },
                          },
                          {
                              status: {
                                  $in: ["pending", "negotiating"],
                              },
                              serviceTiming: { $ne: "scheduled" },
                          },
                      ],
                  };

        let existingActiveRide = await rideModel
            .findOne({
                user: req.user._id,
                cancelledAt: null,
                cancelledBy: null,
                updatedAt: {
                    $gte: activeSince,
                },
                ...blockingRideCondition,
            })
            .sort({ updatedAt: -1 })
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (existingActiveRide) {
            await rideService.expirePendingOffers(existingActiveRide);

            existingActiveRide = await rideModel
                .findById(existingActiveRide._id)
                .populate("user")
                .populate("captain")
                .populate(
                    "driverOffers.captain",
                    "fullname email vehicle socketId"
                );

            if (
                existingActiveRide &&
                [
                    "pending",
                    "negotiating",
                    "accepted",
                    "arrived",
                    "ongoing",
                ].includes(existingActiveRide.status) &&
                !existingActiveRide.cancelledAt &&
                !existingActiveRide.cancelledBy
            ) {
                return res.status(409).json({
                    message:
                        "Ya tienes una solicitud activa. Continúa con esa solicitud o cancélala antes de crear otra.",
                    code: "ACTIVE_RIDE_EXISTS",
                    ride: ridePayloadWithActiveOffers(existingActiveRide),
                });
            }
        }

        /*
         * Central GO - datos del domicilio/carga local.
         * Se normalizan antes de enviarlos al servicio para evitar
         * guardar valores inesperados desde el frontend.
         */
        const allowedSenderTypes = ["personal", "business"];
        const allowedCargoCategories = [
            "market",
            "boxes",
            "packages",
            "sacks",
            "baskets",
            "general_merchandise",
            "other",
        ];
        const allowedWeightUnits = ["kg", "lb"];

        const normalizedSenderType = allowedSenderTypes.includes(senderType)
            ? senderType
            : "personal";

        const normalizedCargoCategory = allowedCargoCategories.includes(cargo?.category)
            ? cargo.category
            : "packages";

        const normalizedQuantity = Math.max(
            1,
            Math.floor(Number(cargo?.quantity) || 1)
        );

        const normalizedWeightUnknown = Boolean(cargo?.weightUnknown);

        const rawWeight = Number(cargo?.approximateWeight);
        const normalizedApproximateWeight =
            normalizedWeightUnknown ||
            !Number.isFinite(rawWeight) ||
            rawWeight < 0
                ? null
                : rawWeight;

        const normalizedWeightUnit = allowedWeightUnits.includes(cargo?.weightUnit)
            ? cargo.weightUnit
            : "kg";

        const normalizedDescription = String(cargo?.description || "")
            .trim()
            .slice(0, 300);

        /*
         * Central GO - programación del servicio.
         * "now" conserva exactamente el flujo actual.
         * "scheduled" permite publicar hoy un servicio para una fecha futura.
         */
        const normalizedServiceTiming =
            serviceTiming === "scheduled" ? "scheduled" : "now";

        let normalizedSchedule = {
            pickupStartAt: null,
            pickupEndAt: null,
            timezone: "America/Bogota",
            notes: "",
        };

        if (normalizedServiceTiming === "scheduled") {
            const pickupStartAt = schedule?.pickupStartAt
                ? new Date(schedule.pickupStartAt)
                : null;

            const pickupEndAt = schedule?.pickupEndAt
                ? new Date(schedule.pickupEndAt)
                : null;

            if (
                !pickupStartAt ||
                Number.isNaN(pickupStartAt.getTime())
            ) {
                return res.status(400).json({
                    message:
                        "Debes seleccionar una fecha y hora válidas para la recogida programada.",
                    code: "INVALID_SCHEDULE_START",
                });
            }

            if (pickupStartAt.getTime() <= Date.now()) {
                return res.status(400).json({
                    message:
                        "La fecha programada debe ser posterior a la hora actual.",
                    code: "SCHEDULE_MUST_BE_FUTURE",
                });
            }

            if (
                pickupEndAt &&
                !Number.isNaN(pickupEndAt.getTime()) &&
                pickupEndAt.getTime() <= pickupStartAt.getTime()
            ) {
                return res.status(400).json({
                    message:
                        "La hora final de recogida debe ser posterior a la hora inicial.",
                    code: "INVALID_SCHEDULE_END",
                });
            }

            normalizedSchedule = {
                pickupStartAt,
                pickupEndAt:
                    pickupEndAt && !Number.isNaN(pickupEndAt.getTime())
                        ? pickupEndAt
                        : null,
                timezone: String(
                    schedule?.timezone || "America/Bogota"
                )
                    .trim()
                    .slice(0, 100),
                notes: String(schedule?.notes || "")
                    .trim()
                    .slice(0, 300),
            };
        }

        const ride = await rideService.createRide({
            user: req.user,
            pickup,
            destination,
            routeStops,
            vehicle,
            offeredFare,

            serviceType:
                serviceType === "local_delivery"
                    ? serviceType
                    : "local_delivery",

            senderType: normalizedSenderType,

            serviceTiming: normalizedServiceTiming,
            schedule: normalizedSchedule,

            cargo: {
                category: normalizedCargoCategory,
                quantity: normalizedQuantity,
                approximateWeight: normalizedApproximateWeight,
                weightUnit: normalizedWeightUnit,
                weightUnknown: normalizedWeightUnknown,
                description: normalizedDescription,
            },
        });

        await rideModel.updateOne(
            { _id: ride._id },
            {
                $set: {
                    status: "pending",
                    negotiationStatus: "open",
                    cancelledAt: null,
                    cancelledBy: null,
                    cancelReason: "",
                    cancelNotes: "",
                    captain: null,
                    selectedOfferCaptain: null,
                },
            }
        );

        /*
         * Esta llamada se mantiene porque crear un viaje requiere ubicar el punto
         * de recogida para notificar conductores cercanos.
         *
         * La emergencia fuerte estaba en getAvailableForCaptain, que se ejecuta
         * muchas veces automáticamente y geocodificaba en loop.
         */
        const pickupCoordinates = await mapService.getAddressCoordinates(pickup);

        if (
            !pickupCoordinates ||
            !Number.isFinite(pickupCoordinates.ltd) ||
            !Number.isFinite(pickupCoordinates.lng)
        ) {
            await rideModel.updateOne(
                { _id: ride._id },
                {
                    $set: {
                        status: "cancelled",
                        negotiationStatus: "closed",
                        cancelledBy: "system",
                        cancelReason:
                            "No se pudo determinar la ubicación de recogida.",
                        cancelledAt: new Date(),
                    },
                }
            );

            return res.status(500).json({
                message: "No se pudo determinar la ubicación de recogida.",
            });
        }

        const SEARCH_RADIUS_KM = 15;

        const captainsInRadius = await mapService.getCaptainsInTheRadius(
            pickupCoordinates.ltd,
            pickupCoordinates.lng,
            SEARCH_RADIUS_KM
        );

        const allActiveCaptains = await captainModel.find({
            status: "active",
        });

        const allActiveDiagnostic = (allActiveCaptains || []).map((captain) => {
            const captainId = safeId(captain?._id);
            const socketId = captain?.socketId || null;
            const captainLtd = toNumber(captain?.location?.ltd);
            const captainLng = toNumber(captain?.location?.lng);

            const connected = !!socketId;
            const hasValidLocation = isValidLatLng(captainLtd, captainLng);

            let distanceMeters = null;
            let distanceKm = null;
            let insideRadius = false;
            let discardReason = null;

            if (!connected) {
                discardReason = "not_connected";
            } else if (!hasValidLocation) {
                discardReason = "invalid_or_missing_location";
            } else {
                distanceMeters = haversineMeters(
                    pickupCoordinates.ltd,
                    pickupCoordinates.lng,
                    captainLtd,
                    captainLng
                );

                distanceKm = kmText(distanceMeters);

                insideRadius = Number.isFinite(distanceMeters)
                    ? distanceMeters <= SEARCH_RADIUS_KM * 1000
                    : false;

                if (!insideRadius) {
                    discardReason = "outside_radius";
                }
            }

            return {
                captainId,
                connected,
                socketId,
                status: captain?.status || null,
                captainLtd: Number.isFinite(captainLtd) ? captainLtd : null,
                captainLng: Number.isFinite(captainLng) ? captainLng : null,
                hasValidLocation,
                distanceMeters: Number.isFinite(distanceMeters)
                    ? Math.round(distanceMeters)
                    : null,
                distanceKm,
                insideRadius,
                discardReason,
            };
        });

        const rideWithUser = await rideModel
            .findOne({ _id: ride._id })
            .populate("user")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!rideWithUser) {
            return res.status(500).json({
                message: "No se pudo cargar la solicitud recién creada.",
            });
        }

        console.log(
            "[createRide] captainsInRadius:",
            (captainsInRadius || []).map((captain) => ({
                captainId: String(captain?._id || ""),
                socketId: captain?.socketId || null,
                status: captain?.status || null,
            }))
        );

        let emittedCount = 0;

        for (const captain of captainsInRadius || []) {
            const socketId = captain?.socketId || null;
            if (!socketId) continue;

            const sent = sendMessageToSocketId(socketId, {
                event: "new-ride",
                data: rideWithUser,
            });

            console.log("[createRide] notify captain:", {
                captainId: String(captain?._id || ""),
                socketId,
                sent,
            });

            if (sent) emittedCount += 1;
        }

        if ((captainsInRadius || []).length === 0) {
            return res.status(201).json({
                ...rideWithUser.toObject(),
                warning:
                    "Solicitud creada. No hay conductores cerca en este momento, pero la búsqueda sigue activa.",
                code: "NO_CAPTAINS_NEARBY_BUT_RIDE_ACTIVE",
                emittedCount: 0,
                pickupCoordinates,
                radiusKm: SEARCH_RADIUS_KM,
                activeCaptainsDiagnostic: allActiveDiagnostic,
            });
        }

        if ((captainsInRadius || []).length > 0 && emittedCount === 0) {
            return res.status(201).json({
                ...rideWithUser.toObject(),
                warning:
                    "Se encontraron conductores, pero no fue posible notificarlos en tiempo real.",
                code: "CAPTAINS_FOUND_BUT_NOT_NOTIFIED",
                emittedCount,
            });
        }

        return res.status(201).json({
            ...rideWithUser.toObject(),
            emittedCount,
        });
    } catch (err) {
        const status =
            typeof mapsErrorStatus === "function" ? mapsErrorStatus(err) : null;

        if (status) {
            return res.status(status).json({ message: err.message });
        }

        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.getFare = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, stops } = req.query;
    const routeStops = parseRouteStops(stops);

    try {
        const fare = await rideService.getFare(pickup, destination, routeStops);
        return res.status(200).json(fare);
    } catch (err) {
        const status =
            typeof mapsErrorStatus === "function" ? mapsErrorStatus(err) : null;

        if (status) {
            return res.status(status).json({ message: err.message });
        }

        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.updateUserOfferedFare = async (req, res) => {
    const { rideId, offeredFare } = req.body;

    try {
        if (!rideId) {
            return res.status(400).json({
                message: "Falta rideId.",
            });
        }

        const nextFare = roundToHundred(offeredFare);

        if (!Number.isFinite(nextFare) || nextFare <= 0) {
            return res.status(400).json({
                message: "La nueva oferta no es válida.",
            });
        }

        let ride = await rideModel
            .findOne({
                _id: rideId,
                user: req.user._id,
                status: { $in: ["pending", "negotiating"] },
                negotiationStatus: "open",
                cancelledAt: null,
                cancelledBy: null,
                captain: null,
            })
            .populate("user", "fullname email socketId phone")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!ride) {
            return res.status(404).json({
                message:
                    "No se encontró la solicitud activa o ya no permite cambiar la oferta.",
            });
        }

        const currentFare = Number(
            ride.offeredFare || ride.fare || ride.suggestedFare || 0
        );

        if (nextFare <= currentFare) {
            return res.status(400).json({
                message: `La nueva oferta debe ser mayor a la actual (${currentFare}).`,
            });
        }

        ride.offeredFare = nextFare;
        ride.fare = nextFare;

        if (ride.status === "pending") {
            ride.status = "negotiating";
        }

        await ride.save();

        const updatedRide = await rideModel
            .findById(ride._id)
            .populate("user", "fullname email socketId phone")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        const payload = ridePayloadWithActiveOffers(updatedRide);

        emitToUser(updatedRide.user, {
            event: "ride-offer-updated",
            data: payload,
        });

        emitToUser(updatedRide.user, {
            event: "ride-updated",
            data: payload,
        });

        for (const offer of updatedRide.driverOffers || []) {
            if (offer?.captain) {
                emitToCaptain(offer.captain, {
                    event: "ride-user-offer-updated",
                    data: payload,
                });

                emitToCaptain(offer.captain, {
                    event: "ride-updated",
                    data: payload,
                });
            }
        }

        /*
         * HOTFIX:
         * Antes aquí se volvía a geocodificar pickup para reenviar a conductores
         * cercanos cuando el usuario cambiaba la oferta.
         *
         * Para parar consumo de Geocoding, NO hacemos geocoding aquí.
         * Los conductores recibirán actualización por socket si ya tenían la solicitud
         * o por polling de available-for-captain sin geocodificar.
         */
        return res.status(200).json({
            message: "Oferta actualizada correctamente.",
            ride: payload,
            geocodingDisabled: true,
        });
    } catch (err) {
        console.error("[updateUserOfferedFare] error:", err);

        return res.status(500).json({
            message: err.message || "Error actualizando la oferta.",
        });
    }
};

module.exports.captainOfferRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, price, message } = req.body;

    try {
        let ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("captain", "fullname email socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (
            ride.status === "cancelled" ||
            ride.status === "completed" ||
            ride.status === "ongoing" ||
            ride.cancelledAt ||
            ride.cancelledBy
        ) {
            return res.status(400).json({
                message: "Este viaje ya no acepta ofertas.",
            });
        }

        if (ride.negotiationStatus !== "open") {
            return res.status(400).json({
                message: "La negociación de este viaje ya está cerrada.",
            });
        }

        await rideService.expirePendingOffers(ride);

        ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("captain", "fullname email socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        const captainId = String(req.captain._id);
        const numericPrice = Number(price);

        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
            return res.status(400).json({ message: "Precio inválido." });
        }

        try {
            await walletService.assertCaptainCanAcceptRide(captainId);
        } catch (walletError) {
            return res.status(walletError.statusCode || 400).json({
                message: walletError.message,
                code: walletError.code || "WALLET_VALIDATION_ERROR",
                wallet: walletError.wallet || null,
            });
        }

        const currentOffers = (ride.driverOffers || []).map(normalizeOffer);

        const existingOfferIndex = currentOffers.findIndex((offer) => {
            const offerCaptainId = String(
                offer.captain?._id || offer.captain || ""
            );

            return offerCaptainId === captainId;
        });

        const newExpiry = new Date(Date.now() + rideService.OFFER_TTL_MS);

        if (existingOfferIndex >= 0) {
            currentOffers[existingOfferIndex] = {
                ...currentOffers[existingOfferIndex],
                price: numericPrice,
                message: message || "",
                status: "pending",
                createdAt: new Date(),
                expiresAt: newExpiry,
                respondedAt: null,
            };
        } else {
            currentOffers.push({
                captain: req.captain._id,
                price: numericPrice,
                message: message || "",
                status: "pending",
                createdAt: new Date(),
                expiresAt: newExpiry,
                respondedAt: null,
            });
        }

        const updateResult = await rideModel.updateOne(
            {
                _id: rideId,
                negotiationStatus: "open",
                status: { $nin: ["cancelled", "completed", "ongoing"] },
                cancelledAt: null,
                cancelledBy: null,
            },
            {
                $set: {
                    driverOffers: currentOffers,
                    status: "negotiating",
                },
            }
        );

        if (!updateResult.matchedCount) {
            return res.status(409).json({
                message: "El viaje cambió de estado. Intenta de nuevo.",
            });
        }

        let refreshedRide = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        await rideService.expirePendingOffers(refreshedRide);

        refreshedRide = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        const payload = ridePayloadWithActiveOffers(refreshedRide);

        emitToUser(refreshedRide.user, {
            event: "ride-offer-updated",
            data: payload,
        });

        return res.status(200).json(payload);
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.userRespondToCaptainOffer = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, captainId, action } = req.body;

    try {
        let ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (String(ride.user?._id) !== String(req.user._id)) {
            return res.status(403).json({
                message: "No autorizado para responder a este viaje.",
            });
        }

        if (ride.cancelledAt || ride.cancelledBy || ride.status === "cancelled") {
            return res.status(400).json({
                message: "Este viaje ya fue cancelado.",
            });
        }

        await rideService.expirePendingOffers(ride);

        ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        const currentOffers = (ride.driverOffers || []).map(normalizeOffer);

        const offerIndex = currentOffers.findIndex(
            (offer) =>
                String(offer.captain?._id || offer.captain) === String(captainId)
        );

        if (offerIndex < 0) {
            return res.status(404).json({
                message: "Oferta del conductor no encontrada.",
            });
        }

        const selectedOffer = currentOffers[offerIndex];

        const OFFER_ACCEPT_GRACE_MS = 10000;

        const offerExpiresAtMs = selectedOffer?.expiresAt
            ? new Date(selectedOffer.expiresAt).getTime()
            : null;

        const offerReallyExpired =
            Number.isFinite(offerExpiresAtMs) &&
            Date.now() > offerExpiresAtMs + OFFER_ACCEPT_GRACE_MS;

        if (selectedOffer.status !== "pending" || offerReallyExpired) {
            return res.status(400).json({
                message: "Esta oferta ya expiró o no está disponible.",
            });
        }

        if (action === "rejected") {
            currentOffers[offerIndex] = {
                ...selectedOffer,
                status: "rejected",
                respondedAt: new Date(),
            };

            const rejectResult = await rideModel.updateOne(
                {
                    _id: rideId,
                    user: req.user._id,
                    cancelledAt: null,
                    cancelledBy: null,
                    status: { $in: ["pending", "negotiating"] },
                },
                {
                    $set: {
                        driverOffers: currentOffers,
                        status: "pending",
                        negotiationStatus: "open",
                        captain: null,
                        selectedOfferCaptain: null,
                    },
                }
            );

            if (!rejectResult.matchedCount) {
                return res.status(409).json({
                    message: "El viaje cambió mientras respondías la oferta.",
                });
            }

            const populatedRide = await rideModel
                .findById(rideId)
                .populate("user", "fullname email socketId")
                .populate("driverOffers.captain", "fullname email vehicle socketId");

            const targetCaptain = populatedRide.driverOffers.find(
                (offer) =>
                    String(offer.captain?._id || offer.captain) === String(captainId)
            )?.captain;

            emitToCaptain(targetCaptain, {
                event: "ride-offer-rejected",
                data: ridePayloadWithActiveOffers(populatedRide),
            });

            emitToUser(populatedRide.user, {
                event: "ride-offer-updated",
                data: ridePayloadWithActiveOffers(populatedRide),
            });

            return res.status(200).json(ridePayloadWithActiveOffers(populatedRide));
        }

        if (ride.negotiationStatus !== "open") {
            return res.status(400).json({
                message: "La negociación ya fue cerrada.",
            });
        }

        try {
            await walletService.assertCaptainCanAcceptRide(captainId);
        } catch (walletError) {
            return res.status(walletError.statusCode || 400).json({
                message: "El conductor no tiene saldo suficiente para tomar este viaje.",
                code: walletError.code || "CAPTAIN_INSUFFICIENT_WALLET_BALANCE",
                wallet: walletError.wallet || null,
            });
        }

        const updatedOffers = currentOffers.map((offer) => {
            const isTarget =
                String(offer.captain?._id || offer.captain) === String(captainId);

            return {
                ...offer,
                status: isTarget
                    ? "accepted"
                    : offer.status === "pending"
                    ? "rejected"
                    : offer.status,
                respondedAt: new Date(),
            };
        });

        const acceptResult = await rideModel.updateOne(
            {
                _id: rideId,
                user: req.user._id,
                negotiationStatus: "open",
                status: { $in: ["pending", "negotiating"] },
                cancelledAt: null,
                cancelledBy: null,
            },
            {
                $set: {
                    selectedOfferCaptain: captainId,
                    captain: captainId,
                    fare: Number(selectedOffer.price),
                    negotiationStatus: "closed",
                    status: "accepted",
                    arrivedAtPickup: false,
                    arrivedAtPickupAt: null,
                    userConfirmedAtPickup: false,
                    userConfirmedAtPickupAt: null,
                    scheduledDispatchStartedAt: null,
                    startedAt: null,
                    completedAt: null,
                    driverOffers: updatedOffers,
                },
            }
        );

        if (!acceptResult.matchedCount) {
            return res.status(409).json({
                message: "La negociación cambió antes de aceptar la oferta.",
            });
        }

        const populatedRide = await rideModel
            .findById(rideId)
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        const acceptedCaptain = populatedRide.captain;

        emitToCaptain(acceptedCaptain, {
            event: "ride-offer-accepted",
            data: populatedRide,
        });

        emitToCaptain(acceptedCaptain, {
            event: "ride-updated",
            data: populatedRide,
        });

        for (const offer of populatedRide.driverOffers || []) {
            const offerCaptainId = String(offer.captain?._id || offer.captain);

            if (offerCaptainId !== String(captainId)) {
                emitToCaptain(offer.captain, {
                    event: "ride-no-longer-available",
                    data: {
                        rideId: populatedRide._id,
                        message: "Este viaje fue tomado por otro conductor.",
                    },
                });
            }
        }

        emitToUser(populatedRide.user, {
            event: "ride-confirmed",
            data: populatedRide,
        });

        emitToUser(populatedRide.user, {
            event: "ride-updated",
            data: populatedRide,
        });

        return res.status(200).json(populatedRide);
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.getMyActiveRide = async (req, res) => {
    try {
        const ACTIVE_USER_RIDE_MAX_AGE_HOURS = 6;
        const activeSince = new Date(
            Date.now() - ACTIVE_USER_RIDE_MAX_AGE_HOURS * 60 * 60 * 1000
        );

        let ride = await rideModel
            .findOne({
                user: req.user._id,
                status: {
                    $in: ["pending", "negotiating", "accepted", "arrived", "ongoing"],
                },
                cancelledAt: null,
                cancelledBy: null,
                updatedAt: {
                    $gte: activeSince,
                },
            })
            .sort({ updatedAt: -1 })
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (ride) {
            await rideService.expirePendingOffers(ride);

            ride = await rideModel
                .findById(ride._id)
                .populate("captain")
                .populate("driverOffers.captain", "fullname email vehicle socketId");
        }

        return res.status(200).json({
            ride: ride || null,
            activeDriverOffers: ride ? rideService.getActiveDriverOffers(ride) : [],
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.getCaptainActiveRide = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        const ACTIVE_RIDE_MAX_AGE_HOURS = 4;

        const activeSince = new Date(
            Date.now() - ACTIVE_RIDE_MAX_AGE_HOURS * 60 * 60 * 1000
        );

        const ride = await rideModel
            .findOne({
                captain: captainId,
                status: {
                    $in: ["accepted", "arrived", "ongoing"],
                },
                cancelledAt: null,
                cancelledBy: null,
                updatedAt: {
                    $gte: activeSince,
                },
            })
            .sort({ updatedAt: -1 })
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        return res.status(200).json({
            ride: ride || null,
        });
    } catch (err) {
        console.error("[getCaptainActiveRide] error:", err);

        return res.status(500).json({
            message:
                err.message ||
                "Error consultando carrera activa del conductor.",
        });
    }
};

module.exports.getAvailableForCaptain = async (req, res) => {
    try {
        const captainId = String(req.captain?._id || "");

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        /*
         * HOTFIX ANTI-COBRO GOOGLE:
         *
         * Esta función la llama el frontend del conductor cada pocos segundos.
         * Antes hacía:
         * - mapService.getAddressCoordinates(freshRide.pickup)
         * - mapService.getAddressCoordinates(freshRide.destination)
         *
         * Eso generó miles de solicitudes duplicadas de Geocoding.
         *
         * Ahora NO llamamos Google aquí.
         * Solo usamos información ya guardada en el viaje.
         */

        const maxAgeMinutes = 30;
        const createdAfter = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
        const now = new Date();

        /*
         * CENTRAL GO - distribución automática de solicitudes:
         *
         * HOME:
         * - "now" se conserva con la ventana actual de 30 minutos.
         * - "scheduled" solamente permanece en Home durante sus primeros
         *   5 minutos desde la publicación.
         *
         * EXPLORAR CARGAS (?marketplace=1):
         * - devuelve únicamente servicios "scheduled" que ya cumplieron
         *   esos 5 minutos y siguen disponibles.
         *
         * No se duplica ningún viaje: es el mismo Ride, solo cambia el panel
         * desde el cual se consulta.
         */
        const marketplaceMode =
            String(req.query?.marketplace || "").trim() === "1";

        const scheduledHomeMinutes = 5;
        const scheduledHomeCutoff = new Date(
            Date.now() - scheduledHomeMinutes * 60 * 1000
        );

        /*
         * Un domicilio programado NO debe desaparecer apenas se cumple
         * la hora exacta de recogida.
         *
         * Si el usuario no definió pickupEndAt, le damos una ventana de
         * gracia de 6 horas desde la hora programada para que siga visible
         * en Explorar cargas mientras continúa pendiente.
         *
         * Si sí existe pickupEndAt, esa hora final manda.
         */
        const scheduledGraceHours = 6;
        const scheduledGraceStart = new Date(
            Date.now() - scheduledGraceHours * 60 * 60 * 1000
        );

        const scheduledStillValidQuery = {
            serviceTiming: "scheduled",
            "schedule.pickupStartAt": { $ne: null },
            $or: [
                {
                    "schedule.pickupEndAt": { $gte: now },
                },
                {
                    "schedule.pickupEndAt": null,
                    "schedule.pickupStartAt": { $gte: scheduledGraceStart },
                },
            ],
        };

        const panelVisibilityQuery = marketplaceMode
            ? {
                  ...scheduledStillValidQuery,
                  createdAt: { $lte: scheduledHomeCutoff },
              }
            : {
                  $or: [
                      {
                          serviceTiming: { $ne: "scheduled" },
                          createdAt: { $gte: createdAfter },
                      },
                      {
                          ...scheduledStillValidQuery,
                          createdAt: { $gt: scheduledHomeCutoff },
                      },
                  ],
              };

        const openRides = await rideModel
            .find({
                negotiationStatus: "open",
                status: { $in: ["pending", "negotiating"] },
                captain: null,
                cancelledAt: null,
                cancelledBy: null,
                ...panelVisibilityQuery,
            })
            .sort({
                serviceTiming: -1,
                "schedule.pickupStartAt": 1,
                createdAt: -1,
            })
            .limit(50)
            .populate("user", "fullname email socketId phone")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        const availableRides = [];

        for (const ride of openRides) {
            await rideService.expirePendingOffers(ride);

            const freshRide = await rideModel
                .findById(ride._id)
                .populate("user", "fullname email socketId phone")
                .populate("driverOffers.captain", "fullname email vehicle socketId");

            if (!freshRide) continue;

            if (
                freshRide.negotiationStatus !== "open" ||
                !["pending", "negotiating"].includes(freshRide.status) ||
                freshRide.captain ||
                freshRide.cancelledAt ||
                freshRide.cancelledBy ||
                (
                    freshRide.serviceTiming !== "scheduled" &&
                    (
                        marketplaceMode ||
                        freshRide.createdAt < createdAfter
                    )
                ) ||
                (
                    freshRide.serviceTiming === "scheduled" &&
                    !marketplaceMode &&
                    freshRide.createdAt <= scheduledHomeCutoff
                ) ||
                (
                    freshRide.serviceTiming === "scheduled" &&
                    marketplaceMode &&
                    freshRide.createdAt > scheduledHomeCutoff
                ) ||
                (
                    freshRide.serviceTiming === "scheduled" &&
                    freshRide.schedule?.pickupEndAt &&
                    new Date(freshRide.schedule.pickupEndAt).getTime() < Date.now()
                ) ||
                (
                    freshRide.serviceTiming === "scheduled" &&
                    !freshRide.schedule?.pickupEndAt &&
                    freshRide.schedule?.pickupStartAt &&
                    new Date(freshRide.schedule.pickupStartAt).getTime() <
                        scheduledGraceStart.getTime()
                )
            ) {
                continue;
            }

            const captainHasPendingOffer = (freshRide.driverOffers || []).some(
                (offer) => {
                    const offerCaptainId = String(
                        offer.captain?._id || offer.captain || ""
                    );

                    return (
                        offerCaptainId === captainId &&
                        offer.status === "pending" &&
                        !rideService.isOfferExpired(offer)
                    );
                }
            );

            if (captainHasPendingOffer) {
                continue;
            }

            const pickupToDestinationKm =
                normalizeDistanceToKm(freshRide.distance) || null;

            const payload = ridePayloadWithActiveOffers(freshRide);

            availableRides.push({
                ...payload,
                metrics: {
                    driverToPickupKm: null,
                    pickupToDestinationKm,
                    driverToPickupText: "-- km",
                    pickupToDestinationText:
                        Number.isFinite(pickupToDestinationKm) &&
                        pickupToDestinationKm > 0
                            ? `${pickupToDestinationKm.toFixed(1)} km`
                            : "-- km",
                    geocodingDisabled: true,
                    geocodingDisabledReason:
                        "Geocoding desactivado temporalmente en available-for-captain para evitar cobros duplicados.",
                },
            });
        }

        return res.status(200).json({
            rides: availableRides,
            count: availableRides.length,
            captainId,
            panel: marketplaceMode ? "marketplace" : "home",
            scheduledHomeMinutes,
            scheduledGraceHours,
            geocodingDisabled: true,
        });
    } catch (err) {
        console.error("[getAvailableForCaptain] error:", err);

        return res.status(500).json({
            message: err.message || "Error consultando viajes disponibles.",
        });
    }
};

module.exports.getCaptainStats = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        const dateParam = req.query?.date;
        const selectedDate = dateParam ? new Date(dateParam) : new Date();

        if (Number.isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                message: "Fecha inválida.",
            });
        }

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const captain = await captainModel.findById(captainId);

        const completedRides = await rideModel
            .find({
                captain: captainId,
                status: "completed",
                updatedAt: {
                    $gte: startOfDay,
                    $lte: endOfDay,
                },
            })
            .sort({ updatedAt: -1 })
            .populate("user", "fullname email phone");

        let totalTrips = 0;
        let totalDistanceKm = 0;
        let totalEarning = 0;
        let cashCollected = 0;
        let transferCollected = 0;
        let unknownPaymentCollected = 0;

        const rides = completedRides.map((ride) => {
            const fare =
                Number(
                    ride?.fare ??
                        ride?.offeredFare ??
                        ride?.suggestedFare ??
                        0
                ) || 0;

            const distanceKm = normalizeDistanceToKm(ride?.distance) || 0;
            const paymentMethod = normalizePaymentMethod(ride);

            totalTrips += 1;
            totalDistanceKm += distanceKm;
            totalEarning += fare;

            if (paymentMethod === "cash") {
                cashCollected += fare;
            } else if (paymentMethod === "transfer") {
                transferCollected += fare;
            } else {
                unknownPaymentCollected += fare;
            }

            return {
                _id: ride._id,
                pickup: ride.pickup,
                destination: ride.destination,
                fare: Math.round(fare),
                distanceKm: Number(distanceKm.toFixed(2)),
                paymentMethod,
                status: ride.status,
                completedAt: ride.completedAt || ride.updatedAt,
                createdAt: ride.createdAt,
                user: ride.user || null,
            };
        });

        let hoursOnline = Number(captain?.stats?.hoursOnline ?? 0) || 0;

        if (captain?.onlineSession?.isOnline && captain?.onlineSession?.startedAt) {
            const startedAt = new Date(captain.onlineSession.startedAt);
            const diffMs = Date.now() - startedAt.getTime();

            if (Number.isFinite(diffMs) && diffMs > 0) {
                hoursOnline = diffMs / (1000 * 60 * 60);
            }
        }

        const pendingToSettle = cashCollected;

        return res.status(200).json({
            ok: true,
            date: startOfDay.toISOString().slice(0, 10),
            range: {
                start: startOfDay,
                end: endOfDay,
            },
            stats: {
                hoursOnline: Number(hoursOnline.toFixed(2)),
                totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
                totalEarning: Math.round(totalEarning),
                cashCollected: Math.round(cashCollected),
                transferCollected: Math.round(transferCollected),
                unknownPaymentCollected: Math.round(unknownPaymentCollected),
                totalTrips,
                pendingToSettle: Math.round(pendingToSettle),
            },
            rides,
        });
    } catch (err) {
        console.error("[getCaptainStats] error:", err);

        return res.status(500).json({
            message: err.message || "Error consultando estadísticas del conductor.",
        });
    }
};

module.exports.getCaptainHistory = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                message: "Conductor no autenticado.",
            });
        }

        const limitParam = Number(req.query?.limit || 50);
        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
            100
        );

        const completedRides = await rideModel
            .find({
                captain: captainId,
                status: "completed",
            })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .populate("user", "fullname email phone");

        const rides = completedRides.map((ride) => {
            const fare =
                Number(
                    ride?.fare ??
                        ride?.offeredFare ??
                        ride?.suggestedFare ??
                        0
                ) || 0;

            const distanceKm = normalizeDistanceToKm(ride?.distance) || 0;

            return {
                _id: ride._id,
                pickup: ride.pickup,
                destination: ride.destination,
                fare: Math.round(fare),
                distanceKm: Number(distanceKm.toFixed(2)),
                paymentMethod: normalizePaymentMethod(ride),
                status: ride.status,
                completedAt: ride.completedAt || ride.updatedAt,
                createdAt: ride.createdAt,
                user: ride.user || null,
            };
        });

        return res.status(200).json({
            ok: true,
            count: rides.length,
            rides,
        });
    } catch (err) {
        console.error("[getCaptainHistory] error:", err);

        return res.status(500).json({
            message: err.message || "Error consultando historial del conductor.",
        });
    }
};

module.exports.getRideOffers = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        let ride = await rideModel
            .findById(req.params.rideId)
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (String(ride.user?._id) !== String(req.user._id)) {
            return res.status(403).json({
                message: "No autorizado para ver las ofertas de este viaje.",
            });
        }

        await rideService.expirePendingOffers(ride);

        ride = await rideModel
            .findById(req.params.rideId)
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        return res.status(200).json({
            rideId: ride._id,
            status: ride.status,
            negotiationStatus: ride.negotiationStatus,
            offeredFare: ride.offeredFare,
            fare: ride.fare,
            driverOffers: ride.driverOffers || [],
            activeDriverOffers: rideService.getActiveDriverOffers(ride),
            captain: ride.captain || null,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.confirmRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const rideBeforeConfirm = await rideModel.findById(rideId).populate("user");

        if (!rideBeforeConfirm) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (
            String(rideBeforeConfirm.selectedOfferCaptain || "") !==
            String(req.captain?._id || "")
        ) {
            return res.status(403).json({
                message: "Este viaje no fue asignado a este conductor.",
            });
        }

        const ride = await rideService.confirmRide({
            rideId,
            captain: req.captain,
        });

        let notified = false;

        if (ride?.user?.socketId) {
            notified = sendMessageToSocketId(ride.user.socketId, {
                event: "ride-confirmed",
                data: ride,
            });
        }

        return res.status(200).json({
            ...ride.toObject(),
            userNotified: notified,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.arrived = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const updatedRide = await rideModel
            .findOneAndUpdate(
                {
                    _id: rideId,
                    captain: req.captain._id,
                    status: { $in: ["accepted", "ongoing", "arrived"] },
                    cancelledAt: null,
                },
                {
                    $set: {
                        arrivedAtPickup: true,
                        arrivedAtPickupAt: new Date(),
                        userConfirmedAtPickup: false,
                        userConfirmedAtPickupAt: null,
                        status: "arrived",
                    },
                },
                {
                    new: true,
                }
            )
            .populate("user")
            .populate("captain");

        if (!updatedRide) {
            return res.status(404).json({
                message:
                    "Ride not found o el servicio ya no está disponible para marcar llegada.",
            });
        }

        let notified = false;

        const payload = {
            rideId: updatedRide._id,
            message: "Tu conductor ya llegó al punto de recogida.",
            waitSeconds: 30,
            ride: updatedRide,
        };

        if (updatedRide.user?.socketId) {
            const notifiedMain = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "captain-arrived",
                data: payload,
            });

            const notifiedUpdate = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "ride-updated",
                data: updatedRide,
            });

            notified = Boolean(notifiedMain || notifiedUpdate);
        }

        return res.status(200).json({
            message: notified
                ? "Llegada notificada correctamente."
                : "Llegada registrada, pero no se pudo notificar al usuario en tiempo real.",
            userNotified: notified,
            waitSeconds: 30,
            ride: updatedRide,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.userAtPickup = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideModel
            .findOne({
                _id: rideId,
                user: req.user._id,
                status: "arrived",
                arrivedAtPickup: true,
                cancelledAt: null,
            })
            .populate("user", "fullname email socketId")
            .populate("captain", "fullname email socketId");

        if (!ride) {
            return res.status(404).json({
                message:
                    "Viaje no encontrado o el conductor todavía no ha marcado llegada.",
            });
        }

        if (ride.userConfirmedAtPickup) {
            return res.status(200).json({
                message: "Ya habías confirmado que estás en el punto.",
                captainNotified: false,
                ride,
            });
        }

        ride.userConfirmedAtPickup = true;
        ride.userConfirmedAtPickupAt = new Date();

        await ride.save();

        const updatedRide = await rideModel
            .findById(rideId)
            .populate("user")
            .populate("captain");

        let captainNotified = false;

        if (updatedRide?.captain?.socketId) {
            const payload = {
                rideId: updatedRide._id,
                message: "El usuario confirmó que ya está en el punto.",
                ride: updatedRide,
            };

            const notifiedMain = sendMessageToSocketId(updatedRide.captain.socketId, {
                event: "user-confirmed-at-pickup",
                data: payload,
            });

            const notifiedAlias = sendMessageToSocketId(updatedRide.captain.socketId, {
                event: "user-confirmed-pickup",
                data: payload,
            });

            const notifiedUpdate = sendMessageToSocketId(updatedRide.captain.socketId, {
                event: "ride-updated",
                data: updatedRide,
            });

            captainNotified = Boolean(notifiedMain || notifiedAlias || notifiedUpdate);
        }

        return res.status(200).json({
            message: captainNotified
                ? "Confirmación enviada al conductor."
                : "Confirmación registrada, pero el conductor no está conectado.",
            captainNotified,
            ride: updatedRide,
        });
    } catch (err) {
        console.error("[userAtPickup] error:", err);

        return res.status(500).json({
            message: err.message || "Error confirmando recogida del usuario.",
        });
    }
};

module.exports.startScheduledDispatch = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideModel
            .findOne({
                _id: rideId,
                captain: req.captain._id,
                serviceTiming: "scheduled",
                status: "accepted",
                cancelledAt: null,
                cancelledBy: null,
            })
            .populate("user")
            .populate("captain");

        if (!ride) {
            return res.status(404).json({
                message:
                    "No se encontró un domicilio programado asignado a este conductor.",
            });
        }

        if (ride.scheduledDispatchStartedAt) {
            return res.status(200).json({
                message: "El domicilio ya había sido iniciado.",
                ride,
            });
        }

        const updatedRide = await rideModel
            .findOneAndUpdate(
                {
                    _id: rideId,
                    captain: req.captain._id,
                    serviceTiming: "scheduled",
                    status: "accepted",
                    scheduledDispatchStartedAt: null,
                    cancelledAt: null,
                    cancelledBy: null,
                },
                {
                    $set: {
                        scheduledDispatchStartedAt: new Date(),
                    },
                },
                { new: true }
            )
            .populate("user")
            .populate("captain");

        if (!updatedRide) {
            return res.status(409).json({
                message:
                    "El estado del domicilio cambió antes de poder iniciarlo.",
            });
        }

        const payload = {
            rideId: updatedRide._id,
            message: "El conductor inició el domicilio programado.",
            ride: updatedRide,
        };

        if (updatedRide.user?.socketId) {
            sendMessageToSocketId(updatedRide.user.socketId, {
                event: "scheduled-dispatch-started",
                data: payload,
            });

            sendMessageToSocketId(updatedRide.user.socketId, {
                event: "ride-updated",
                data: updatedRide,
            });
        }

        if (updatedRide.captain?.socketId) {
            sendMessageToSocketId(updatedRide.captain.socketId, {
                event: "ride-updated",
                data: updatedRide,
            });
        }

        return res.status(200).json({
            message: "Domicilio iniciado. Ya puedes dirigirte a la recogida.",
            ride: updatedRide,
        });
    } catch (err) {
        console.error("[startScheduledDispatch] error:", err);

        return res.status(500).json({
            message:
                err.message ||
                "Error iniciando el domicilio programado.",
        });
    }
};

module.exports.startRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const updatedRide = await rideModel
            .findOneAndUpdate(
                {
                    _id: rideId,
                    captain: req.captain._id,
                    status: "arrived",
                    userConfirmedAtPickup: true,
                    cancelledAt: null,
                },
                {
                    $set: {
                        status: "ongoing",
                        startedAt: new Date(),
                    },
                },
                {
                    new: true,
                }
            )
            .populate("user")
            .populate("captain");

        if (!updatedRide) {
            return res.status(404).json({
                message:
                    "No puedes iniciar este viaje todavía. El usuario debe confirmar que ya está en el punto.",
            });
        }

        let userNotified = false;

        const payload = {
            rideId: updatedRide._id,
            message: "Tu viaje ha iniciado.",
            ride: updatedRide,
        };

        if (updatedRide.user?.socketId) {
            const notifiedMain = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "ride-started",
                data: payload,
            });

            const notifiedUpdate = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "ride-updated",
                data: updatedRide,
            });

            userNotified = Boolean(notifiedMain || notifiedUpdate);
        }

        return res.status(200).json({
            message: userNotified
                ? "Viaje iniciado correctamente y usuario notificado."
                : "Viaje iniciado correctamente.",
            userNotified,
            ride: updatedRide,
        });
    } catch (err) {
        console.error("[startRide] error:", err);

        return res.status(500).json({
            message: err.message || "Error iniciando viaje.",
        });
    }
};

module.exports.endRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.endRide({
            rideId,
            captain: req.captain,
        });

        let commissionResult = null;

        try {
            commissionResult = await walletService.debitCommissionForRide(ride);
        } catch (walletError) {
            console.error("[endRide] Error descontando comisión:", walletError);

            commissionResult = {
                charged: false,
                error:
                    walletError.message ||
                    "No se pudo descontar la comisión del conductor.",
            };
        }

        let notified = false;

        if (ride?.user?.socketId) {
            const payload = {
                rideId: ride._id,
                message: "Tu viaje finalizó. Califica al conductor.",
                ride,
                shouldRateCaptain: true,
            };

            const notifiedMain = sendMessageToSocketId(ride.user.socketId, {
                event: "ride-ended",
                data: payload,
            });

            const notifiedUpdate = sendMessageToSocketId(ride.user.socketId, {
                event: "ride-updated",
                data: ride,
            });

            notified = Boolean(notifiedMain || notifiedUpdate);
        }

        if (ride?.captain?.socketId || req.captain?.socketId) {
            emitToCaptain(ride.captain || req.captain, {
                event: "wallet-updated",
                data: {
                    rideId: ride._id,
                    commission: commissionResult,
                    message: commissionResult?.charged
                        ? "Comisión descontada correctamente."
                        : "Viaje finalizado.",
                },
            });
        }

        return res.status(200).json({
            ...ride.toObject(),
            userNotified: notified,
            shouldRateUser: true,
            shouldRateCaptain: true,
            commission: commissionResult,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.rateCaptain = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, rating, comment } = req.body;

    try {
        const safeRating = normalizeRating(rating);

        if (!safeRating) {
            return res.status(400).json({
                message: "La calificación debe estar entre 1 y 5 estrellas.",
            });
        }

        const ride = await rideModel
            .findOne({
                _id: rideId,
                user: req.user._id,
                status: "completed",
                cancelledAt: null,
                captain: { $ne: null },
            })
            .populate("user", "fullname email socketId rating ratingCount")
            .populate(
                "captain",
                "fullname email socketId rating ratingCount profileImage vehicle"
            );

        if (!ride) {
            return res.status(404).json({
                message:
                    "Domicilio no encontrado, cancelado o aún no está finalizado.",
            });
        }

        if (String(ride.user?._id) === String(ride.captain?._id)) {
            return res.status(400).json({
                message: "No puedes calificarte a ti mismo.",
            });
        }

        if (ride.userRatingToCaptain?.rating) {
            return res.status(400).json({
                message: "Ya calificaste a este conductor.",
            });
        }

        ride.userRatingToCaptain = {
            rating: safeRating,
            comment: cleanComment(comment),
            ratedAt: new Date(),
        };

        await ride.save();

        const captainSummary = await recalculateCaptainRating(
            ride.captain?._id || ride.captain
        );

        const updatedRide = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId rating ratingCount")
            .populate(
                "captain",
                "fullname email socketId rating ratingCount profileImage vehicle"
            );

        emitToCaptain(updatedRide.captain, {
            event: "captain-rated",
            data: {
                rideId: updatedRide._id,
                rating: safeRating,
                comment: cleanComment(comment),
                captainRating: captainSummary.rating,
                captainRatingCount: captainSummary.ratingCount,
                ride: updatedRide,
            },
        });

        return res.status(200).json({
            message: "Calificación enviada correctamente.",
            rating: safeRating,
            captainRating: captainSummary.rating,
            captainRatingCount: captainSummary.ratingCount,
            ride: updatedRide,
        });
    } catch (err) {
        console.error("[rateCaptain] error:", err);

        return res.status(500).json({
            message: err.message || "Error calificando conductor.",
        });
    }
};

module.exports.rateUser = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, rating, comment } = req.body;

    try {
        const safeRating = normalizeRating(rating);

        if (!safeRating) {
            return res.status(400).json({
                message: "La calificación debe estar entre 1 y 5 estrellas.",
            });
        }

        const ride = await rideModel
            .findOne({
                _id: rideId,
                captain: req.captain._id,
                status: "completed",
                cancelledAt: null,
                user: { $ne: null },
            })
            .populate("user", "fullname email socketId rating ratingCount")
            .populate(
                "captain",
                "fullname email socketId rating ratingCount profileImage vehicle"
            );

        if (!ride) {
            return res.status(404).json({
                message:
                    "Domicilio no encontrado, cancelado o aún no está finalizado.",
            });
        }

        if (String(ride.user?._id) === String(ride.captain?._id)) {
            return res.status(400).json({
                message: "No puedes calificarte a ti mismo.",
            });
        }

        if (ride.captainRatingToUser?.rating) {
            return res.status(400).json({
                message: "Ya calificaste a este usuario.",
            });
        }

        ride.captainRatingToUser = {
            rating: safeRating,
            comment: cleanComment(comment),
            ratedAt: new Date(),
        };

        await ride.save();

        const userSummary = await recalculateUserRating(
            ride.user?._id || ride.user
        );

        const updatedRide = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId rating ratingCount")
            .populate(
                "captain",
                "fullname email socketId rating ratingCount profileImage vehicle"
            );

        emitToUser(updatedRide.user, {
            event: "user-rated",
            data: {
                rideId: updatedRide._id,
                rating: safeRating,
                comment: cleanComment(comment),
                userRating: userSummary.rating,
                userRatingCount: userSummary.ratingCount,
                ride: updatedRide,
            },
        });

        return res.status(200).json({
            message: "Calificación enviada correctamente.",
            rating: safeRating,
            userRating: userSummary.rating,
            userRatingCount: userSummary.ratingCount,
            ride: updatedRide,
        });
    } catch (err) {
        console.error("[rateUser] error:", err);

        return res.status(500).json({
            message: err.message || "Error calificando usuario.",
        });
    }
};

module.exports.cancelRide = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideModel
            .findOneAndUpdate(
                {
                    _id: rideId,
                    user: req.user._id,
                    status: { $in: ["pending", "negotiating", "accepted", "arrived"] },
                    cancelledAt: null,
                },
                {
                    $set: {
                        status: "cancelled",
                        negotiationStatus: "closed",
                        cancelledBy: "user",
                        cancelReason: "Cancelado por el usuario",
                        cancelNotes: "",
                        cancelledAt: new Date(),
                        captain: null,
                        selectedOfferCaptain: null,
                        "driverOffers.$[].status": "withdrawn",
                    },
                },
                {
                    new: true,
                }
            )
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        if (!ride) {
            return res.status(404).json({
                message: "Viaje no encontrado o ya no se puede cancelar.",
            });
        }

        for (const offer of ride.driverOffers || []) {
            if (offer?.captain) {
                emitToCaptain(offer.captain, {
                    event: "ride-no-longer-available",
                    data: {
                        rideId: ride._id,
                        message: "El usuario canceló este viaje.",
                    },
                });
            }
        }

        emitToUser(ride.user, {
            event: "ride-cancelled",
            data: {
                rideId: ride._id,
                message: "Solicitud cancelada correctamente.",
                ride,
            },
        });

        return res.status(200).json({
            message: "Solicitud cancelada correctamente.",
            ride,
        });
    } catch (err) {
        console.error("[cancelRide] error:", err);

        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.cancelByCaptain = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, reason, notes } = req.body;

    try {
        const updatedRide = await rideModel
            .findOneAndUpdate(
                {
                    _id: rideId,
                    captain: req.captain._id,
                    status: { $in: ["accepted", "ongoing", "arrived"] },
                    cancelledAt: null,
                },
                {
                    $set: {
                        status: "cancelled",
                        negotiationStatus: "closed",
                        cancelledBy: "captain",
                        cancelReason: reason || "Sin motivo",
                        cancelNotes: notes || "",
                        cancelledAt: new Date(),
                    },
                },
                {
                    new: true,
                }
            )
            .populate("user")
            .populate("captain");

        if (!updatedRide) {
            return res.status(404).json({
                message:
                    "Ride not found o el servicio ya no se puede cancelar en el estado actual.",
            });
        }

        let notified = false;

        if (updatedRide.user?.socketId) {
            notified = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "ride-cancelled-by-captain",
                data: {
                    rideId: updatedRide._id,
                    reason: updatedRide.cancelReason,
                    notes: updatedRide.cancelNotes,
                    message: "El conductor canceló la solicitud.",
                },
            });
        }

        return res.status(200).json({
            message: notified
                ? "Solicitud cancelada correctamente por el conductor."
                : "Solicitud cancelada, pero no se pudo notificar al usuario en tiempo real.",
            userNotified: notified,
            ride: updatedRide,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.sendRideChatMessage = async (req, res) => {
    const { rideId, message, senderType } = req.body;

    try {
        const cleanMessage = String(message || "").trim();

        if (!rideId) {
            return res.status(400).json({
                message: "Falta rideId.",
            });
        }

        if (!cleanMessage) {
            return res.status(400).json({
                message: "El mensaje no puede estar vacío.",
            });
        }

        if (!["user", "captain"].includes(senderType)) {
            return res.status(400).json({
                message: "senderType inválido.",
            });
        }

        const ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("captain", "fullname email socketId");

        if (!ride) {
            return res.status(404).json({
                message: "Ride not found.",
            });
        }

        if (senderType === "user") {
            if (!req.user?._id) {
                return res.status(401).json({
                    message: "Usuario no autenticado.",
                });
            }

            if (String(ride.user?._id) !== String(req.user._id)) {
                return res.status(403).json({
                    message: "No autorizado para enviar mensajes en este servicio.",
                });
            }
        }

        if (senderType === "captain") {
            if (!req.captain?._id) {
                return res.status(401).json({
                    message: "Conductor no autenticado.",
                });
            }

            if (String(ride.captain?._id) !== String(req.captain._id)) {
                return res.status(403).json({
                    message: "Este servicio no está asignado a este conductor.",
                });
            }
        }

        const chatPayload = {
            _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            rideId: String(ride._id),
            senderType,
            from: senderType,
            message: cleanMessage,
            text: cleanMessage,
            createdAt: new Date().toISOString(),
            userId: ride.user?._id || null,
            captainId: ride.captain?._id || null,
        };

        let delivered = false;

        if (senderType === "user") {
            delivered = emitToCaptain(ride.captain, {
                event: "ride-message",
                data: chatPayload,
            });

            emitToCaptain(ride.captain, {
                event: "ride-chat-message",
                data: chatPayload,
            });
        }

        if (senderType === "captain") {
            delivered = emitToUser(ride.user, {
                event: "ride-message",
                data: chatPayload,
            });

            emitToUser(ride.user, {
                event: "ride-chat-message",
                data: chatPayload,
            });
        }

        return res.status(200).json({
            ok: true,
            delivered,
            message: delivered
                ? "Mensaje enviado correctamente."
                : "Mensaje enviado, pero el destinatario no está conectado.",
            data: chatPayload,
        });
    } catch (err) {
        console.error("[sendRideChatMessage] error:", err);

        return res.status(500).json({
            message: err.message || "Error interno enviando mensaje.",
        });
    }
};