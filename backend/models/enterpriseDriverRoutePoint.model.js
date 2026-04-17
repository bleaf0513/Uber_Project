const mongoose = require('mongoose');

const enterpriseDriverRoutePointSchema = new mongoose.Schema(
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

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseDriverShift',
      required: true,
      index: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    source: {
      type: String,
      enum: ['gps', 'manual'],
      default: 'gps',
    },
  },
  {
    timestamps: true,
  }
);

enterpriseDriverRoutePointSchema.index({ driverId: 1, shiftId: 1, recordedAt: 1 });
enterpriseDriverRoutePointSchema.index({ shiftId: 1, recordedAt: 1 });

module.exports = mongoose.model(
  'EnterpriseDriverRoutePoint',
  enterpriseDriverRoutePointSchema
);