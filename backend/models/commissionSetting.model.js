const mongoose = require("mongoose");

const commissionSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            default: "default",
            unique: true,
            trim: true,
            index: true,
        },

        percentage: {
            type: Number,
            default: 10,
            min: 0,
            max: 100,
        },

        minimumCommission: {
            type: Number,
            default: 1000,
            min: 0,
        },

        minimumBalanceToAccept: {
            type: Number,
            default: 5000,
            min: 0,
        },

        active: {
            type: Boolean,
            default: true,
        },

        description: {
            type: String,
            trim: true,
            default: "Comisión general Central Go",
        },

        updatedBy: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

commissionSettingSchema.index({
    active: 1,
});

const commissionSettingModel = mongoose.model(
    "commissionSetting",
    commissionSettingSchema
);

module.exports = commissionSettingModel;