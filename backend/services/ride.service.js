const rideModel = require("../models/ride.model");
const mapService = require("./maps.service");
const crypto = require("crypto");
const userModel = require("../models/user.model");

function getOtp(num) {
    function generateOtp(num) {
        return crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
    }
    return generateOtp(num);
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
        car: 3500,
        moto: 2200,
        auto: 2800,
    };

    const perKmRate = {
        car: 1200,
        moto: 700,
        auto: 900,
    };

    const perMinuteRate = {
        car: 180,
        moto: 100,
        auto: 130,
    };

    const minimumFare = {
        car: 5500,
        moto: 3000,
        auto: 4000,
    };

    const fares = {
        car: Math.round(
            baseFare.car +
            perKmRate.car * distanceKm +
            perMinuteRate.car * durationMin
        ),
        moto: Math.round(
            baseFare.moto +
            perKmRate.moto * distanceKm +
            perMinuteRate.moto * durationMin
        ),
        auto: Math.round(
            baseFare.auto +
            perKmRate.auto * distanceKm +
            perMinuteRate.auto * durationMin
        ),
    };

    return {
        car: Math.max(fares.car, minimumFare.car),
        moto: Math.max(fares.moto, minimumFare.moto),
        auto: Math.max(fares.auto, minimumFare.auto),
    };
};

const createRide = async ({ user, pickup, destination, vehicle }) => {
    if (!user || !pickup || !destination || !vehicle) {
        throw new Error("All fields are required");
    }

    const latestUser = await userModel.findById(user._id || user);

    if (!latestUser) {
        throw new Error("User not found");
    }

    const fares = await getFare(pickup, destination);

    const ride = await rideModel.create({
        user: latestUser._id,
        pickup,
        destination,
        otp: getOtp(6),
        fare: fares[vehicle],
        vehicle,
    });

    return ride;
};

const confirmRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    await rideModel.findOneAndUpdate(
        { _id: rideId },
        {
            status: "accepted",
            captain: captain._id,
        }
    );

    const ride = await rideModel.findOne({ _id: rideId }).populate("user").populate("captain");
    if (!ride) {
        throw new Error("Ride not found");
    }

    return ride;
};

const startRide = async ({ rideId, otp, captain }) => {
    if (!rideId || !otp) {
        throw new Error("rideId and otp are required");
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        otp: otp,
        captain: captain._id,
    }).populate("user").populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (ride.status !== "accepted") {
        throw new Error("Ride not accepted");
    }

    ride.status = "ongoing";
    await ride.save();

    return ride;
};

const endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        captain: captain._id,
    }).populate("user").populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (ride.status !== "ongoing") {
        throw new Error("Ride is not ongoing");
    }

    ride.status = "completed";
    await ride.save();

    return ride;
};

module.exports = {
    getFare,
    createRide,
    confirmRide,
    startRide,
    endRide,
};
