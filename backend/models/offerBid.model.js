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

const BID_STATUS = [
    "pending",
    "accepted",
    "rejected",
    "countered",
    "cancelled",
    "completed",
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
            index: true,
        },

        spaceOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SpaceOffer",
            default: null,
            index: true,
        },

        seatOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SeatOffer",
            default: null,
            index: true,
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
            enum: BID_STATUS,
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

        respondedAt: {
            type: Date,
            default: null,
        },

        acceptedAt: {
            type: Date,
            default: null,
        },

        rejectedAt: {
            type: Date,
            default: null,
        },

        counteredAt: {
            type: Date,
            default: null,
        },

        cancelledAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        /*
         * Control de notificaciones push.
         * Esto nos sirve para evitar duplicar notificaciones
         * si el endpoint se reintenta o si Render repite una petición.
         */
        notifications: {
            bidCreatedSentAt: {
                type: Date,
                default: null,
            },
            bidAcceptedSentAt: {
                type: Date,
                default: null,
            },
            bidRejectedSentAt: {
                type: Date,
                default: null,
            },
            bidCounteredSentAt: {
                type: Date,
                default: null,
            },
            bidCancelledSentAt: {
                type: Date,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

offerBidSchema.pre("validate", function (next) {
    if (this.listingType === "goods" && !this.goodsOffer) {
        return next(
            new Error("goodsOffer es requerido cuando listingType es goods.")
        );
    }

    if (this.listingType === "space" && !this.spaceOffer) {
        return next(
            new Error("spaceOffer es requerido cuando listingType es space.")
        );
    }

    if (this.listingType === "seat" && !this.seatOffer) {
        return next(
            new Error("seatOffer es requerido cuando listingType es seat.")
        );
    }

    next();
});

offerBidSchema.index({ driver: 1, status: 1, createdAt: -1 });
offerBidSchema.index({ customer: 1, status: 1, createdAt: -1 });
offerBidSchema.index({ listingType: 1, status: 1, createdAt: -1 });
offerBidSchema.index({ goodsOffer: 1, status: 1, createdAt: -1 });
offerBidSchema.index({ spaceOffer: 1, status: 1, createdAt: -1 });
offerBidSchema.index({ seatOffer: 1, status: 1, createdAt: -1 });

const offerBidModel = mongoose.model("OfferBid", offerBidSchema);

module.exports = offerBidModel;