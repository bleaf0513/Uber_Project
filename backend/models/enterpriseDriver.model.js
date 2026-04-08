const mongoose = require('mongoose');

const enterpriseDriverSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        cedula: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        phone: {
            type: String,
            default: '',
            trim: true,
        },
        vehicle: {
            type: String,
            default: '',
            trim: true,
        },
        plate: {
            type: String,
            default: '',
            trim: true,
        },
        status: {
            type: String,
            enum: ['Disponible', 'En ruta', 'Inactivo'],
            default: 'Disponible',
        },
        active: {
            type: Boolean,
            default: true,
        },
        currentLocation: {
            lat: {
                type: Number,
                default: null,
            },
            lng: {
                type: Number,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('EnterpriseDriver', enterpriseDriverSchema);
