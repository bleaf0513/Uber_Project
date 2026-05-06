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
            default: () => new Date(Date.now() + 60000),
        },
        respondedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: true }
);

const ratingSchema = new mongoose.Schema(
    {
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        comment: {
            type: String,
            trim: true,
            default: "",
        },
        ratedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

const rideSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
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

        /*
         * Paradas intermedias del recorrido.
         * Esto es clave para que el conductor vea:
         * recogida -> parada 1 -> parada 2 -> destino final.
         */
        routeStops: {
            type: [String],
            default: [],
            set: (stops) => {
                if (!stops) return [];

                if (Array.isArray(stops)) {
                    return stops
                        .map((stop) => String(stop || "").trim())
                        .filter(Boolean);
                }

                return String(stops)
                    .split("|")
                    .map((stop) => stop.trim())
                    .filter(Boolean);
            },
        },

        status: {
            type: String,
            enum: [
                "pending",
                "negotiating",
                "accepted",
                "arrived",
                "ongoing",
                "completed",
                "cancelled",
                "rejected",
            ],
            default: "pending",
            index: true,
        },

        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            default: null,
            index: true,
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
                "motocarro",
                "pickup",
                "moving",
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

        /*
         * Duración total en segundos.
         * Debe venir desde Google Maps incluyendo paradas.
         */
        duration: {
            type: Number,
            default: null,
        },

        /*
         * Distancia total en metros.
         * En frontend siempre se debe mostrar como distance / 1000.
         */
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

        paymentMethod: {
            type: String,
            trim: true,
            default: "",
        },

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

        arrivedAtPickup: {
            type: Boolean,
            default: false,
        },

        arrivedAtPickupAt: {
            type: Date,
            default: null,
        },

        userConfirmedAtPickup: {
            type: Boolean,
            default: false,
        },

        userConfirmedAtPickupAt: {
            type: Date,
            default: null,
        },

        startedAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        userRatingToCaptain: {
            type: ratingSchema,
            default: () => ({
                rating: null,
                comment: "",
                ratedAt: null,
            }),
        },

        captainRatingToUser: {
            type: ratingSchema,
            default: () => ({
                rating: null,
                comment: "",
                ratedAt: null,
            }),
        },

        cancelledBy: {
            type: String,
            enum: ["user", "captain", "system", null],
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

rideSchema.index({ captain: 1, status: 1, updatedAt: -1 });
rideSchema.index({ user: 1, status: 1, updatedAt: -1 });
rideSchema.index({ status: 1, negotiationStatus: 1, createdAt: -1 });
rideSchema.index({ user: 1, negotiationStatus: 1, status: 1, updatedAt: -1 });

const rideModel = mongoose.model("Ride", rideSchema);

module.exports = rideModel;