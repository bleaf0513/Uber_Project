const mongoose = require('mongoose');

const enterpriseSchema = new mongoose.Schema(
    {
        companyName: {
            type: String,
            required: true,
            trim: true,
        },

        nit: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },

        phone: {
            type: String,
            default: '',
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        active: {
            type: Boolean,
            default: true,
        },

        /**
         * Punto base / punto de carga de la empresa.
         *
         * Este será el origen para calcular rutas inteligentes.
         * Ejemplo:
         * Empresa / bodega
         * → pedido más cercano
         * → siguiente pedido
         * → siguiente pedido
         */
        baseLocation: {
            address: {
                type: String,
                default: '',
                trim: true,
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
                default: '',
                trim: true,
            },
            formattedAddress: {
                type: String,
                default: '',
                trim: true,
            },
        },
    },
    {
        timestamps: true,
    }
);

enterpriseSchema.index({ email: 1 });
enterpriseSchema.index({ nit: 1 });

module.exports = mongoose.model('Enterprise', enterpriseSchema);