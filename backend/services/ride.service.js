const rideModel = require("../models/ride.model");
const mapService = require("../services/maps.service");
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

    // Tarifas pensadas para COP
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

module.exports.getFare = getFare;

module.exports.createRide = async ({ user, pickup, destination, vehicle }) => {
    if (!user || !pickup || !destination || !vehicle) {
        throw new Error("All fields are required");
    }

    try {
        const latestUser = await userModel.findById(user._id);
        const fares = await getFare(pickup, destination);

        const ride = new rideModel({
            user: latestUser,
            pickup: pickup,
            destination: destination,
            otp: getOtp(6),
            fare: fares[vehicle],
            vehicle: vehicle,
        });

        await ride.save();
        return ride;
    } catch (error) {
        console.error("Error creating ride:", error);
        throw new Error("Failed to create ride: " + error.message);
    }
};

module.exports.confirmRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("Ride id is required");
    }

    await rideModel.findOneAndUpdate(
        { _id: rideId },
        {
            status: "accepted",
            captain: captain._id,
        }
    );

    const ride = await rideModel.findOne({ _id: rideId })
        .populate("user")
        .populate("captain")
        .select("+otp");

    if (!ride) {
        throw new Error("Ride not found");
    }

    const latestUser = await userModel.findById(ride.user._id);
    ride.user = latestUser;

    return ride;
};

module.exports.startRide = async ({ rideId, otp, captain }) => {
    if (!rideId || !otp) {
        throw new Error("Ride id and OTP are required");
    }

    const ride = await rideModel.findOne({ _id: rideId })
        .populate("user")
        .populate("captain")
        .select("+otp");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (ride.status !== "accepted") {
        throw new Error("Ride not accepted");
    }

    if (ride.otp !== otp) {
        throw new Error("Invalid OTP");
    }

    const latestUser = await userModel.findById(ride.user._id);
    ride.user = latestUser;

    await rideModel.findOneAndUpdate(
        { _id: rideId },
        {
            status: "ongoing",
        }
    );

    return ride;
};

module.exports.endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error("Ride id is required");
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        captain: captain._id,
    })
        .populate("user")
        .populate("captain")
        .select("+otp");

    if (!ride) {
        throw new Error("Ride not found"); 
    }

    if (ride.status !== "ongoing") {
        throw new Error("Ride not ongoing");
    }

    const latestUser = await userModel.findById(ride.user._id);
    ride.user = latestUser;

    await rideModel.findOneAndUpdate(
        { _id: rideId },
        {
            status: "completed",
        }
    );

    return ride;
};
