const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
    {
        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: [
                "topup",
                "commission_debit",
                "refund",
                "adjustment",
                "manual_credit",
                "manual_debit",
            ],
            required: true,
            index: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        currency: {
            type: String,
            default: "COP",
            enum: ["COP"],
        },

        balanceBefore: {
            type: Number,
            required: true,
            min: 0,
        },

        balanceAfter: {
            type: Number,
            required: true,
            min: 0,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        ride: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ride",
            default: null,
            index: true,
        },

        topup: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "topup",
            default: null,
            index: true,
        },

        reference: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },

        metadata: {
            type: Object,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

/*
 * Evita cobrar dos veces la comisión del mismo viaje.
 * Si por error el endpoint de finalizar viaje se ejecuta dos veces,
 * este índice impide duplicar el movimiento commission_debit.
 */
walletTransactionSchema.index(
    {
        ride: 1,
        type: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            ride: {
                $type: "objectId",
            },
            type: "commission_debit",
        },
    }
);

walletTransactionSchema.index({
    captain: 1,
    createdAt: -1,
});

walletTransactionSchema.index({
    type: 1,
    createdAt: -1,
});

const walletTransactionModel = mongoose.model(
    "walletTransaction",
    walletTransactionSchema
);

module.exports = walletTransactionModel;