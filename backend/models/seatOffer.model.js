const mongoose = require("mongoose");

const SEAT_UNITS = ["cupo", "cupos", "puesto", "puestos"];

const VEHICLE_TYPES = [
    "motorcycle",
    "car",
    "light_cargo",
    "van",
    "truck",
    "motocarro",
    "pickup",
    "moving",
];

const seatOfferSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },

        seatsAvailable: {
            type: Number,
            required: true,
            min: 1,
        },

        seatUnit: {
            type: String,
            required: true,
            enum: SEAT_UNITS,
            default: "cupos",
        },

        suggestedPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        origin: {
            type: String,
            required: true,
            trim: true,
        },

        stops: {
            type: [
                {
                    type: String,
                    trim: true,
                },
            ],
            default: [],
        },

        destination: {
            type: String,
            required: true,
            trim: true,
        },

        departureTime: {
            type: Date,
            default: null,
        },

        vehicleType: {
            type: String,
            enum: VEHICLE_TYPES,
            default: null,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        notes: {
            type: String,
            trim: true,
            default: "",
        },

        status: {
            type: String,
            enum: ["active", "paused", "full", "cancelled", "completed"],
            default: "active",
            index: true,
        },

        isNegotiable: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

seatOfferSchema.index({ driver: 1, status: 1, createdAt: -1 });
seatOfferSchema.index({ origin: 1, destination: 1, status: 1 });
seatOfferSchema.index({ vehicleType: 1, status: 1 });

const seatOfferModel = mongoose.model("SeatOffer", seatOfferSchema);

module.exports = seatOfferModel;