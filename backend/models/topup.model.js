const mongoose = require("mongoose");

const topupSchema = new mongoose.Schema(
    {
        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            required: true,
            index: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 1000,
        },

        currency: {
            type: String,
            default: "COP",
            enum: ["COP"],
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "expired"],
            default: "pending",
            index: true,
        },

        method: {
            type: String,
            enum: ["nequi", "bancolombia", "pse", "manual", "wompi"],
            default: "manual",
            index: true,
        },

        reference: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        paymentProofUrl: {
            type: String,
            trim: true,
            default: "",
        },

        provider: {
            type: String,
            trim: true,
            default: "",
        },

        providerTransactionId: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },

        approvedAt: {
            type: Date,
            default: null,
        },

        rejectedAt: {
            type: Date,
            default: null,
        },

        expiredAt: {
            type: Date,
            default: null,
        },

        adminNotes: {
            type: String,
            trim: true,
            default: "",
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

topupSchema.index({
    captain: 1,
    createdAt: -1,
});

topupSchema.index({
    status: 1,
    createdAt: -1,
});

topupSchema.index({
    method: 1,
    createdAt: -1,
});

const topupModel = mongoose.model("topup", topupSchema);

module.exports = topupModel;