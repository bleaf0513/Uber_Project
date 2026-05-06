const userModel = require("../models/user.model");
const userService = require("../services/user.service");
const { validationResult } = require("express-validator");
const blacklistTokenModel = require("../models/blacklistToken.model");

const VALID_PUSH_PLATFORMS = ["web", "android", "ios", "unknown"];

const normalizePushPlatform = (platform) => {
    const value = String(platform || "unknown").trim().toLowerCase();

    if (VALID_PUSH_PLATFORMS.includes(value)) {
        return value;
    }

    return "unknown";
};

const cleanString = (value, maxLength = 500) => {
    return String(value || "").trim().slice(0, maxLength);
};

module.exports.registerUser = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { fullname, email, password } = req.body;

        const normalizedEmail = String(email || "").trim().toLowerCase();

        const isUserAlreadyExist = await userModel.findOne({
            email: normalizedEmail,
        });

        if (isUserAlreadyExist) {
            return res.status(400).json({
                message: "User already exist",
            });
        }

        const hashedPassword = await userModel.hashPassword(password);

        const user = await userService.createUsers({
            firstname: fullname.firstname,
            lastname: fullname.lastname,
            email: normalizedEmail,
            password: hashedPassword,
        });

        const token = user.generateAuthToken();

        return res.status(201).json({
            user,
            token,
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message,
        });
    }
};

module.exports.loginUser = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        const normalizedEmail = String(email || "").trim().toLowerCase();

        const user = await userModel
            .findOne({
                email: normalizedEmail,
            })
            .select("+password");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = user.generateAuthToken();

        res.cookie("token", token);

        const safeUser = await userModel.findById(user._id);

        return res.status(200).json({
            user: safeUser,
            token,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Error iniciando sesión.",
        });
    }
};

module.exports.getUserProfile = async (req, res, next) => {
    return res.status(200).json({
        user: req.user,
    });
};

module.exports.logoutUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

        if (token) {
            await blacklistTokenModel.create({ token });
        }

        res.clearCookie("token");

        return res.status(200).json({
            message: "Logged out successfully",
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Error cerrando sesión.",
        });
    }
};

/**
 * Guarda el token FCM del usuario.
 * Este token permite enviar notificaciones push cuando la app está cerrada
 * o en segundo plano.
 */
module.exports.registerPushToken = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({
                message: "Usuario no autenticado.",
            });
        }

        const token = cleanString(req.body.token, 4096);
        const platform = normalizePushPlatform(req.body.platform);
        const deviceId = cleanString(req.body.deviceId, 250);
        const userAgent = cleanString(
            req.body.userAgent || req.headers["user-agent"],
            500
        );

        if (!token) {
            return res.status(400).json({
                message: "Token push requerido.",
            });
        }

        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "Usuario no encontrado.",
            });
        }

        const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];

        const existingIndex = tokens.findIndex(
            (item) => String(item?.token || "") === token
        );

        const tokenPayload = {
            token,
            platform,
            deviceId,
            userAgent,
            active: true,
            lastUsedAt: new Date(),
        };

        if (existingIndex >= 0) {
            user.fcmTokens[existingIndex] = {
                ...user.fcmTokens[existingIndex],
                ...tokenPayload,
                createdAt: user.fcmTokens[existingIndex]?.createdAt || new Date(),
            };
        } else {
            user.fcmTokens.push({
                ...tokenPayload,
                createdAt: new Date(),
            });
        }

        /*
         * Mantenemos máximo 10 tokens activos por usuario para evitar
         * acumulación de navegadores viejos o dispositivos antiguos.
         */
        user.fcmTokens = user.fcmTokens
            .filter((item) => item?.token)
            .sort((a, b) => {
                const aTime = new Date(a.lastUsedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.lastUsedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, 10);

        await user.save();

        return res.status(200).json({
            ok: true,
            message: "Token push del usuario registrado correctamente.",
            tokensCount: user.fcmTokens.length,
        });
    } catch (error) {
        console.error("[user.registerPushToken] error:", error);

        return res.status(500).json({
            message: error.message || "Error registrando token push.",
        });
    }
};

/**
 * Desactiva un token push del usuario.
 * Útil cuando el usuario cierra sesión o cuando Firebase indique que el token ya no sirve.
 */
module.exports.unregisterPushToken = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({
                message: "Usuario no autenticado.",
            });
        }

        const token = cleanString(req.body.token, 4096);

        if (!token) {
            return res.status(400).json({
                message: "Token push requerido.",
            });
        }

        await userModel.updateOne(
            {
                _id: userId,
                "fcmTokens.token": token,
            },
            {
                $set: {
                    "fcmTokens.$.active": false,
                    "fcmTokens.$.lastUsedAt": new Date(),
                },
            }
        );

        return res.status(200).json({
            ok: true,
            message: "Token push del usuario desactivado correctamente.",
        });
    } catch (error) {
        console.error("[user.unregisterPushToken] error:", error);

        return res.status(500).json({
            message: error.message || "Error desactivando token push.",
        });
    }
};