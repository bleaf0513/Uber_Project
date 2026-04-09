const mongoose = require('mongoose');

const enterpriseDeliverySchema = new mongoose.Schema(
    {
        enterprise: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Enterprise',
            required: true,
            index: true,
        },
        invoiceNumber: {
            type: String,
            required: true,
            trim: true,
        },
        clientName: {
            type: String,
            required: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        clientPhone: {
            type: String,
            required: true,
            trim: true,
        },
        assignedDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EnterpriseDriver',
            required: true,
        },
        assignedDriverName: {
            type: String,
            default: '',
            trim: true,
        },
        notes: {
            type: String,
            default: '',
            trim: true,
        },
        placeId: {
            type: String,
            default: '',
            trim: true,
        },
        status: {
            type: String,
            enum: ['Pendiente', 'En curso', 'Finalizada'],
            default: 'Pendiente',
        },
        startedAt: {
            type: Date,
            default: null,
        },
        finishedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('EnterpriseDelivery', enterpriseDeliverySchema);
