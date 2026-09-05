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

        /*
         * Tipo de servicio.
         * Por ahora Central GO usa este flujo para domicilios y carga local.
         */
        serviceType: {
            type: String,
            enum: ["local_delivery"],
            default: "local_delivery",
            index: true,
        },

        /*
         * Tipo de remitente.
         * personal = envío de una persona.
         * business = envío solicitado por negocio o empresa.
         */
        senderType: {
            type: String,
            enum: ["personal", "business"],
            default: "personal",
            index: true,
        },

        /*
         * Momento del servicio:
         * now       = se necesita lo antes posible.
         * scheduled = se publica con anticipación para una fecha/hora futura.
         */
        serviceTiming: {
            type: String,
            enum: ["now", "scheduled"],
            default: "now",
            index: true,
        },

        /*
         * Programación de recogida.
         *
         * Ejemplo:
         * pickupStartAt = 2026-09-04 08:00
         * pickupEndAt   = 2026-09-04 09:00
         *
         * Para serviceTiming = "now" ambos pueden quedar null.
         */
        schedule: {
            pickupStartAt: {
                type: Date,
                default: null,
            },

            pickupEndAt: {
                type: Date,
                default: null,
            },

            timezone: {
                type: String,
                trim: true,
                default: "America/Bogota",
            },

            notes: {
                type: String,
                trim: true,
                maxlength: 300,
                default: "",
            },
        },

        /*
         * Información de la mercancía.
         */
        cargo: {
            category: {
                type: String,
                enum: [
                    "market",
                    "boxes",
                    "packages",
                    "sacks",
                    "baskets",
                    "general_merchandise",
                    "other",
                ],
                default: "packages",
            },

            quantity: {
                type: Number,
                min: 1,
                default: 1,
            },

            approximateWeight: {
                type: Number,
                min: 0,
                default: null,
            },

            weightUnit: {
                type: String,
                enum: ["kg", "lb"],
                default: "kg",
            },

            weightUnknown: {
                type: Boolean,
                default: false,
            },

            description: {
                type: String,
                trim: true,
                maxlength: 300,
                default: "",
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

        /*
         * Para domicilios programados:
         * aceptar la oferta NO significa que el conductor ya va en camino.
         * Este campo se llena únicamente cuando el conductor toca
         * "Iniciar domicilio".
         */
        scheduledDispatchStartedAt: {
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

/*
 * Índices para recalcular reputación de usuario y conductor.
 * Solo se usan valoraciones de servicios completados.
 */
rideSchema.index({
    captain: 1,
    status: 1,
    cancelledAt: 1,
    "userRatingToCaptain.rating": 1,
});

rideSchema.index({
    user: 1,
    status: 1,
    cancelledAt: 1,
    "captainRatingToUser.rating": 1,
});


/*
 * Índices útiles para filtrar solicitudes
 * de persona/empresa y servicios locales.
 */
rideSchema.index({ serviceType: 1, status: 1, createdAt: -1 });
rideSchema.index({ senderType: 1, status: 1, createdAt: -1 });

/*
 * Índices para servicios programados.
 * Permiten encontrar rápidamente servicios futuros por fecha de recogida.
 */
rideSchema.index({
    serviceTiming: 1,
    "schedule.pickupStartAt": 1,
    status: 1,
});

rideSchema.index({
    status: 1,
    negotiationStatus: 1,
    serviceTiming: 1,
    "schedule.pickupStartAt": 1,
});

const rideModel = mongoose.model("Ride", rideSchema);

module.exports = rideModel;
