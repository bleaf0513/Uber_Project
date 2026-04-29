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

const getFare = async (pickup, destination) => {
    if (!pickup || !destination) {
        throw new Error("pickup and destination are required");
    }

    const distanceTime = await mapService.getDistance(pickup, destination);
    const meters = distanceTime?.distance?.value;
    const seconds = distanceTime?.duration?.value;

    if (!Number.isFinite(meters) || !Number.isFinite(seconds)) {
        throw new Error("Could not compute fare for this route");
    }

    const distanceKm = meters / 1000;
    const durationMin = seconds / 60;

    const baseFare = {
        motorcycle: 2200,
        car: 3500,
        light_cargo: 2800,
        van: 5500,
        truck: 9000,
    };

    const perKmRate = {
        motorcycle: 700,
        car: 1200,
        light_cargo: 900,
        van: 1800,
        truck: 2800,
    };

    const perMinuteRate = {
        motorcycle: 100,
        car: 180,
        light_cargo: 130,
        van: 220,
        truck: 320,
    };

    const minimumFare = {
        motorcycle: 3000,
        car: 5500,
        light_cargo: 4000,
        van: 8000,
        truck: 15000,
    };

    const fares = {
        motorcycle: Math.round(
            baseFare.motorcycle +
                perKmRate.motorcycle * distanceKm +
                perMinuteRate.motorcycle * durationMin
        ),
        car: Math.round(
            baseFare.car +
                perKmRate.car * distanceKm +
                perMinuteRate.car * durationMin
        ),
        light_cargo: Math.round(
            baseFare.light_cargo +
                perKmRate.light_cargo * distanceKm +
                perMinuteRate.light_cargo * durationMin
        ),
        van: Math.round(
            baseFare.van +
                perKmRate.van * distanceKm +
                perMinuteRate.van * durationMin
        ),
        truck: Math.round(
            baseFare.truck +
                perKmRate.truck * distanceKm +
                perMinuteRate.truck * durationMin
        ),
    };

    return {
        motorcycle: Math.max(fares.motorcycle, minimumFare.motorcycle),
        car: Math.max(fares.car, minimumFare.car),
        light_cargo: Math.max(fares.light_cargo, minimumFare.light_cargo),
        van: Math.max(fares.van, minimumFare.van),
        truck: Math.max(fares.truck, minimumFare.truck),
    };
};

const getMinOfferByVehicle = (vehicle, suggestedFare) => {
    const safeSuggested = Number(suggestedFare) || 0;

    const factors = {
        motorcycle: 0.85,
        car: 0.85,
        light_cargo: 0.85,
        van: 0.9,
        truck: 0.9,
    };

    const factor = factors[vehicle] ?? 0.85;
    return Math.max(1, Math.ceil(safeSuggested * factor));
};

const createRide = async ({ user, pickup, destination, vehicle, offeredFare }) => {
    if (!user || !pickup || !destination || !vehicle) {
        throw new Error("All fields are required");
    }

    const latestUser = await userModel.findById(user._id || user);

    if (!latestUser) {
        throw new Error("User not found");
    }

    const fares = await getFare(pickup, destination);

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

        finalFare = Math.ceil(parsedOffer);
    }

    const distanceTime = await mapService.getDistance(pickup, destination);
    const meters = distanceTime?.distance?.value;
    const seconds = distanceTime?.duration?.value;

    const ride = await rideModel.create({
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
    });

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

    const ride = await rideModel.findOne({ _id: rideId })
        .populate("user")
        .populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    return ride;
};

const startRide = async ({ rideId, otp, captain }) => {
    if (!rideId || !otp) {
        throw new Error("rideId and otp are required");
    }

    const rideBeforeStart = await rideModel.findOne({
        _id: rideId,
        otp: otp,
        captain: captain._id,
    });

    if (!rideBeforeStart) {
        throw new Error("Ride not found");
    }

    if (!["accepted", "arrived"].includes(rideBeforeStart.status)) {
        throw new Error("Ride not accepted");
    }

    const updatedRide = await rideModel.findOneAndUpdate(
        {
            _id: rideId,
            otp: otp,
            captain: captain._id,
            status: { $in: ["accepted", "arrived"] },
        },
        {
            $set: {
                status: "ongoing",
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

    const updatedRide = await rideModel.findOneAndUpdate(
        {
            _id: rideId,
            captain: captain._id,
            status: "ongoing",
        },
        {
            $set: {
                status: "completed",
            },
        },
        {
            new: true,
        }
    )
        .populate("user")
        .populate("captain");

    if (!updatedRide) {
        throw new Error("Ride not found or is not ongoing");
    }

    const fareValue = safeNumber(updatedRide.fare, 0);
    const distanceMeters = safeNumber(updatedRide.distance, 0);
    const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : 0;

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

    let ride = await rideModel.findOne({
        _id: rideId,
        user: user._id || user,
    })
        .populate("user")
        .populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    await expirePendingOffers(ride);

    ride = await rideModel.findOne({
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

    const updatedRide = await rideModel.findOne({
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