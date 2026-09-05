const mongoose = require("mongoose");

/*
 * =========================================================
 * TIPOS DE PUBLICACIÓN
 * =========================================================
 *
 * goods = mercancía que vende un conductor
 * space = carga publicada por un usuario
 * seat  = cupos para pasajeros
 */

const TIPOS_PUBLICACION = [
    "goods",
    "space",
    "seat",
];

/*
 * Se conservan las unidades actuales para no afectar
 * Mercancía ni Cupos.
 *
 * También agregamos "vehiculo_completo", que será la unidad
 * utilizada para las propuestas del marketplace de Cargas.
 */

const UNIDADES_PROPUESTA = [
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
    "espacio_parcial",
    "vehiculo_completo",
];

const ESTADOS_PROPUESTA = [
    "pending",
    "accepted",
    "rejected",
    "countered",
    "cancelled",
    "completed",
];

/*
 * Categorías generales.
 *
 * No usamos referencias comerciales como NHR, NPR, NQR,
 * Hino 300, Foton, JAC, etc.
 *
 * La marca y la referencia real del vehículo se guardan
 * aparte como texto.
 */

const TIPOS_VEHICULO = [
    "moto",
    "carro",
    "motocarro",
    "camioneta",
    "van",
    "camion_ultraliviano",
    "camion_liviano",
    "camion_mediano",
    "camion_pesado",
    "camion_sencillo",
    "doble_troque",
    "volqueta",
    "minimula",
    "tractomula",
    "cama_baja",
    "vehiculo_especial",
    "otro",
];

const TIPOS_CARROCERIA = [
    "no_especificada",
    "furgon_cerrado",
    "estacas",
    "plataforma",
    "refrigerada",
    "volco",
    "tanque",
    "portacontenedor",
    "cama_baja",
    "carroceria_abierta",
    "otro",
];

const UNIDADES_CAPACIDAD = [
    "kg",
    "toneladas",
    "m3",
];

const offerChatMessageSchema = new mongoose.Schema(
    {
        senderType: { type: String, enum: ["user", "captain", "system"], required: true },
        sender: { type: mongoose.Schema.Types.ObjectId, default: null },
        message: { type: String, required: true, trim: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const offerBidSchema = new mongoose.Schema(
    {
        /*
         * =====================================================
         * RELACIÓN CON LA PUBLICACIÓN
         * =====================================================
         */

        listingType: {
            type: String,
            required: true,
            enum: TIPOS_PUBLICACION,
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

        /*
         * =====================================================
         * PARTICIPANTES
         * =====================================================
         *
         * Para Mercancía y Cupos:
         * customer = usuario que compra o solicita
         * driver   = conductor dueño de la publicación
         *
         * Para Cargas:
         * customer = usuario que publicó la carga
         * driver   = conductor que envía la propuesta
         */

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

        /*
         * =====================================================
         * INFORMACIÓN ECONÓMICA DE LA PROPUESTA
         * =====================================================
         */

        requestedQuantity: {
            type: Number,
            required: true,
            min: 0.01,
        },

        requestedUnit: {
            type: String,
            required: true,
            enum: UNIDADES_PROPUESTA,
        },

        offeredPrice: {
            type: Number,
            required: true,
            min: 1,
        },

        message: {
            type: String,
            trim: true,
            maxlength: 1500,
            default: "",
        },

        /*
         * =====================================================
         * DATOS DEL VEHÍCULO PARA PROPUESTAS DE CARGAS
         * =====================================================
         *
         * Estos campos se utilizan principalmente cuando:
         *
         * listingType === "space"
         */

        proposedVehicleType: {
            type: String,
            enum: TIPOS_VEHICULO,
            default: null,
        },

        proposedVehicleBrand: {
            type: String,
            trim: true,
            maxlength: 80,
            default: "",
        },

        proposedVehicleReference: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },

        proposedVehicleModel: {
            type: String,
            trim: true,
            maxlength: 20,
            default: "",
        },

        proposedVehiclePlate: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: 15,
            default: "",
        },

        proposedBodyType: {
            type: String,
            enum: TIPOS_CARROCERIA,
            default: "no_especificada",
        },

        proposedVehicleCapacity: {
            type: Number,
            min: 0,
            default: null,
        },

        proposedVehicleCapacityUnit: {
            type: String,
            enum: UNIDADES_CAPACIDAD,
            default: null,
        },

        /*
         * Capacidad normalizada en kilogramos.
         *
         * Se calcula automáticamente cuando la capacidad
         * se ingresa en kg o toneladas.
         */

        proposedVehicleCapacityKg: {
            type: Number,
            min: 0,
            default: null,
        },

        /*
         * =====================================================
         * DISPONIBILIDAD Y TIEMPOS
         * =====================================================
         */

        availablePickupTime: {
            type: Date,
            default: null,
        },

        estimatedDeliveryTime: {
            type: Date,
            default: null,
        },

        estimatedDurationHours: {
            type: Number,
            min: 0,
            default: null,
        },

        /*
         * =====================================================
         * SERVICIOS INCLUIDOS
         * =====================================================
         */

        includesLoading: {
            type: Boolean,
            default: false,
        },

        includesUnloading: {
            type: Boolean,
            default: false,
        },

        includesAssistant: {
            type: Boolean,
            default: false,
        },

        includesTolls: {
            type: Boolean,
            default: true,
        },

        includesFuel: {
            type: Boolean,
            default: true,
        },

        includesInsurance: {
            type: Boolean,
            default: false,
        },

        /*
         * =====================================================
         * ESTADO Y NEGOCIACIÓN
         * =====================================================
         */

        status: {
            type: String,
            enum: ESTADOS_PROPUESTA,
            default: "pending",
            index: true,
        },

        counterPrice: {
            type: Number,
            default: null,
            min: 1,
        },

        counterMessage: {
            type: String,
            trim: true,
            maxlength: 1500,
            default: "",
        },

        respondedAt: {
            type: Date,
            default: null,
        },


        chatEnabled: { type: Boolean, default: false, index: true },
        chatEnabledAt: { type: Date, default: null },
        chatMessages: { type: [offerChatMessageSchema], default: [] },

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
         * =====================================================
         * CONTROL DE NOTIFICACIONES
         * =====================================================
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

/*
 * =========================================================
 * VALIDACIONES Y NORMALIZACIÓN
 * =========================================================
 */

offerBidSchema.pre("validate", function (next) {
    try {
        /*
         * Cada propuesta debe estar asociada al tipo correcto
         * de publicación.
         */

        if (this.listingType === "goods" && !this.goodsOffer) {
            return next(
                new Error(
                    "goodsOffer es requerido cuando listingType es goods."
                )
            );
        }

        if (this.listingType === "space" && !this.spaceOffer) {
            return next(
                new Error(
                    "spaceOffer es requerido cuando listingType es space."
                )
            );
        }

        if (this.listingType === "seat" && !this.seatOffer) {
            return next(
                new Error(
                    "seatOffer es requerido cuando listingType es seat."
                )
            );
        }

        /*
         * En Cargas, la propuesta corresponde al viaje completo.
         */

        if (this.listingType === "space") {
            this.requestedQuantity = 1;
            this.requestedUnit = "vehiculo_completo";

            /*
             * Normalizar la capacidad del vehículo a kilogramos.
             */

            const capacidad = Number(
                this.proposedVehicleCapacity
            );

            if (
                Number.isFinite(capacidad) &&
                capacidad > 0
            ) {
                if (
                    this.proposedVehicleCapacityUnit ===
                    "toneladas"
                ) {
                    this.proposedVehicleCapacityKg =
                        capacidad * 1000;
                } else if (
                    this.proposedVehicleCapacityUnit === "kg"
                ) {
                    this.proposedVehicleCapacityKg =
                        capacidad;
                } else {
                    this.proposedVehicleCapacityKg = null;
                }
            } else {
                this.proposedVehicleCapacityKg = null;
            }

            /*
             * La fecha estimada de entrega no puede estar antes
             * de la disponibilidad de recogida.
             */

            if (
                this.availablePickupTime &&
                this.estimatedDeliveryTime
            ) {
                const recogida = new Date(
                    this.availablePickupTime
                ).getTime();

                const entrega = new Date(
                    this.estimatedDeliveryTime
                ).getTime();

                if (
                    Number.isFinite(recogida) &&
                    Number.isFinite(entrega) &&
                    entrega < recogida
                ) {
                    return next(
                        new Error(
                            "La fecha estimada de entrega no puede ser anterior a la fecha disponible de recogida."
                        )
                    );
                }
            }
        }

        /*
         * Registrar automáticamente las fechas según el estado.
         */

        if (
            this.isModified("status") &&
            this.status === "accepted" &&
            !this.acceptedAt
        ) {
            this.acceptedAt = new Date();
            this.respondedAt = new Date();
            this.chatEnabled = true;
            this.chatEnabledAt = this.chatEnabledAt || new Date();
        }

        if (
            this.isModified("status") &&
            this.status === "rejected" &&
            !this.rejectedAt
        ) {
            this.rejectedAt = new Date();
            this.respondedAt = new Date();
        }

        if (
            this.isModified("status") &&
            this.status === "countered" &&
            !this.counteredAt
        ) {
            this.counteredAt = new Date();
            this.respondedAt = new Date();
        }

        if (
            this.isModified("status") &&
            this.status === "cancelled" &&
            !this.cancelledAt
        ) {
            this.cancelledAt = new Date();
        }

        if (
            this.isModified("status") &&
            this.status === "completed" &&
            !this.completedAt
        ) {
            this.completedAt = new Date();
        }

        next();
    } catch (error) {
        next(error);
    }
});

/*
 * =========================================================
 * ÍNDICES
 * =========================================================
 */

offerBidSchema.index({
    driver: 1,
    status: 1,
    createdAt: -1,
});

offerBidSchema.index({
    customer: 1,
    status: 1,
    createdAt: -1,
});

offerBidSchema.index({
    listingType: 1,
    status: 1,
    createdAt: -1,
});

offerBidSchema.index({
    goodsOffer: 1,
    status: 1,
    createdAt: -1,
});

offerBidSchema.index({
    spaceOffer: 1,
    status: 1,
    createdAt: -1,
});

offerBidSchema.index({
    seatOffer: 1,
    status: 1,
    createdAt: -1,
});

/*
 * Ayuda a consultar rápidamente todas las propuestas
 * enviadas por un conductor para una carga determinada.
 */

offerBidSchema.index({
    spaceOffer: 1,
    driver: 1,
    createdAt: -1,
});

/*
 * Ayuda al usuario dueño de la carga a consultar todas
 * las propuestas recibidas.
 */

offerBidSchema.index({
    spaceOffer: 1,
    customer: 1,
    status: 1,
    createdAt: -1,
});

const offerBidModel = mongoose.model(
    "OfferBid",
    offerBidSchema
);

module.exports = offerBidModel;