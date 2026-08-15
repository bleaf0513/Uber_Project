const mongoose = require("mongoose");

/*
 * =========================================================
 * MARKETPLACE LOGÍSTICO — CARGAS
 * =========================================================
 *
 * En este módulo:
 * - El usuario publica una carga.
 * - Muchos conductores pueden verla.
 * - Los conductores envían propuestas.
 * - El usuario selecciona una propuesta.
 *
 * Mercancía y Cupos siguen funcionando por separado.
 */

/*
 * Tipos generales de vehículos.
 * No utilizamos referencias comerciales como NHR, NPR o NQR.
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

const UNIDADES_PESO = ["kg", "toneladas"];

const UNIDADES_CANTIDAD = [
    "unidades",
    "cajas",
    "bultos",
    "pacas",
    "canastillas",
    "sacos",
    "rollos",
    "tambores",
    "estibas",
    "contenedores",
    "otro",
];

const MODALIDADES_PRECIO = [
    "precio_fijo",
    "recibir_ofertas",
    "carga_retorno",
    "por_acordar",
];

const FORMAS_PAGO = [
    "por_acordar",
    "efectivo",
    "transferencia",
    "pago_anticipado",
    "contra_entrega",
    "credito",
];

const ESTADOS_CARGA = [
    "borrador",
    "active",
    "paused",
    "recibiendo_propuestas",
    "assigned",
    "reserved",
    "recogida",
    "in_transit",
    "delivered",
    "completed",
    "cancelled",
];

/*
 * Determina recomendaciones generales según el peso.
 *
 * La recomendación es orientativa porque la capacidad real
 * depende de marca, referencia, carrocería, número de ejes,
 * configuración y documentación de cada vehículo.
 */
const obtenerSugerenciasPorPeso = (pesoKg) => {
    const peso = Number(pesoKg) || 0;
    const capacidadMinimaKg = Math.ceil(peso * 1.1);

    if (peso <= 0) {
        return {
            principal: null,
            alternativas: [],
            capacidadMinimaKg: 0,
        };
    }

    if (peso <= 30) {
        return {
            principal: "moto",
            alternativas: ["motocarro"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 300) {
        return {
            principal: "motocarro",
            alternativas: ["carro", "camioneta"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 700) {
        return {
            principal: "van",
            alternativas: ["camioneta"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 1500) {
        return {
            principal: "camion_ultraliviano",
            alternativas: ["camioneta", "van"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 2800) {
        return {
            principal: "camion_ultraliviano",
            alternativas: ["camion_liviano"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 5000) {
        return {
            principal: "camion_liviano",
            alternativas: ["camion_mediano"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 8000) {
        return {
            principal: "camion_mediano",
            alternativas: ["camion_pesado", "camion_sencillo"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 12000) {
        return {
            principal: "camion_pesado",
            alternativas: ["camion_sencillo", "doble_troque"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 20000) {
        return {
            principal: "doble_troque",
            alternativas: ["minimula"],
            capacidadMinimaKg,
        };
    }

    if (peso <= 30000) {
        return {
            principal: "minimula",
            alternativas: ["tractomula"],
            capacidadMinimaKg,
        };
    }

    return {
        principal: "tractomula",
        alternativas: ["vehiculo_especial"],
        capacidadMinimaKg,
    };
};

const spaceOfferSchema = new mongoose.Schema(
    {
        /*
         * Usuario o empresa que necesita transportar la carga.
         */
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },

        /*
         * Código visible de la publicación.
         * Ejemplo: CG-4F8A91
         */
        publicationCode: {
            type: String,
            trim: true,
            uppercase: true,
            index: true,
            default: "",
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 120,
        },

        cargoType: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
        },

        /*
         * =====================================================
         * PESO Y DIMENSIONES
         * =====================================================
         */

        weight: {
            type: Number,
            required: true,
            min: 0.01,
        },

        weightUnit: {
            type: String,
            required: true,
            enum: UNIDADES_PESO,
            default: "kg",
        },

        /*
         * Peso normalizado en kilogramos.
         */
        weightKg: {
            type: Number,
            required: true,
            min: 0.01,
            index: true,
        },

        volumeM3: {
            type: Number,
            min: 0,
            default: 0,
        },

        lengthMeters: {
            type: Number,
            min: 0,
            default: 0,
        },

        widthMeters: {
            type: Number,
            min: 0,
            default: 0,
        },

        heightMeters: {
            type: Number,
            min: 0,
            default: 0,
        },

        packageQuantity: {
            type: Number,
            min: 0,
            default: 0,
        },

        packageUnit: {
            type: String,
            enum: UNIDADES_CANTIDAD,
            default: "unidades",
        },

        palletCount: {
            type: Number,
            min: 0,
            default: 0,
        },

        /*
         * =====================================================
         * RUTA
         * =====================================================
         */

        origin: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 250,
            index: true,
        },

        originCity: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
            index: true,
        },

        originDepartment: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },

        destination: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 250,
            index: true,
        },

        destinationCity: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
            index: true,
        },

        destinationDepartment: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },

        stops: {
            type: [String],
            default: [],
        },

        pickupTime: {
            type: Date,
            required: true,
            index: true,
        },

        deliveryDeadline: {
            type: Date,
            default: null,
        },

        pickupIsFlexible: {
            type: Boolean,
            default: false,
        },

        /*
         * =====================================================
         * VEHÍCULO REQUERIDO Y RECOMENDACIONES
         * =====================================================
         */

        requiredVehicleType: {
            type: String,
            enum: TIPOS_VEHICULO,
            default: null,
            index: true,
        },

        requiredBodyType: {
            type: String,
            enum: TIPOS_CARROCERIA,
            default: "no_especificada",
            index: true,
        },

        /*
         * Datos calculados automáticamente según el peso.
         */
        suggestedVehicleType: {
            type: String,
            enum: TIPOS_VEHICULO,
            default: null,
        },

        suggestedAlternativeVehicles: {
            type: [
                {
                    type: String,
                    enum: TIPOS_VEHICULO,
                },
            ],
            default: [],
        },

        recommendedMinCapacityKg: {
            type: Number,
            min: 0,
            default: 0,
        },

        /*
         * Permite que el usuario ignore la sugerencia automática
         * y seleccione otro tipo de vehículo.
         */
        vehicleSuggestionOverridden: {
            type: Boolean,
            default: false,
        },

        /*
         * =====================================================
         * CONDICIONES DE LA CARGA
         * =====================================================
         */

        requiresRefrigeration: {
            type: Boolean,
            default: false,
        },

        isFragile: {
            type: Boolean,
            default: false,
        },

        isHazardous: {
            type: Boolean,
            default: false,
        },

        requiresTarp: {
            type: Boolean,
            default: false,
        },

        requiresLoading: {
            type: Boolean,
            default: false,
        },

        requiresUnloading: {
            type: Boolean,
            default: false,
        },

        requiresAssistant: {
            type: Boolean,
            default: false,
        },

        loadingIncludedInPrice: {
            type: Boolean,
            default: false,
        },

        unloadingIncludedInPrice: {
            type: Boolean,
            default: false,
        },

        /*
         * =====================================================
         * PRECIO Y PAGO
         * =====================================================
         */

        priceMode: {
            type: String,
            required: true,
            enum: MODALIDADES_PRECIO,
            default: "recibir_ofertas",
            index: true,
        },

        suggestedPrice: {
            type: Number,
            min: 0,
            default: 0,
        },

        currency: {
            type: String,
            enum: ["COP"],
            default: "COP",
        },

        isNegotiable: {
            type: Boolean,
            default: true,
        },

        paymentMethod: {
            type: String,
            enum: FORMAS_PAGO,
            default: "por_acordar",
        },

        paymentTermDays: {
            type: Number,
            min: 0,
            default: 0,
        },

        includesTolls: {
            type: Boolean,
            default: true,
        },

        includesFuel: {
            type: Boolean,
            default: true,
        },

        /*
         * =====================================================
         * INFORMACIÓN ADICIONAL
         * =====================================================
         */

        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },

        notes: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },

        contactInstructions: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        photos: {
            type: [String],
            default: [],
        },

        /*
         * =====================================================
         * ESTADO DEL MARKETPLACE
         * =====================================================
         */

        status: {
            type: String,
            enum: ESTADOS_CARGA,
            default: "active",
            index: true,
        },

        selectedBid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OfferBid",
            default: null,
        },

        selectedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            default: null,
            index: true,
        },

        proposalsCount: {
            type: Number,
            min: 0,
            default: 0,
        },

        assignedAt: {
            type: Date,
            default: null,
        },

        pickedUpAt: {
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

        cancelledAt: {
            type: Date,
            default: null,
        },

        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        /*
         * =====================================================
         * COMPATIBILIDAD TEMPORAL
         * =====================================================
         *
         * Estos campos permiten que algunas pantallas antiguas
         * no fallen mientras terminamos de migrar el módulo.
         *
         * Una carga completa representa una sola oportunidad:
         * capacityAvailable = 1
         * capacityUnit = vehiculo_completo
         */

        capacityAvailable: {
            type: Number,
            min: 0,
            default: 1,
        },

        capacityUnit: {
            type: String,
            enum: ["vehiculo_completo"],
            default: "vehiculo_completo",
        },

        priceType: {
            type: String,
            enum: ["precio_total"],
            default: "precio_total",
        },
    },
    {
        timestamps: true,
    }
);

/*
 * =========================================================
 * NORMALIZACIÓN Y RECOMENDACIÓN AUTOMÁTICA
 * =========================================================
 */

spaceOfferSchema.pre("validate", function (next) {
    try {
        const pesoIngresado = Number(this.weight) || 0;

        this.weightKg =
            this.weightUnit === "toneladas"
                ? pesoIngresado * 1000
                : pesoIngresado;

        const sugerencia = obtenerSugerenciasPorPeso(this.weightKg);

        this.suggestedVehicleType = sugerencia.principal;
        this.suggestedAlternativeVehicles = sugerencia.alternativas;
        this.recommendedMinCapacityKg =
            sugerencia.capacidadMinimaKg;

        /*
         * Cuando el usuario no selecciona vehículo manualmente,
         * usamos la recomendación principal.
         */
        if (!this.requiredVehicleType && sugerencia.principal) {
            this.requiredVehicleType = sugerencia.principal;
            this.vehicleSuggestionOverridden = false;
        }

        /*
         * Una publicación de carga representa un viaje completo.
         */
        this.capacityAvailable = 1;
        this.capacityUnit = "vehiculo_completo";
        this.priceType = "precio_total";

        if (
            this.deliveryDeadline &&
            this.pickupTime &&
            new Date(this.deliveryDeadline).getTime() <
                new Date(this.pickupTime).getTime()
        ) {
            return next(
                new Error(
                    "La fecha límite de entrega no puede ser anterior a la fecha de recogida."
                )
            );
        }

        next();
    } catch (error) {
        next(error);
    }
});

/*
 * Genera un código corto para la publicación.
 */
spaceOfferSchema.pre("save", function (next) {
    if (!this.publicationCode) {
        const fragmento = new mongoose.Types.ObjectId()
            .toString()
            .slice(-6)
            .toUpperCase();

        this.publicationCode = `CG-${fragmento}`;
    }

    next();
});

/*
 * =========================================================
 * ÍNDICES
 * =========================================================
 */

spaceOfferSchema.index({
    customer: 1,
    status: 1,
    createdAt: -1,
});

spaceOfferSchema.index({
    originCity: 1,
    destinationCity: 1,
    status: 1,
    pickupTime: 1,
});

spaceOfferSchema.index({
    requiredVehicleType: 1,
    status: 1,
    pickupTime: 1,
});

spaceOfferSchema.index({
    requiredBodyType: 1,
    status: 1,
});

spaceOfferSchema.index({
    weightKg: 1,
    status: 1,
});

spaceOfferSchema.index({
    priceMode: 1,
    status: 1,
});

spaceOfferSchema.index({
    selectedDriver: 1,
    status: 1,
});

const spaceOfferModel = mongoose.model(
    "SpaceOffer",
    spaceOfferSchema
);

module.exports = spaceOfferModel;