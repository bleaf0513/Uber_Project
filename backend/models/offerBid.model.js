const mongoose = require("mongoose");

const BID_LISTING_TYPES = ["goods", "space", "seat"];

const BID_UNITS = [
    "kg",
    "gramos",
    "libras",
    "bultos",
    "pacas",
    "cajas",
    "canastillas",
    "toneladas",
    "unidades",
    "m3",
    "cupo",
    "cupos",
    "puesto",
    "puestos",
];

const offerBidSchema = new mongoose.Schema(
    {
        listingType: {
            type: String,
            required: true,
            enum: BID_LISTING_TYPES,
            index: true,
        },
        goodsOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GoodsOffer",
            default: null,
        },
        spaceOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SpaceOffer",
            default: null,
        },
        seatOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SeatOffer",
            default: null,
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },
        requestedQuantity: {
            type: Number,
            required: true,
            min: 0,
        },
        requestedUnit: {
            type: String,
            required: true,
            enum: BID_UNITS,
        },
        offeredPrice: {
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
            enum: [
                "pending",
                "accepted",
                "rejected",
                "countered",
                "cancelled",
                "completed",
            ],
            default: "pending",
            index: true,
        },
        counterPrice: {
            type: Number,
            default: null,
            min: 0,
        },
        counterMessage: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

offerBidSchema.pre("validate", function (next) {
    if (this.listingType === "goods" && !this.goodsOffer) {
        return next(new Error("goodsOffer es requerido cuando listingType es goods."));
    }

    if (this.listingType === "space" && !this.spaceOffer) {
        return next(new Error("spaceOffer es requerido cuando listingType es space."));
    }

    if (this.listingType === "seat" && !this.seatOffer) {
        return next(new Error("seatOffer es requerido cuando listingType es seat."));
    }

    next();
});

const offerBidModel = mongoose.model("OfferBid", offerBidSchema);

module.exports = offerBidModel;
