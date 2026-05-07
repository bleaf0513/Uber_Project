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

        socketId: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
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
            capacity: {
                type: Number,
                required: true,
                min: [1, "Capacity must be at least 1"],
            },
            vehicleType: {
                type: String,
                required: true,
                enum: [
                    "motorcycle",
                    "car",
                    "light_cargo",
                    "van",
                    "truck",
                    "motocarro",
                    "pickup",
                    "moving",
                ],
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

        /*
         * Billetera interna del conductor.
         * Este saldo es el que Central Go usará para:
         * - validar si puede ofertar o aceptar servicios,
         * - descontar la comisión al finalizar un viaje,
         * - mostrar saldo disponible en el panel del conductor.
         *
         * El historial real de movimientos NO se guarda aquí,
         * se guarda en walletTransaction.model.js.
         */
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

        /*
         * Tokens de notificaciones push.
         * Aquí guardamos los dispositivos/navegadores del conductor
         * para avisarle cuando reciba ofertas de mercancía, espacio, cupos
         * o eventos importantes cuando esté fuera de la app.
         */
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
    const token = jwt.sign(
        {
            _id: this._id,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "24h",
        }
    );

    return token;
};

captainSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

captainSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
};

captainSchema.index({ email: 1 });
captainSchema.index({ status: 1 });
captainSchema.index({ "wallet.balance": 1 });
captainSchema.index({ "fcmTokens.token": 1 });

const captainModel = mongoose.model("captain", captainSchema);

module.exports = captainModel;