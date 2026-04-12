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

        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EnterpriseClient',
            default: null,
            index: true,
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

        neighborhood: {
            type: String,
            default: '',
            trim: true,
        },

        reference: {
            type: String,
            default: '',
            trim: true,
        },

        placeId: {
            type: String,
            default: '',
            trim: true,
        },

        assignedDriverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EnterpriseDriver',
            required: true,
            index: true,
        },

        assignedDriverName: {
            type: String,
            default: '',
            trim: true,
        },

        invoiceValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        paymentMethod: {
            type: String,
            enum: ['Efectivo', 'Transferencia'],
            default: 'Efectivo',
        },

        notes: {
            type: String,
            default: '',
            trim: true,
        },

        status: {
            type: String,
            enum: ['Pendiente', 'En curso', 'Finalizada'],
            default: 'Pendiente',
            index: true,
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

enterpriseDeliverySchema.index({ enterprise: 1, createdAt: -1 });
enterpriseDeliverySchema.index({ enterprise: 1, status: 1 });
enterpriseDeliverySchema.index({ enterprise: 1, assignedDriverId: 1, status: 1 });
enterpriseDeliverySchema.index({ enterprise: 1, clientId: 1 });
enterpriseDeliverySchema.index({ enterprise: 1, invoiceNumber: 1 });

module.exports = mongoose.model('EnterpriseDelivery', enterpriseDeliverySchema);
