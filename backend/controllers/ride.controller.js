const rideService = require("../services/ride.service");
const { validationResult } = require("express-validator");
const mapService = require("../services/maps.service");
const { sendMessageToSocketId } = require("../socket");
const rideModel = require("../models/ride.model");
const captainModel = require("../models/captain.model");
const { mapsErrorStatus } = require("../utils/mapsHttpStatus");

console.log("🔥🔥🔥 RIDE CONTROLLER NUEVO EN PRODUCCION 🔥🔥🔥");

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

module.exports.createRide = async (req, res) => {
    console.log("🔥 CREATE RIDE NUEVO FUNCIONANDO 🔥");

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("[ride] validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, vehicle, offeredFare } = req.body;

    try {
        console.log("[ride] createRide request:", {
            userId: safeId(req.user?._id),
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        const ride = await rideService.createRide({
            user: req.user,
            pickup,
            destination,
            vehicle,
            offeredFare,
        });

        // Dejar listo para negociación
        ride.status = "pending";
        ride.negotiationStatus = "open";
        await ride.save();

        console.log("[ride] ride created:", {
            rideId: safeId(ride?._id),
            userId: safeId(req.user?._id),
        });

        const pickupCoordinates = await mapService.getAddressCoordinates(pickup);

        console.log("[ride] pickupCoordinates:", pickupCoordinates);

        if (
            !pickupCoordinates ||
            !Number.isFinite(pickupCoordinates.ltd) ||
            !Number.isFinite(pickupCoordinates.lng)
        ) {
            console.error(
                "[ride] invalid pickup coordinates after geocoding:",
                pickupCoordinates
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

        const captainsSummary = (captainsInRadius || []).map((captain) => ({
            captainId: safeId(captain?._id),
            socketId: captain?.socketId || null,
            status: captain?.status || null,
            location: captain?.location || null,
        }));

        console.log("[ride] captainsInRadius summary:", captainsSummary);
        console.log("[ride] captainsInRadius count:", captainsSummary.length);

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

        console.log("[ride] active captains diagnostic:", allActiveDiagnostic);

        ride.otp = "";

        const rideWithUser = await rideModel.findOne({ _id: ride._id }).populate("user");

        if (!rideWithUser) {
            console.error("[ride] rideWithUser not found after creation:", {
                rideId: safeId(ride?._id),
            });

            return res.status(500).json({
                message: "No se pudo cargar la solicitud recién creada.",
            });
        }

        let emittedCount = 0;
        let skippedNoSocket = 0;
        const emittedTo = [];
        const skippedCaptains = [];

        for (const captain of captainsInRadius || []) {
            const captainId = safeId(captain?._id);
            const socketId = captain?.socketId || null;

            console.log("[ride] trying socket emit new-ride:", {
                captainId,
                socketId,
            });

            if (!socketId) {
                skippedNoSocket += 1;
                skippedCaptains.push({
                    captainId,
                    reason: "missing_socket",
                });
                continue;
            }

            const sent = sendMessageToSocketId(socketId, {
                event: "new-ride",
                data: rideWithUser,
            });

            if (sent) {
                emittedCount += 1;
                emittedTo.push({
                    captainId,
                    socketId,
                });
            } else {
                skippedCaptains.push({
                    captainId,
                    socketId,
                    reason: "emit_failed",
                });
            }
        }

        console.log("[ride] new-ride emit result:", {
            rideId: safeId(rideWithUser?._id),
            captainsFound: captainsSummary.length,
            emittedCount,
            skippedNoSocket,
            emittedTo,
            skippedCaptains,
        });

        if ((captainsInRadius || []).length === 0) {
            console.warn("[ride] no captains found in radius for ride:", {
                rideId: safeId(rideWithUser?._id),
                pickup,
                pickupCoordinates,
                radiusKm: SEARCH_RADIUS_KM,
            });

            return res.status(404).json({
                message: "No hay conductores disponibles cerca en este momento.",
                code: "NO_CAPTAINS_AVAILABLE",
                pickupCoordinates,
                radiusKm: SEARCH_RADIUS_KM,
                activeCaptainsDiagnostic: allActiveDiagnostic,
            });
        }

        if ((captainsInRadius || []).length > 0 && emittedCount === 0) {
            console.warn("[ride] captains found but no new-ride emitted:", {
                rideId: safeId(rideWithUser?._id),
                captainsFound: captainsSummary.length,
                skippedCaptains,
            });

            return res.status(503).json({
                message:
                    "Se encontraron conductores, pero no fue posible notificarles.",
                code: "CAPTAINS_FOUND_BUT_NOT_NOTIFIED",
                captainsFound: captainsSummary.length,
                skippedCaptains,
            });
        }

        return res.status(201).json(ride);
    } catch (err) {
        console.error("Error en createRide:", err);

        const status = typeof mapsErrorStatus === "function" ? mapsErrorStatus(err) : null;
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
        console.warn("[ride] getFare validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination } = req.query;

    try {
        console.log("[ride] getFare request:", { pickup, destination });

        const fare = await rideService.getFare(pickup, destination);

        console.log("[ride] getFare response:", fare);

        return res.status(200).json(fare);
    } catch (err) {
        console.error("Error en getFare:", err);

        const status = typeof mapsErrorStatus === "function" ? mapsErrorStatus(err) : null;
        if (status) {
            return res.status(status).json({ message: err.message });
        }

        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

// NUEVO: conductor oferta o contraoferta
module.exports.captainOfferRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, price, message } = req.body;

    try {
        const ride = await rideModel
            .findById(rideId)
            .populate("user", "fullname email socketId")
            .populate("captain", "fullname email socketId");

        if (!ride) {
            return res.status(404).json({ message: "Ride not found." });
        }

        if (ride.status === "cancelled" || ride.status === "completed" || ride.status === "ongoing") {
            return res.status(400).json({
                message: "Este viaje ya no acepta ofertas.",
            });
        }

        if (ride.negotiationStatus !== "open") {
            return res.status(400).json({
                message: "La negociación de este viaje ya está cerrada.",
            });
        }

        const captainId = String(req.captain._id);
        const numericPrice = Number(price);

        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
            return res.status(400).json({ message: "Precio inválido." });
        }

        const existingOfferIndex = ride.driverOffers.findIndex(
            (offer) => String(offer.captain) === captainId
        );

        if (existingOfferIndex >= 0) {
            ride.driverOffers[existingOfferIndex].price = numericPrice;
            ride.driverOffers[existingOfferIndex].message = message || "";
            ride.driverOffers[existingOfferIndex].status = "pending";
            ride.driverOffers[existingOfferIndex].createdAt = new Date();
            ride.driverOffers[existingOfferIndex].respondedAt = null;
        } else {
            ride.driverOffers.push({
                captain: req.captain._id,
                price: numericPrice,
                message: message || "",
                status: "pending",
                createdAt: new Date(),
                respondedAt: null,
            });
        }

        ride.status = "negotiating";
        await ride.save();

        const updatedRide = await rideModel
            .findById(ride._id)
            .populate("user", "fullname email socketId")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        emitToUser(updatedRide.user, {
            event: "ride-offer-updated",
            data: updatedRide,
        });

        return res.status(200).json(updatedRide);
    } catch (err) {
        console.error("Error en captainOfferRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

// NUEVO: usuario acepta o rechaza una oferta del conductor
module.exports.userRespondToCaptainOffer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, captainId, action } = req.body;

    try {
        const ride = await rideModel
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

        const offerIndex = ride.driverOffers.findIndex(
            (offer) => String(offer.captain?._id || offer.captain) === String(captainId)
        );

        if (offerIndex < 0) {
            return res.status(404).json({ message: "Oferta del conductor no encontrada." });
        }

        const selectedOffer = ride.driverOffers[offerIndex];

        if (action === "rejected") {
            selectedOffer.status = "rejected";
            selectedOffer.respondedAt = new Date();
            await ride.save();

            const populatedRide = await rideModel
                .findById(ride._id)
                .populate("user", "fullname email socketId")
                .populate("driverOffers.captain", "fullname email vehicle socketId");

            const targetCaptain = populatedRide.driverOffers.find(
                (offer) =>
                    String(offer.captain?._id || offer.captain) === String(captainId)
            )?.captain;

            emitToCaptain(targetCaptain, {
                event: "ride-offer-rejected",
                data: populatedRide,
            });

            return res.status(200).json(populatedRide);
        }

        // accepted
        if (ride.negotiationStatus !== "open") {
            return res.status(400).json({
                message: "La negociación ya fue cerrada.",
            });
        }

        ride.selectedOfferCaptain = captainId;
        ride.captain = captainId;
        ride.fare = Number(selectedOffer.price);
        ride.negotiationStatus = "closed";
        ride.status = "accepted";

        ride.driverOffers = ride.driverOffers.map((offer) => {
            const isTarget =
                String(offer.captain?._id || offer.captain) === String(captainId);

            return {
                ...offer.toObject(),
                status: isTarget ? "accepted" : "rejected",
                respondedAt: new Date(),
            };
        });

        await ride.save();

        const populatedRide = await rideModel
            .findById(ride._id)
            .populate("user")
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        const acceptedCaptain = populatedRide.captain;

        emitToCaptain(acceptedCaptain, {
            event: "ride-offer-accepted",
            data: populatedRide,
        });

        // Notificar a los demás conductores rechazados
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
        console.error("Error en userRespondToCaptainOffer:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

// NUEVO: ride activo del usuario
module.exports.getMyActiveRide = async (req, res) => {
    try {
        const ride = await rideModel
            .findOne({
                user: req.user._id,
                status: {
                    $in: ["pending", "negotiating", "accepted", "ongoing"],
                },
            })
            .sort({ createdAt: -1 })
            .populate("captain")
            .populate("driverOffers.captain", "fullname email vehicle socketId");

        return res.status(200).json({ ride: ride || null });
    } catch (err) {
        console.error("Error en getMyActiveRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

// NUEVO: ver ofertas de un ride
module.exports.getRideOffers = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const ride = await rideModel
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

        return res.status(200).json({
            rideId: ride._id,
            status: ride.status,
            negotiationStatus: ride.negotiationStatus,
            offeredFare: ride.offeredFare,
            fare: ride.fare,
            driverOffers: ride.driverOffers || [],
            captain: ride.captain || null,
        });
    } catch (err) {
        console.error("Error en getRideOffers:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

// Compatibilidad: ahora confirm solo funciona si el usuario ya eligió ese captain
module.exports.confirmRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("[ride] confirmRide validation errors:", errors.array());
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

        console.log("[ride] ride-confirmed emit:", {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: "ride-confirmed",
            data: ride,
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error("Error en confirmRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.startRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("[ride] startRide validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, otp } = req.query;

    try {
        const ride = await rideService.startRide({
            rideId,
            otp,
            captain: req.captain,
        });

        console.log("[ride] ride-started emit:", {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: "ride-started",
            data: ride,
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error("Error en startRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.endRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("[ride] endRide validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.endRide({
            rideId,
            captain: req.captain,
        });

        console.log("[ride] ride-ended emit:", {
            rideId: safeId(ride?._id),
            userSocketId: ride?.user?.socketId || null,
            captainId: safeId(req.captain?._id),
        });

        sendMessageToSocketId(ride.user.socketId, {
            event: "ride-ended",
            data: ride,
        });

        return res.status(200).json(ride);
    } catch (err) {
        console.error("Error en endRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};

module.exports.cancelRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("[ride] cancelRide validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { rideId } = req.body;

    try {
        const ride = await rideService.cancelRide({
            rideId,
            user: req.user,
        });

        console.log("[ride] ride cancelled:", {
            rideId: safeId(ride?._id),
            userId: safeId(req.user?._id),
        });

        return res.status(200).json({
            message: "Solicitud cancelada correctamente",
            ride,
        });
    } catch (err) {
        console.error("Error en cancelRide:", err);
        return res.status(500).json({
            message: err.message || "Error interno del servidor",
        });
    }
};
