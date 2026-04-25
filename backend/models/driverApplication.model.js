const mongoose = require('mongoose');

const driverApplicationSchema = new mongoose.Schema(
    {
        fullname: {
            firstname: {
                type: String,
                required: true,
                trim: true,
            },
            lastname: {
                type: String,
                default: '',
                trim: true,
            },
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        vehicle: {
            color: {
                type: String,
                required: true,
                trim: true,
            },
            plate: {
                type: String,
                required: true,
                uppercase: true,
                trim: true,
            },
            capacity: {
                type: Number,
                required: true,
                min: 1,
            },
            vehicleType: {
                type: String,
                required: true,
                enum: ['motorcycle', 'car', 'light_cargo', 'van', 'truck'],
            },
        },

        documents: {
            drivingLicenseImage: {
                type: String,
                required: true,
            },
            vehicleRegistrationImage: {
                type: String,
                required: true,
            },
        },

        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },

        rejectionReason: {
            type: String,
            default: '',
            trim: true,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SuperAdmin',
            default: null,
        },

        approvedCaptainId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'captain',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

driverApplicationSchema.index({ email: 1, status: 1 });
driverApplicationSchema.index({ 'vehicle.plate': 1, status: 1 });

module.exports = mongoose.model('DriverApplication', driverApplicationSchema);