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

const VEHICLE_TYPES = [
    "motorcycle",
    "car",
    "light_cargo",
    "van",
    "truck",
    "motocarro",
    "pickup",
    "moving",
];

const MAX_PRODUCT_PHOTOS = 4;

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
            enum: VEHICLE_TYPES,
            default: null,
        },

        /*
         * =====================================================
         * FOTOS DE LA MERCANCÍA
         * =====================================================
         *
         * El frontend envía imágenes optimizadas en formato
         * data URL / base64.
         *
         * La primera imagen del arreglo se considera la portada.
         *
         * Máximo 4 fotos por publicación.
         */
        photos: {
            type: [
                {
                    type: String,
                    default: "",
                },
            ],
            default: [],
            validate: {
                validator(value) {
                    return (
                        Array.isArray(value) &&
                        value.length <= MAX_PRODUCT_PHOTOS
                    );
                },
                message: `Solo puedes guardar máximo ${MAX_PRODUCT_PHOTOS} fotos por publicación.`,
            },
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
            enum: [
                "active",
                "paused",
                "sold_out",
                "cancelled",
                "completed",
            ],
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

/*
 * =========================================================
 * LIMPIEZA DE FOTOS
 * =========================================================
 *
 * Evita guardar valores vacíos, nulos o más de cuatro fotos.
 */
goodsOfferSchema.pre("validate", function (next) {
    try {
        if (Array.isArray(this.photos)) {
            this.photos = this.photos
                .filter(
                    (photo) =>
                        typeof photo === "string" &&
                        photo.trim().length > 0
                )
                .slice(0, MAX_PRODUCT_PHOTOS);
        } else {
            this.photos = [];
        }

        next();
    } catch (error) {
        next(error);
    }
});

goodsOfferSchema.index({
    driver: 1,
    status: 1,
    createdAt: -1,
});

goodsOfferSchema.index({
    origin: 1,
    destination: 1,
    status: 1,
});

goodsOfferSchema.index({
    vehicleType: 1,
    status: 1,
});

goodsOfferSchema.index({
    productName: "text",
    description: "text",
});

goodsOfferSchema.index({
    quantityUnit: 1,
    status: 1,
});

const goodsOfferModel = mongoose.model(
    "GoodsOffer",
    goodsOfferSchema
);

module.exports = goodsOfferModel;