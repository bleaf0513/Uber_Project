const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const captainModel = require("../models/captain.model");
const { mapsErrorStatus } = require("../utils/mapsHttpStatus");

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
        activeDriverOffers: rideService.getActiveDriverOffers(rideDoc).map((offer) =>
            typeof offer?.toObject === "function" ? offer.toObject() : offer
        ),
    };
}

function normalizeOffer(offer) {
    if (!offer) return offer;
    return typeof offer.toObject === "function" ? offer.toObject() : { ...offer };
}

module.exports.createRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, vehicle, offeredFare } = req.body;

    try {
        const ride = await rideService.createRide({
            user: req.user,
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        await rideModel.updateOne(
            { _id: ride._id },
            {
                $set: {
                    status: "pending",
                    negotiationStatus: "open",
                },
            }
        );

        const pickupCoordinates = await mapService.getAddressCoordinates(pickup);

        if (
            !pickupCoordinates ||
            !Number.isFinite(pickupCoordinates.ltd) ||
            !Number.isFinite(pickupCoordinates.lng)
        ) {
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

        const rideWithUser = await rideModel.findOne({ _id: ride._id }).populate("user");

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
            return res.status(404).json({
                message: "No hay conductores disponibles cerca en este momento.",
                code: "NO_CAPTAINS_AVAILABLE",
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

    const { pickup, destination } = req.query;

    try {
        const fare = await rideService.getFare(pickup, destination);
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
            ride.status === "ongoing"
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

        const currentOffers = (ride.driverOffers || []).map(normalizeOffer);
        const existingOfferIndex = currentOffers.findIndex(
            (offer) => String(offer.captain) === captainId
        );

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
            return res.status(404).json({ message: "Oferta del conductor no encontrada." });
        }

        const selectedOffer = currentOffers[offerIndex];

        if (
            selectedOffer.status !== "pending" ||
            rideService.isOfferExpired(selectedOffer)
        ) {
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
                { _id: rideId, user: req.user._id },
                { $set: { driverOffers: currentOffers } }
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

        return res.status(200).json(populatedRide);
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.getMyActiveRide = async (req, res) => {
    try {
        let ride = await rideModel
            .findOne({
                user: req.user._id,
                status: {
                    $in: ["pending", "negotiating", "accepted", "arrived", "ongoing"],
                },
            })
            .sort({ createdAt: -1 })
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
                    status: { $in: ["accepted", "ongoing"] },
                    cancelledAt: null,
                },
                {
                    $set: {
                        arrivedAtPickup: true,
                        arrivedAtPickupAt: new Date(),
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
        if (updatedRide.user?.socketId) {
            notified = sendMessageToSocketId(updatedRide.user.socketId, {
                event: "captain-arrived",
                data: {
                    rideId: updatedRide._id,
                    message: "Tu conductor ya llegó al punto de recogida.",
                    ride: updatedRide,
                },
            });
        }

        return res.status(200).json({
            message: notified
                ? "Llegada notificada correctamente."
                : "Llegada registrada, pero no se pudo notificar al usuario en tiempo real.",
            userNotified: notified,
            ride: updatedRide,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
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

        let notified = false;
        if (ride?.user?.socketId) {
            notified = sendMessageToSocketId(ride.user.socketId, {
                event: "ride-ended",
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

module.exports.cancelRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.cancelRide({
            rideId,
            user: req.user,
        });

        return res.status(200).json({
            message: "Solicitud cancelada correctamente",
            ride,
        });
    } catch (err) {
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