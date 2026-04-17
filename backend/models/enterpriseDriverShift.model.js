const mongoose = require('mongoose');

const enterpriseDriverShiftSchema = new mongoose.Schema(
  {
    enterprise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enterprise',
      required: true,
      index: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseDriver',
      required: true,
      index: true,
    },

    driverName: {
      type: String,
      default: '',
      trim: true,
    },

    status: {
      type: String,
      enum: ['Activa', 'Finalizada'],
      default: 'Activa',
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    startedLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    endedLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDistanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

enterpriseDriverShiftSchema.index({ enterprise: 1, driverId: 1, status: 1 });
enterpriseDriverShiftSchema.index({ driverId: 1, startedAt: -1 });

module.exports = mongoose.model(
  'EnterpriseDriverShift',
  enterpriseDriverShiftSchema
);