const admin = require("firebase-admin");
const User = require("../models/user.model");
const Captain = require("../models/captain.model");

let firebaseReady = false;

function normalizePrivateKey(value) {
    if (!value) return "";

    return String(value)
        .replace(/^"|"$/g, "")
        .replace(/\\n/g, "\n");
}

function initFirebase() {
    if (firebaseReady) return true;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

        if (!projectId || !clientEmail || !privateKey) {
            console.warn("[push] Firebase env vars incompletas. Push desactivado.");
            return false;
        }

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        }

        firebaseReady = true;
        console.log("[push] Firebase Admin inicializado correctamente.");
        return true;
    } catch (error) {
        console.error("[push] Error inicializando Firebase:", error);
        return false;
    }
}

function cleanString(value, maxLength = 500) {
    return String(value || "").trim().slice(0, maxLength);
}

function normalizeData(data = {}) {
    const normalized = {};

    Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (typeof value === "object") {
            normalized[key] = JSON.stringify(value);
        } else {
            normalized[key] = String(value);
        }
    });

    return normalized;
}

function getActiveTokens(doc) {
    const tokens = Array.isArray(doc?.fcmTokens) ? doc.fcmTokens : [];

    return tokens
        .filter((item) => item?.token && item?.active !== false)
        .map((item) => String(item.token).trim())
        .filter(Boolean);
}

async function deactivateInvalidTokens({ model, ownerId, invalidTokens }) {
    if (!ownerId || !Array.isArray(invalidTokens) || invalidTokens.length === 0) {
        return;
    }

    await model.updateOne(
        { _id: ownerId },
        {
            $set: {
                "fcmTokens.$[tokenItem].active": false,
                "fcmTokens.$[tokenItem].lastUsedAt": new Date(),
            },
        },
        {
            arrayFilters: [
                {
                    "tokenItem.token": { $in: invalidTokens },
                },
            ],
        }
    );
}

async function sendToTokens(tokens, payload = {}) {
    if (!initFirebase()) {
        return {
            ok: false,
            sent: 0,
            failed: 0,
            invalidTokens: [],
            reason: "firebase_not_configured",
        };
    }

    const uniqueTokens = [...new Set(tokens || [])].filter(Boolean);

    if (uniqueTokens.length === 0) {
        return {
            ok: false,
            sent: 0,
            failed: 0,
            invalidTokens: [],
            reason: "no_tokens",
        };
    }

    const title = cleanString(payload.title || "Central Go", 120);
    const body = cleanString(payload.body || "Tienes una nueva notificación.", 250);

    const message = {
        tokens: uniqueTokens,
        notification: {
            title,
            body,
        },
        data: normalizeData({
            type: payload.type || "centralgo_notification",
            click_action: payload.clickAction || "OPEN_APP",
            ...payload.data,
        }),
        android: {
            priority: "high",
            notification: {
                title,
                body,
                channelId: payload.channelId || "centralgo_general",
                sound: "default",
                priority: "high",
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: "default",
                    badge: 1,
                },
            },
        },
        webpush: {
            notification: {
                title,
                body,
                icon: payload.icon || "/logo-centralgo.png",
                badge: payload.badge || "/logo-centralgo.png",
                requireInteraction: Boolean(payload.requireInteraction),
            },
            fcmOptions: {
                link: payload.link || process.env.FRONTEND_URL || "/",
            },
        },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const invalidTokens = [];

    response.responses.forEach((result, index) => {
        if (!result.success) {
            const code = result?.error?.code || "";

            if (
                code.includes("registration-token-not-registered") ||
                code.includes("invalid-registration-token") ||
                code.includes("invalid-argument")
            ) {
                invalidTokens.push(uniqueTokens[index]);
            }

            console.warn("[push] Error enviando token:", {
                token: uniqueTokens[index]?.slice(0, 18) + "...",
                code,
                message: result?.error?.message,
            });
        }
    });

    return {
        ok: response.successCount > 0,
        sent: response.successCount,
        failed: response.failureCount,
        invalidTokens,
    };
}

async function sendToUser(userId, payload = {}) {
    try {
        const user = await User.findById(userId).select("fcmTokens");

        if (!user) {
            return {
                ok: false,
                reason: "user_not_found",
            };
        }

        const tokens = getActiveTokens(user);
        const result = await sendToTokens(tokens, payload);

        if (result.invalidTokens?.length > 0) {
            await deactivateInvalidTokens({
                model: User,
                ownerId: user._id,
                invalidTokens: result.invalidTokens,
            });
        }

        return result;
    } catch (error) {
        console.error("[push] sendToUser error:", error);

        return {
            ok: false,
            reason: error.message,
        };
    }
}

async function sendToCaptain(captainId, payload = {}) {
    try {
        const captain = await Captain.findById(captainId).select("fcmTokens");

        if (!captain) {
            return {
                ok: false,
                reason: "captain_not_found",
            };
        }

        const tokens = getActiveTokens(captain);
        const result = await sendToTokens(tokens, payload);

        if (result.invalidTokens?.length > 0) {
            await deactivateInvalidTokens({
                model: Captain,
                ownerId: captain._id,
                invalidTokens: result.invalidTokens,
            });
        }

        return result;
    } catch (error) {
        console.error("[push] sendToCaptain error:", error);

        return {
            ok: false,
            reason: error.message,
        };
    }
}

module.exports = {
    initFirebase,
    sendToUser,
    sendToCaptain,
    sendToTokens,
};