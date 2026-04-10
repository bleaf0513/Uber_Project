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

const createRide = async ({ user, pickup, destination, vehicle }) => {
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

    const distanceTime = await mapService.getDistance(pickup, destination);
    const meters = distanceTime?.distance?.value;
    const seconds = distanceTime?.duration?.value;

    const ride = await rideModel.create({
        user: latestUser._id,
        pickup,
        destination,
        otp: getOtp(6),
        fare: fares[vehicle],
        vehicleType: vehicle,
        distance: Number.isFinite(meters) ? meters : null,
        duration: Number.isFinite(seconds) ? seconds : null,
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

    const ride = await rideModel.findOne({
        _id: rideId,
        otp: otp,
        captain: captain._id,
    })
        .populate("user")
        .populate("captain");

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
    })
        .populate("user")
        .populate("captain");

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

const cancelRide = async ({ rideId, user }) => {
    if (!rideId) {
        throw new Error("rideId is required");
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        user: user._id || user,
    }).populate("user").populate("captain");

    if (!ride) {
        throw new Error("Ride not found");
    }

    if (ride.status !== "pending") {
        throw new Error("Only pending rides can be cancelled");
    }

    ride.status = "rejected";
    await ride.save();

    return ride;
};

module.exports = {
    getFare,
    createRide,
    confirmRide,
    startRide,
    endRide,
    cancelRide,
};
