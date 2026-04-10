const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        pickup: {
            type: String,
            required: true,
            trim: true,
        },
        destination: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected", "completed"],
            default: "pending",
        },
        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            default: null,
        },
        vehicleType: {
            type: String,
            required: true,
            enum: [
                "motorcycle",
                "car",
                "light_cargo",
                "van",
                "truck",
            ],
        },
        fare: {
            type: Number,
            required: true,
            min: 0,
        },
        duration: {
            type: Number,
            default: null,
        },
        distance: {
            type: Number,
            default: null,
        },
        paymentId: {
            type: String,
            default: null,
        },
        orderId: {
            type: String,
            default: null,
        },
        signature: {
            type: String,
            default: null,
        },
        otp: {
            type: String,
            select: false,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const rideModel = mongoose.model("Ride", rideSchema);

module.exports = rideModel;
