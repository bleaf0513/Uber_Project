const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();

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

const userSchema = new mongoose.Schema(
    {
        fullname: {
            firstname: {
                type: String,
                required: true,
                trim: true,
                minlength: [3, "First name must be at least 3 characters long"],
            },

            lastname: {
                type: String,
                trim: true,
                minlength: [3, "Last name must be at least 3 characters long"],
            },
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: [5, "Email must be at least 6 characters long"],
            index: true,
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

        /*
         * Reputación del usuario dentro de Central GO.
         * El promedio se recalcula únicamente con servicios completados.
         */
        rating: {
            type: Number,
            default: 5,
            min: 0,
            max: 5,
        },

        /*
         * Número real de calificaciones recibidas.
         * Si es 0, el frontend puede mostrar "Nuevo" en vez de fingir historial.
         */
        ratingCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
         * Tokens de notificaciones push.
         * Aquí guardamos los dispositivos/navegadores del usuario
         * para poder avisarle aunque cierre la app.
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

userSchema.methods.generateAuthToken = function () {
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

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
};

userSchema.index({ email: 1 });
userSchema.index({ "fcmTokens.token": 1 });
userSchema.index({ rating: -1, ratingCount: -1 });

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;
