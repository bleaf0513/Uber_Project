const mongoose = require("mongoose");

const driverOfferSchema = new mongoose.Schema(
    {
        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        message: {
            type: String,
            trim: true,
            default: "",
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected", "withdrawn", "expired"],
            default: "pending",
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 10000),
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: true }
);

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
            enum: [
                "pending",
                "negotiating",
                "accepted",
                "rejected",
                "ongoing",
                "completed",
                "cancelled",
            ],
            default: "pending",
            index: true,
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
        suggestedFare: {
            type: Number,
            required: true,
            min: 0,
        },
        offeredFare: {
            type: Number,
            required: true,
            min: 0,
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

        // Se deja opcional solo por compatibilidad con partes antiguas.
        otp: {
            type: String,
            select: false,
            default: null,
        },

        driverOffers: {
            type: [driverOfferSchema],
            default: [],
        },
        selectedOfferCaptain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            default: null,
        },
        negotiationStatus: {
            type: String,
            enum: ["open", "driver_selected", "closed"],
            default: "open",
            index: true,
        },

        // NUEVO: llegada al punto de recogida
        arrivedAtPickup: {
            type: Boolean,
            default: false,
        },
        arrivedAtPickupAt: {
            type: Date,
            default: null,
        },

        // NUEVO: cancelación auditada
        cancelledBy: {
            type: String,
            enum: ["user", "captain", null],
            default: null,
        },
        cancelReason: {
            type: String,
            trim: true,
            default: "",
        },
        cancelNotes: {
            type: String,
            trim: true,
            default: "",
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const rideModel = mongoose.model("Ride", rideSchema);

module.exports = rideModel;