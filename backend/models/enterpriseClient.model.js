const mongoose = require("mongoose");

const enterpriseClientSchema = new mongoose.Schema(
  {
    enterprise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "enterprise",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    neighborhood: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    placeId: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

enterpriseClientSchema.index({ enterprise: 1, name: 1 });
enterpriseClientSchema.index({ enterprise: 1, phone: 1 });
enterpriseClientSchema.index({ enterprise: 1, isActive: 1 });
enterpriseClientSchema.index({ enterprise: 1, updatedAt: -1 });

module.exports = mongoose.model("EnterpriseClient", enterpriseClientSchema);
