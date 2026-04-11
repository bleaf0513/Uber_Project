const mongoose = require("mongoose");

const GOODS_UNITS = [
    "kg",
    "gramos",
    "libras",
    "bultos",
    "pacas",
    "cajas",
    "canastillas",
    "toneladas",
    "unidades",
];

const GOODS_PRICE_TYPES = [
    "por_kg",
    "por_gramo",
    "por_libra",
    "por_bulto",
    "por_paca",
    "por_caja",
    "por_canastilla",
    "por_tonelada",
    "por_unidad",
    "precio_total",
];

const goodsOfferSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },
        productName: {
            type: String,
            required: true,
            trim: true,
        },
        quantityAvailable: {
            type: Number,
            required: true,
            min: 0,
        },
        quantityUnit: {
            type: String,
            required: true,
            enum: GOODS_UNITS,
        },
        suggestedPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        priceType: {
            type: String,
            required: true,
            enum: GOODS_PRICE_TYPES,
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
            enum: ["active", "paused", "sold_out", "cancelled", "completed"],
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

const goodsOfferModel = mongoose.model("GoodsOffer", goodsOfferSchema);

module.exports = goodsOfferModel;
