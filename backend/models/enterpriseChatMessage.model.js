const mongoose = require("mongoose");

const enterpriseChatMessageSchema = new mongoose.Schema(
  {
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EnterpriseDelivery",
      required: true,
      index: true,
    },
    enterprise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "enterprise",
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EnterpriseDriver",
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ["driver", "logistics"],
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
    readByLogistics: {
      type: Boolean,
      default: false,
    },
    readByDriver: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

enterpriseChatMessageSchema.index({ delivery: 1, createdAt: 1 });
enterpriseChatMessageSchema.index({ enterprise: 1, driver: 1, createdAt: -1 });

module.exports = mongoose.model(
  "EnterpriseChatMessage",
  enterpriseChatMessageSchema
);
