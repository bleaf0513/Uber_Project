const rideModel = require("../models/ride.model");
const captainModel = require("../models/captain.model");
const mapService = require("./maps.service");
const crypto = require("crypto");
const userModel = require("../models/user.model");

const OFFER_TTL_MS = 60000;

function getOtp(num) {
    function generateOtp(size) {
        return crypto
            .randomInt(Math.pow(10, size - 1), Math.pow(10, size))
            .toString();
    }

    return generateOtp(num);
}

function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function roundToHundred(value) {
    const number = Number(value) || 0;
    return Math.ceil(number / 100) * 100;
}

function normalizeRouteStops(routeStops) {
    if (!routeStops) return [];

    if (Array.isArray(routeStops)) {
        return routeStops
            .map((stop) => String(stop || "").trim())
            .filter(Boolean);
    }

    return String(routeStops)
        .split("|")
        .map((stop) => stop.trim())
        .filter(Boolean);
}

function getOfferExpiresAt(offer) {
    if (offer?.expiresAt) {
        const expiresAt = new Date(offer.expiresAt).getTime();
        if (Number.isFinite(expiresAt)) return expiresAt;
    }

    const createdAt = offer?.createdAt
        ? new Date(offer.createdAt).getTime()
        : Date.now();

    return createdAt + OFFER_TTL_MS;
}

function isOfferExpired(offer, now = Date.now()) {
    return getOfferExpiresAt(offer) <= now;
}

function getActiveDriverOffers(ride, now = Date.now()) {
    return (ride?.driverOffers || []).filter((offer) => {
        return offer?.status === "pending" && !isOfferExpired(offer, now);
    });
}

function normalizeOffer(offer) {
    if (!offer) return offer;
    return typeof offer.toObject === "function" ? offer.toObject() : { ...offer };
}

function normalizeDistanceToKm(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return 0;
    }

    if (number > 300) {
        return Number((number / 1000).toFixed(2));
    }

    return Number(number.toFixed(2));
}

async function expirePendingOffers(ride, now = Date.now()) {
    if (!ride?._id) return false;

    const currentRide = await rideModel.findById(ride._id);
    if (!currentRide) return false;

    const currentOffers = (currentRide.driverOffers || []).map(normalizeOffer);

    let changed = false;

    const updatedOffers = currentOffers.map((offer) => {
        const nextOffer = { ...offer };

        if (!nextOffer.expiresAt) {
            nextOffer.expiresAt = new Date(getOfferExpiresAt(nextOffer));
            changed = true;
        }

        if (nextOffer.status === "pending" && isOfferExpired(nextOffer, now)) {
            nextOffer.status = "expired";
            nextOffer.respondedAt = nextOffer.respondedAt || new Date(now);
            changed = true;
        }

        return nextOffer;
    });

    const activeOffers = updatedOffers.filter(
        (offer) => offer?.status === "pending" && !isOfferExpired(offer, now)
    );

    const updateSet = {
        driverOffers: updatedOffers,
    };

    if (
        currentRide.negotiationStatus === "open" &&
        currentRide.status === "negotiating" &&
        activeOffers.length === 0
    ) {
        updateSet.status = "pending";
        changed = true;
    }

    if (!changed) return false;

    await rideModel.updateOne(
        { _id: currentRide._id },
        {
            $set: updateSet,
        }
    );

    return true;
}

/**
 * Tarifas base realistas para Medellín / área metropolitana.
 *
 * Fórmula:
 * tarifa = base + (km * precioPorKm) + (minutos * precioPorMin)
 *
 * Luego:
 * - se aplica mínimo
 * - se redondea a centenas
 */
const FARE_RULES = {
    motorcycle: {
        base: 3200,
        perKm: 850,
        perMin: 70,
        minimum: 5500,
    },
    car: {
        base: 4800,
        perKm: 1150,
        perMin: 105,
        minimum: 7500,
    },
    light_cargo: {
        base: 6200,
        perKm: 1350,
        perMin: 125,
        minimum: 9500,
    },
    van: {
        base: 11000,
        perKm: 2100,
        perMin: 170,
        minimum: 18000,
    },
    truck: {
        base: 18000,
        perKm: 3100,
        perMin: 240,
        minimum: 30000,
    },
    motocarro: {
        base: 4500,
        perKm: 1100,
        perMin: 95,
        minimum: 7000,
    },
    pickup: {
        base: 9000,
        perKm: 1900,
        perMin: 160,
        minimum: 16000,
    },
    moving: {
        base: 22000,
        perKm: 3400,
        perMin: 280,
        minimum: 38000,
    },
};

const getFare = async (pickup, destination, routeStops = []) => {
    if (!pickup || !destination) {
        throw new Error("pickup and destination are required");
    }

    const stops = normalizeRouteStops(routeStops);

    /*
     * IMPORTANTE:
     * Esta es la ÚNICA llamada a mapService.getDistance para calcular tarifa.
     *
     * Antes createRide volvía a llamar mapService.getDistance otra vez,
     * duplicando consumo de Distance Matrix / Directions.
     *
     * Ahora devolvemos la metadata en fares.meta y createRide reutiliza esa info.
     */
    const distanceTime = await mapService.getDistance(pickup, destination, stops);

    const meters = Number(distanceTime?.distance?.value);
    const seconds = Number(distanceTime?.duration?.value);

    if (!Number.isFinite(meters) || !Number.isFinite(seconds)) {
        throw new Error("Could not compute fare for this route");
    }

    const distanceKm = meters / 1000;
    const durationMin = seconds / 60;

    const fares = {};

    Object.entries(FARE_RULES).forEach(([vehicleType, rule]) => {
        const calculatedFare =
            rule.base +
            rule.perKm * distanceKm +
            rule.perMin * durationMin;

        const finalFare = Math.max(calculatedFare, rule.minimum);

        fares[vehicleType] = roundToHundred(finalFare);
    });

    fares.meta = {
        distanceMeters: meters,
        durationSeconds: seconds,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Math.max(1, Math.round(durationMin)),
        stopsCount: stops.length,
        formula: "base + km + minutes",
        distanceSource: distanceTime?.source || null,
        rawDistance: distanceTime?.distance || null,
        rawDuration: distanceTime?.duration || null,
    };

    return fares;
};

const getMinOfferByVehicle = (vehicle, suggestedFare) => {
    const safeSuggested = Number(suggestedFare) || 0;

    const factors = {
        motorcycle: 0.85,
        car: 0.85,
        light_cargo: 0.85,
        van: 0.9,
        truck: 0.9,
        motocarro: 0.85,
        pickup: 0.9,
        moving: 0.9,
    };

    const factor = factors[vehicle] ?? 0.85;

    return roundToHundred(Math.max(1, safeSuggested * factor));
};

const createRide = async ({
    user,
    pickup,
    destination,
    routeStops = [],
    vehicle,
    offeredFare,
}) => {
    if (!user || !pickup || !destination || !vehicle) {
        throw new Error("All fields are required");
    }

    const stops = normalizeRouteStops(routeStops);

    const latestUser = await userModel.findById(user._id || user);

    if (!latestUser) {
        throw new Error("User not found");
    }

    /*
     * HOTFIX ANTI-CONSUMO GOOGLE:
     *
     * getFare ya calcula distancia y duración usando mapService.getDistance.
     * No volvemos a llamar mapService.getDistance aquí.
     */
    const fares = await getFare(pickup, destination, stops);

    if (!Object.prototype.hasOwnProperty.call(fares, vehicle)) {
        throw new Error("Invalid vehicle type");
    }

    const suggestedFare = Number(fares[vehicle]) || 0;
    const minOffer = getMinOfferByVehicle(vehicle, suggestedFare);

    let finalFare = suggestedFare;

    if (offeredFare !== undefined && offeredFare !== null && offeredFare !== "") {
        const parsedOffer = Number(offeredFare);

        if (!Number.isFinite(parsedOffer) || parsedOffer <= 0) {
            throw new Error("Invalid offered fare");
        }

        if (parsedOffer < minOffer) {
            throw new Error(`La oferta mínima para este servicio es ${minOffer}`);
        }

        finalFare = roundToHundred(parsedOffer);
    }

    const meters = Number(fares?.meta?.distanceMeters);
    const seconds = Number(fares?.meta?.durationSeconds);

    const ridePayload = {
        user: latestUser._id,
        pickup,
        destination,
        otp: getOtp(4),
        suggestedFare,
        offeredFare: finalFare,
        fare: finalFare,
        vehicleType: vehicle,
        distance: Number.isFinite(meters) ? meters : null,
        duration: Number.isFinite(seconds) ? seconds : null,
        driverOffers: [],
        negotiationStatus: "open",
        status: "pending",
        arrivedAtPickup: false,
        arrivedAtPickupAt: null,
        cancelledBy: null,
        cancelReason: "",
        cancelNotes: "",
        cancelledAt: null,

        completedAt: null,
        startedAt: null,
        userRating: null,
        captainRating: null,
    };

    /*
     * Si ride.model.js ya tiene routeStops en el schema, se guarda.
     * Si todavía no lo tiene, Mongoose lo puede ignorar según strict mode.
     */
    if (stops.length > 0) {
        ridePayload.routeStops = stops;
    }

    const ride = await rideModel.create(ridePayload);

    return ride;
};

const confirmRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    const updateResult = await rideModel.updateOne(
        {
            _id: rideId,
            selectedOfferCaptain: captain._id,
            status: { $in: ["accepted", "arrived", "ongoing"] },
            cancelledAt: null,
        },
        {
            $set: {
                captain: captain._id,
            },
        }
    );

    if (!updateResult.matchedCount) {
        throw new Error("Ride not found or not assigned to this captain");
    }

    const ride = await rideModel
        .findOne({ _id: rideId })
        .populate("user")
        .populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    return ride;
};

const startRide = async ({ rideId, otp, captain }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    const query = {
        _id: rideId,
        captain: captain._id,
        status: { $in: ["accepted", "arrived"] },
        cancelledAt: null,
    };

    if (otp) {
        query.otp = otp;
    }

    const updatedRide = await rideModel
        .findOneAndUpdate(
            query,
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
        throw new Error("Ride could not be started");
    }

    return updatedRide;
};

const endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    const updatedRide = await rideModel
        .findOneAndUpdate(
            {
                _id: rideId,
                captain: captain._id,
                status: { $in: ["accepted", "arrived", "ongoing"] },
                cancelledAt: null,
            },
            {
                $set: {
                    status: "completed",
                    negotiationStatus: "closed",
                    completedAt: new Date(),
                },
            },
            {
                new: true,
            }
        )
        .populate("user")
        .populate("captain");

    if (!updatedRide) {
        throw new Error("Ride not found or cannot be completed");
    }

    const fareValue = safeNumber(updatedRide.fare, 0);
    const distanceKm = normalizeDistanceToKm(updatedRide.distance);

    await captainModel.findByIdAndUpdate(
        captain._id,
        {
            $inc: {
                "stats.totalEarning": fareValue,
                "stats.totalDistanceKm": distanceKm,
                "stats.totalTrips": 1,
            },
        },
        { new: true }
    );

    return updatedRide;
};

const cancelRide = async ({ rideId, user }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    let ride = await rideModel
        .findOne({
            _id: rideId,
            user: user._id || user,
        })
        .populate("user")
        .populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    await expirePendingOffers(ride);

    ride = await rideModel
        .findOne({
            _id: rideId,
            user: user._id || user,
        })
        .populate("user")
        .populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (!["pending", "negotiating"].includes(ride.status)) {
        throw new Error("Solo se pueden cancelar solicitudes en búsqueda u oferta");
    }

    const updatedOffers = (ride.driverOffers || []).map((offer) => {
        const current = normalizeOffer(offer);

        if (current.status === "pending") {
            return {
                ...current,
                status: "withdrawn",
                respondedAt: new Date(),
            };
        }

        return current;
    });

    const updateResult = await rideModel.updateOne(
        {
            _id: rideId,
            user: user._id || user,
            status: { $in: ["pending", "negotiating"] },
        },
        {
            $set: {
                status: "cancelled",
                negotiationStatus: "closed",
                cancelledBy: "user",
                cancelReason: "Cancelado por el usuario",
                cancelNotes: "",
                cancelledAt: new Date(),
                driverOffers: updatedOffers,
            },
        }
    );

    if (!updateResult.matchedCount) {
        throw new Error("La solicitud cambió de estado y no se pudo cancelar");
    }

    const updatedRide = await rideModel
        .findOne({
            _id: rideId,
            user: user._id || user,
        })
        .populate("user")
        .populate("captain");

    if (!updatedRide) {
        throw new Error("Ride not found");
    }

    return updatedRide;
};

module.exports = {
    OFFER_TTL_MS,
    getFare,
    createRide,
    confirmRide,
    startRide,
    endRide,
    cancelRide,
    expirePendingOffers,
    getActiveDriverOffers,
    isOfferExpired,
    getOfferExpiresAt,
};