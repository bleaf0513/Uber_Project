const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const fcmTokenSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            trim: true,
        },
        platform: {
            type: String,
            enum: ["web", "android", "ios", "unknown"],
            default: "unknown",
        },
        deviceId: {
            type: String,
            trim: true,
            default: "",
        },
        userAgent: {
            type: String,
            trim: true,
            default: "",
        },
        active: {
            type: Boolean,
            default: true,
        },
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

const documentImageSchema = new mongoose.Schema(
    {
        front: {
            type: String,
            default: "",
            trim: true,
            select: false,
        },
        back: {
            type: String,
            default: "",
            trim: true,
            select: false,
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verifiedAt: {
            type: Date,
            default: null,
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null,
        },
    },
    {
        _id: false,
    }
);

const captainSchema = new mongoose.Schema(
    {
        fullname: {
            firstname: {
                type: String,
                required: true,
                minlength: [3, "First name must be at least 3 characters long"],
                trim: true,
            },
            lastname: {
                type: String,
                minlength: [3, "Last name must be at least 3 characters long"],
                trim: true,
            },
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, "Please enter a valid email"],
            minlength: [6, "Email must be at least 6 characters long"],
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        identification: {
            number: {
                type: String,
                trim: true,
                default: "",
            },
            type: {
                type: String,
                enum: ["CC", "CE", "PASSPORT", "OTHER"],
                default: "CC",
            },
        },

        socketId: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: [
                "pending_review",
                "active",
                "inactive",
                "rejected",
                "suspended",
            ],
            default: "pending_review",
        },

        verification: {
            status: {
                type: String,
                enum: [
                    "pending",
                    "approved",
                    "rejected",
                    "needs_changes",
                ],
                default: "pending",
            },
            reviewedAt: {
                type: Date,
                default: null,
            },
            reviewedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "user",
                default: null,
            },
            notes: {
                type: String,
                trim: true,
                default: "",
            },
        },

        vehicle: {
            color: {
                type: String,
                required: true,
                minlength: [3, "Color must be at least 3 characters long"],
                trim: true,
            },
            plate: {
                type: String,
                required: true,
                minlength: [3, "Plate must be at least 3 characters long"],
                uppercase: true,
                trim: true,
            },
            brand: {
                type: String,
                trim: true,
                default: "",
            },
            reference: {
                type: String,
                trim: true,
                default: "",
            },
            model: {
                type: String,
                trim: true,
                default: "",
            },
            capacity: {
                type: Number,
                required: true,
                min: [1, "Capacity must be at least 1"],
            },
            capacityUnit: {
                type: String,
                enum: ["kg", "ton"],
                default: "kg",
            },
            capacityKg: {
                type: Number,
                required: true,
                min: [1, "Capacity in kg must be at least 1"],
            },
            vehicleType: {
                type: String,
                required: true,
                enum: [
                    "motorcycle",
                    "car",
                    "motocarro",
                    "pickup",
                    "van",
                    "light_truck",
                    "medium_truck",
                    "heavy_truck",
                    "simple_truck",
                    "double_troque",
                    "dump_truck",
                    "mini_trailer",
                    "tractor_trailer",
                    "lowboy",
                    "special_vehicle",
                ],
            },
            bodyType: {
                type: String,
                enum: [
                    "not_specified",
                    "closed_van",
                    "stakes",
                    "platform",
                    "refrigerated",
                    "dump",
                    "tank",
                    "container_carrier",
                    "lowboy",
                    "open_body",
                    "other",
                ],
                default: "not_specified",
            },
            axleCount: {
                type: Number,
                min: 1,
                default: null,
            },
            photo: {
                type: String,
                trim: true,
                default: "",
                select: false,
            },
        },

        documents: {
            identificationCard: {
                type: documentImageSchema,
                default: () => ({}),
            },
            drivingLicense: {
                type: documentImageSchema,
                default: () => ({}),
            },
            vehicleRegistration: {
                type: documentImageSchema,
                default: () => ({}),
            },
        },

        location: {
            ltd: {
                type: Number,
                default: null,
            },
            lng: {
                type: Number,
                default: null,
            },
        },

        profileImage: {
            type: String,
            default: "",
            trim: true,
        },

        rating: {
            type: Number,
            default: 5,
            min: 0,
            max: 5,
        },

        /*
         * Cantidad real de calificaciones recibidas.
         * Permite diferenciar un conductor nuevo de uno con historial.
         */
        ratingCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        onlineSession: {
            isOnline: {
                type: Boolean,
                default: false,
            },
            sessionStartedAt: {
                type: Date,
                default: null,
            },
            startedAt: {
                type: Date,
                default: null,
            },
            lastSeenAt: {
                type: Date,
                default: null,
            },
        },

        stats: {
            hoursOnline: {
                type: Number,
                default: 0,
                min: 0,
            },
            totalDistanceKm: {
                type: Number,
                default: 0,
                min: 0,
            },
            totalEarning: {
                type: Number,
                default: 0,
                min: 0,
            },
            cashCollected: {
                type: Number,
                default: 0,
                min: 0,
            },
            transferCollected: {
                type: Number,
                default: 0,
                min: 0,
            },
            totalTrips: {
                type: Number,
                default: 0,
                min: 0,
            },
            pendingToSettle: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        wallet: {
            balance: {
                type: Number,
                default: 0,
                min: 0,
            },
            currency: {
                type: String,
                default: "COP",
                enum: ["COP"],
            },
            lastMovementAt: {
                type: Date,
                default: null,
            },
        },

        fcmTokens: {
            type: [fcmTokenSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

captainSchema.methods.generateAuthToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "24h",
        }
    );
};

captainSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

captainSchema.statics.hashPassword = async function (password) {
    return bcrypt.hash(password, 10);
};

captainSchema.pre("validate", function (next) {
    if (!this.vehicle) {
        next();
        return;
    }

    const capacity = Number(this.vehicle.capacity);
    const unit = this.vehicle.capacityUnit || "kg";

    if (Number.isFinite(capacity) && capacity > 0) {
        this.vehicle.capacityKg =
            unit === "ton"
                ? capacity * 1000
                : capacity;
    }

    next();
});

captainSchema.index({ status: 1 });
captainSchema.index({ "verification.status": 1 });
captainSchema.index({ "wallet.balance": 1 });
captainSchema.index({ "fcmTokens.token": 1 });
captainSchema.index({ "vehicle.vehicleType": 1 });
captainSchema.index({ "vehicle.capacityKg": 1 });
captainSchema.index({ "identification.number": 1 });

const captainModel = mongoose.model("captain", captainSchema);

module.exports = captainModel;