const mongoose = require("mongoose");

/*
 * =========================================================
 * PUNTOS GPS DEL MARKETPLACE DE CARGAS
 * =========================================================
 *
 * Este modelo guarda el recorrido GPS de una carga aceptada.
 *
 * Es completamente independiente de:
 * - EnterpriseDriverRoutePoint
 * - EnterpriseDriverShift
 * - EnterpriseDelivery
 *
 * De esta forma no afectamos el sistema empresarial.
 */

const marketplaceLoadRoutePointSchema = new mongoose.Schema(
    {
        /*
         * Seguimiento profesional al que pertenece el punto.
         */
        tracking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MarketplaceLoadTracking",
            required: true,
            index: true,
        },

        /*
         * Carga publicada.
         */
        spaceOffer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SpaceOffer",
            required: true,
            index: true,
        },

        /*
         * Propuesta aceptada.
         */
        acceptedBid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OfferBid",
            required: true,
            index: true,
        },

        /*
         * Usuario propietario de la carga.
         */
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true,
        },

        /*
         * Conductor del marketplace.
         */
        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },

        /*
         * Coordenadas GPS.
         */
        lat: {
            type: Number,
            required: true,
            min: -90,
            max: 90,
        },

        lng: {
            type: Number,
            required: true,
            min: -180,
            max: 180,
        },

        /*
         * Precisión reportada por el dispositivo.
         * Se mide normalmente en metros.
         */
        accuracy: {
            type: Number,
            min: 0,
            default: null,
        },

        /*
         * Dirección del movimiento, entre 0 y 360 grados.
         */
        heading: {
            type: Number,
            min: 0,
            max: 360,
            default: null,
        },

        /*
         * Velocidad reportada por el GPS.
         * Normalmente llega en metros por segundo.
         */
        speed: {
            type: Number,
            min: 0,
            default: null,
        },

        /*
         * Momento exacto en que el dispositivo obtuvo el punto.
         */
        recordedAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },

        /*
         * Momento reportado por el dispositivo.
         * Puede diferir ligeramente de recordedAt.
         */
        deviceTimestamp: {
            type: Date,
            default: null,
        },

        /*
         * Origen del punto GPS.
         */
        source: {
            type: String,
            enum: [
                "gps",
                "foreground_gps",
                "background_gps",
                "manual",
                "unknown",
            ],
            default: "gps",
            index: true,
        },

        /*
         * Plataforma desde la cual se recibió.
         */
        platform: {
            type: String,
            enum: [
                "web",
                "android",
                "ios",
                "unknown",
            ],
            default: "unknown",
        },

        /*
         * Distancia calculada desde el punto anterior.
         */
        distanceFromPreviousMeters: {
            type: Number,
            min: 0,
            default: 0,
        },

        /*
         * Distancia acumulada del viaje hasta este punto.
         */
        accumulatedDistanceKm: {
            type: Number,
            min: 0,
            default: 0,
        },

        /*
         * Indica si el punto fue considerado válido.
         */
        valid: {
            type: Boolean,
            default: true,
            index: true,
        },

        /*
         * Razón por la que un punto fue marcado como inválido.
         */
        invalidReason: {
            type: String,
            trim: true,
            maxlength: 300,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

/*
 * =========================================================
 * VALIDACIONES
 * =========================================================
 */

marketplaceLoadRoutePointSchema.pre(
    "validate",
    function (next) {
        try {
            const lat = Number(this.lat);
            const lng = Number(this.lng);

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {
                return next(
                    new Error(
                        "La latitud y longitud deben ser números válidos."
                    )
                );
            }

            if (lat < -90 || lat > 90) {
                return next(
                    new Error(
                        "La latitud debe estar entre -90 y 90."
                    )
                );
            }

            if (lng < -180 || lng > 180) {
                return next(
                    new Error(
                        "La longitud debe estar entre -180 y 180."
                    )
                );
            }

            this.lat = Number(lat.toFixed(6));
            this.lng = Number(lng.toFixed(6));

            if (
                Number.isFinite(Number(this.accuracy))
            ) {
                this.accuracy = Number(
                    Number(this.accuracy).toFixed(2)
                );
            }

            if (
                Number.isFinite(Number(this.speed))
            ) {
                this.speed = Number(
                    Number(this.speed).toFixed(2)
                );
            }

            if (
                Number.isFinite(
                    Number(
                        this.distanceFromPreviousMeters
                    )
                )
            ) {
                this.distanceFromPreviousMeters =
                    Number(
                        Number(
                            this.distanceFromPreviousMeters
                        ).toFixed(2)
                    );
            }

            if (
                Number.isFinite(
                    Number(
                        this.accumulatedDistanceKm
                    )
                )
            ) {
                this.accumulatedDistanceKm =
                    Number(
                        Number(
                            this.accumulatedDistanceKm
                        ).toFixed(4)
                    );
            }

            next();
        } catch (error) {
            next(error);
        }
    }
);

/*
 * =========================================================
 * ÍNDICES
 * =========================================================
 */

/*
 * Obtener rápidamente todo el recorrido de un viaje.
 */
marketplaceLoadRoutePointSchema.index({
    tracking: 1,
    recordedAt: 1,
});

/*
 * Consultar los puntos del conductor por fecha.
 */
marketplaceLoadRoutePointSchema.index({
    captain: 1,
    recordedAt: -1,
});

/*
 * Consultar puntos de una carga específica.
 */
marketplaceLoadRoutePointSchema.index({
    spaceOffer: 1,
    recordedAt: 1,
});

/*
 * Buscar el último punto válido del viaje.
 */
marketplaceLoadRoutePointSchema.index({
    tracking: 1,
    valid: 1,
    recordedAt: -1,
});

/*
 * Evita almacenar accidentalmente el mismo punto exacto
 * con la misma fecha dentro del mismo seguimiento.
 */
marketplaceLoadRoutePointSchema.index(
    {
        tracking: 1,
        lat: 1,
        lng: 1,
        recordedAt: 1,
    },
    {
        unique: true,
    }
);

const MarketplaceLoadRoutePoint =
    mongoose.model(
        "MarketplaceLoadRoutePoint",
        marketplaceLoadRoutePointSchema
    );

module.exports = MarketplaceLoadRoutePoint;