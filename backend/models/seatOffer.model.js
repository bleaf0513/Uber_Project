const mongoose = require("mongoose");

const SEAT_UNITS = ["cupo", "cupos", "puesto", "puestos"];

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
        stops: [
            {
                type: String,
                trim: true,
            },
        ],
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
            enum: ["motorcycle", "car", "light_cargo", "van", "truck"],
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

const seatOfferModel = mongoose.model("SeatOffer", seatOfferSchema);

module.exports = seatOfferModel;
