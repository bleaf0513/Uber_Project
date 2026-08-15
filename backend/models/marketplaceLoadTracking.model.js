const mongoose = require("mongoose");

/*
 * =========================================================
 * SEGUIMIENTO PROFESIONAL DE CARGAS DEL MARKETPLACE
 * =========================================================
 *
 * Este modelo pertenece únicamente al marketplace de cargas.
 *
 * NO reemplaza ni modifica:
 * - EnterpriseDriver
 * - EnterpriseDelivery
 * - EnterpriseDriverShift
 * - EnterpriseDriverRoutePoint
 *
 * Su función es conectar:
 * - La carga publicada
 * - La propuesta aceptada
 * - El usuario propietario
 * - El conductor captain seleccionado
 * - El seguimiento GPS opcional
 */

const TRACKING_PLANS = [
    "basic",
    "professional",
];

const TRACKING_STATUSES = [
    "pending_confirmation",
    "awaiting_reservation",
    "confirmed",
    "driver_heading_to_pickup",
    "arrived_at_pickup",
    "loading",
    "picked_up",
    "in_transit",
    "near_destination",
    "arrived_at_destination",
    "unloading",
    "delivered",
    "completed",
    "cancelled",
    "disputed",
];

const COMMISSION_STATUSES = [
    "pending",
    "reserved",
    "paid",
    "cancelled",
    "refunded",
    "disputed",
];

const PAYMENT_STATUSES = [
    "pending",
    "partially_paid",
    "paid",
    "cancelled",
    "refunded",
    "disputed",
];

const CANCELLATION_ACTORS = [
    "customer",
    "captain",
    "platform",
    "system",
];

const marketplaceLoadTrackingSchema = new mongoose.Schema(
    {
        /*
         * =====================================================
         * RELACIONES PRINCIPALES
         * =====================================================
         */

        spaceOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SpaceOffer",
            required: true,
            unique: true,
            index: true,
        },

        acceptedBid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OfferBid",
            required: true,
            unique: true,
            index: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },

        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },

        /*
         * =====================================================
         * PLAN DE SEGUIMIENTO
         * =====================================================
         *
         * basic:
         * - Estados del servicio
         * - Confirmación de recogida
         * - Confirmación de entrega
         *
         * professional:
         * - Todo lo anterior
         * - GPS en vivo
         * - Recorrido histórico
         * - Mapa
         * - Evidencias
         * - Alertas
         */

        trackingPlan: {
            type: String,
            enum: TRACKING_PLANS,
            default: "basic",
            index: true,
        },

        trackingEnabled: {
            type: Boolean,
            default: false,
            index: true,
        },

        liveLocationEnabled: {
            type: Boolean,
            default: false,
        },

        trackingActivatedAt: {
            type: Date,
            default: null,
        },

        trackingDeactivatedAt: {
            type: Date,
            default: null,
        },

        /*
         * =====================================================
         * ESTADO DEL SERVICIO
         * =====================================================
         */

        status: {
            type: String,
            enum: TRACKING_STATUSES,
            default: "pending_confirmation",
            index: true,
        },

        statusUpdatedAt: {
            type: Date,
            default: Date.now,
        },

        statusHistory: {
            type: [
                {
                    status: {
                        type: String,
                        enum: TRACKING_STATUSES,
                        required: true,
                    },

                    changedByType: {
                        type: String,
                        enum: [
                            "customer",
                            "captain",
                            "platform",
                            "system",
                        ],
                        default: "system",
                    },

                    changedBy: {
                        type: mongoose.Schema.Types.ObjectId,
                        default: null,
                    },

                    note: {
                        type: String,
                        trim: true,
                        maxlength: 500,
                        default: "",
                    },

                    location: {
                        lat: {
                            type: Number,
                            default: null,
                        },

                        lng: {
                            type: Number,
                            default: null,
                        },
                    },

                    createdAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
            default: [],
        },

        /*
         * =====================================================
         * DATOS ECONÓMICOS
         * =====================================================
         */

        currency: {
            type: String,
            enum: ["COP"],
            default: "COP",
        },

        serviceValue: {
            type: Number,
            required: true,
            min: 1,
        },

        commissionPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 6,
        },

        calculatedCommission: {
            type: Number,
            min: 0,
            default: 0,
        },

        platformCommission: {
            type: Number,
            min: 0,
            default: 0,
        },

        commissionMinimum: {
            type: Number,
            min: 0,
            default: 10000,
        },

        commissionMaximum: {
            type: Number,
            min: 0,
            default: 120000,
        },

        trackingFee: {
            type: Number,
            min: 0,
            default: 0,
        },

        driverNetAmount: {
            type: Number,
            min: 0,
            default: 0,
        },

        commissionStatus: {
            type: String,
            enum: COMMISSION_STATUSES,
            default: "pending",
            index: true,
        },

        paymentStatus: {
            type: String,
            enum: PAYMENT_STATUSES,
            default: "pending",
            index: true,
        },

        reservationPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 10,
        },

        reservationAmount: {
            type: Number,
            min: 0,
            default: 0,
        },

        reservationPaidAt: {
            type: Date,
            default: null,
        },

        /*
         * =====================================================
         * UBICACIÓN ACTUAL
         * =====================================================
         *
         * Esta ubicación pertenece únicamente al viaje.
         * No modifica la ubicación empresarial.
         */

        currentLocation: {
            lat: {
                type: Number,
                default: null,
            },

            lng: {
                type: Number,
                default: null,
            },

            accuracy: {
                type: Number,
                default: null,
            },

            heading: {
                type: Number,
                default: null,
            },

            speed: {
                type: Number,
                default: null,
            },

            source: {
                type: String,
                enum: [
                    "gps",
                    "background_gps",
                    "foreground_gps",
                    "manual",
                    "unknown",
                ],
                default: "unknown",
            },

            updatedAt: {
                type: Date,
                default: null,
                index: true,
            },
        },

        lastLocationReceivedAt: {
            type: Date,
            default: null,
            index: true,
        },

        /*
         * =====================================================
         * ORIGEN Y DESTINO
         * =====================================================
         */

        origin: {
            address: {
                type: String,
                trim: true,
                default: "",
            },

            city: {
                type: String,
                trim: true,
                default: "",
            },

            department: {
                type: String,
                trim: true,
                default: "",
            },

            lat: {
                type: Number,
                default: null,
            },

            lng: {
                type: Number,
                default: null,
            },

            placeId: {
                type: String,
                trim: true,
                default: "",
            },
        },

        destination: {
            address: {
                type: String,
                trim: true,
                default: "",
            },

            city: {
                type: String,
                trim: true,
                default: "",
            },

            department: {
                type: String,
                trim: true,
                default: "",
            },

            lat: {
                type: Number,
                default: null,
            },

            lng: {
                type: Number,
                default: null,
            },

            placeId: {
                type: String,
                trim: true,
                default: "",
            },
        },

        /*
         * =====================================================
         * CÓDIGOS DE SEGURIDAD
         * =====================================================
         */

        pickupCode: {
            type: String,
            trim: true,
            select: false,
            default: "",
        },

        deliveryCode: {
            type: String,
            trim: true,
            select: false,
            default: "",
        },

        pickupCodeValidated: {
            type: Boolean,
            default: false,
        },

        deliveryCodeValidated: {
            type: Boolean,
            default: false,
        },

        pickupCodeValidatedAt: {
            type: Date,
            default: null,
        },

        deliveryCodeValidatedAt: {
            type: Date,
            default: null,
        },

        /*
         * =====================================================
         * FECHAS OPERATIVAS
         * =====================================================
         */

        confirmedAt: {
            type: Date,
            default: null,
        },

        driverStartedHeadingAt: {
            type: Date,
            default: null,
        },

        arrivedAtPickupAt: {
            type: Date,
            default: null,
        },

        loadingStartedAt: {
            type: Date,
            default: null,
        },

        pickedUpAt: {
            type: Date,
            default: null,
        },

        inTransitAt: {
            type: Date,
            default: null,
        },

        nearDestinationAt: {
            type: Date,
            default: null,
        },

        arrivedAtDestinationAt: {
            type: Date,
            default: null,
        },

        unloadingStartedAt: {
            type: Date,
            default: null,
        },

        deliveredAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        /*
         * =====================================================
         * VEHÍCULO DEL SERVICIO
         * =====================================================
         */

        vehicle: {
            type: {
                type: String,
                trim: true,
                default: "",
            },

            brand: {
                type: String,
                trim: true,
                default: "",
            },

            reference: {
                type: String,
                trim: true,
                default: "",
            },

            model: {
                type: String,
                trim: true,
                default: "",
            },

            plate: {
                type: String,
                trim: true,
                uppercase: true,
                default: "",
            },

            bodyType: {
                type: String,
                trim: true,
                default: "",
            },

            capacity: {
                type: Number,
                min: 0,
                default: null,
            },

            capacityUnit: {
                type: String,
                trim: true,
                default: "",
            },
        },

        /*
         * =====================================================
         * EVIDENCIAS
         * =====================================================
         */

        pickupEvidence: {
            photos: {
                type: [String],
                default: [],
            },

            notes: {
                type: String,
                trim: true,
                maxlength: 1000,
                default: "",
            },

            signatureUrl: {
                type: String,
                trim: true,
                default: "",
            },

            createdAt: {
                type: Date,
                default: null,
            },
        },

        deliveryEvidence: {
            photos: {
                type: [String],
                default: [],
            },

            notes: {
                type: String,
                trim: true,
                maxlength: 1000,
                default: "",
            },

            signatureUrl: {
                type: String,
                trim: true,
                default: "",
            },

            receiverName: {
                type: String,
                trim: true,
                maxlength: 150,
                default: "",
            },

            receiverDocument: {
                type: String,
                trim: true,
                maxlength: 50,
                default: "",
            },

            createdAt: {
                type: Date,
                default: null,
            },
        },

        /*
         * =====================================================
         * CANCELACIONES Y DISPUTAS
         * =====================================================
         */

        cancelledAt: {
            type: Date,
            default: null,
        },

        cancelledBy: {
            type: String,
            enum: CANCELLATION_ACTORS,
            default: null,
        },

        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        disputeOpenedAt: {
            type: Date,
            default: null,
        },

        disputeReason: {
            type: String,
            trim: true,
            maxlength: 1500,
            default: "",
        },

        disputeResolvedAt: {
            type: Date,
            default: null,
        },

        /*
         * =====================================================
         * CONTROL INTERNO
         * =====================================================
         */

        active: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

/*
 * =========================================================
 * CÁLCULOS AUTOMÁTICOS
 * =========================================================
 */

marketplaceLoadTrackingSchema.pre("validate", function (next) {
    try {
        const serviceValue = Number(this.serviceValue || 0);
        const percentage = Number(this.commissionPercentage || 0);
        const minimum = Number(this.commissionMinimum || 0);
        const maximum = Number(this.commissionMaximum || 0);
        const trackingFee = Number(this.trackingFee || 0);
        const reservationPercentage = Number(
            this.reservationPercentage || 0
        );

        const rawCommission =
            serviceValue * (percentage / 100);

        this.calculatedCommission = Math.max(
            0,
            Math.round(rawCommission)
        );

        let finalCommission = Math.max(
            this.calculatedCommission,
            minimum
        );

        if (maximum > 0) {
            finalCommission = Math.min(
                finalCommission,
                maximum
            );
        }

        this.platformCommission = Math.max(
            0,
            Math.round(finalCommission)
        );

        this.reservationAmount = Math.max(
            0,
            Math.round(
                serviceValue *
                    (reservationPercentage / 100)
            )
        );

        this.driverNetAmount = Math.max(
            0,
            Math.round(
                serviceValue -
                    this.platformCommission -
                    trackingFee
            )
        );

        if (
            this.trackingPlan === "professional" &&
            !this.trackingEnabled
        ) {
            this.trackingEnabled = true;
        }

        if (
            this.trackingPlan === "basic" &&
            this.liveLocationEnabled
        ) {
            this.liveLocationEnabled = false;
        }

        next();
    } catch (error) {
        next(error);
    }
});

/*
 * Registrar automáticamente el primer estado.
 */

marketplaceLoadTrackingSchema.pre("save", function (next) {
    if (
        this.isNew &&
        (!Array.isArray(this.statusHistory) ||
            this.statusHistory.length === 0)
    ) {
        this.statusHistory = [
            {
                status:
                    this.status ||
                    "pending_confirmation",

                changedByType: "system",

                note:
                    "Seguimiento creado automáticamente al asignar la carga.",

                createdAt: new Date(),
            },
        ];
    }

    next();
});

/*
 * =========================================================
 * ÍNDICES
 * =========================================================
 */

marketplaceLoadTrackingSchema.index({
    customer: 1,
    status: 1,
    createdAt: -1,
});

marketplaceLoadTrackingSchema.index({
    captain: 1,
    status: 1,
    createdAt: -1,
});

marketplaceLoadTrackingSchema.index({
    trackingEnabled: 1,
    status: 1,
});

marketplaceLoadTrackingSchema.index({
    "currentLocation.updatedAt": -1,
});

marketplaceLoadTrackingSchema.index({
    commissionStatus: 1,
    paymentStatus: 1,
});

const MarketplaceLoadTracking = mongoose.model(
    "MarketplaceLoadTracking",
    marketplaceLoadTrackingSchema
);

module.exports = MarketplaceLoadTracking;