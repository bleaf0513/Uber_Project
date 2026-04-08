const mongoose = require("mongoose");

const enterpriseDriverSchema = new mongoose.Schema(
  {
    enterprise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enterprise",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    cedula: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    vehicle: {
      type: String,
      default: "",
      trim: true,
    },
    plate: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Disponible", "En ruta", "Inactivo"],
      default: "Disponible",
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

enterpriseDriverSchema.index(
  { enterprise: 1, cedula: 1 },
  { unique: true }
);

module.exports = mongoose.model("EnterpriseDriver", enterpriseDriverSchema);
