const mongoose = require("mongoose");

const SPACE_UNITS = [
    "kg",
    "libras",
    "toneladas",
    "bultos",
    "pacas",
    "cajas",
    "canastillas",
    "m3",
    "espacio_parcial",
    "vehiculo_completo",
];

const SPACE_PRICE_TYPES = [
    "por_kg",
    "por_libra",
    "por_tonelada",
    "por_bulto",
    "por_paca",
    "por_caja",
    "por_canastilla",
    "por_m3",
    "precio_total",
];

const spaceOfferSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },
        capacityAvailable: {
            type: Number,
            required: true,
            min: 0,
        },
        capacityUnit: {
            type: String,
            required: true,
            enum: SPACE_UNITS,
        },
        cargoType: {
            type: String,
            trim: true,
            default: "",
        },
        suggestedPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        priceType: {
            type: String,
            required: true,
            enum: SPACE_PRICE_TYPES,
        },
        origin: {
            type: String,
            required: true,
            trim: true,
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
            enum: ["active", "paused", "reserved", "cancelled", "completed"],
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

const spaceOfferModel = mongoose.model("SpaceOffer", spaceOfferSchema);

module.exports = spaceOfferModel;
