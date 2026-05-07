const topupModel = require("../models/topup.model");
const walletTransactionModel = require("../models/walletTransaction.model");
const walletService = require("../services/wallet.service");

function makeTopupReference(captainId) {
    const shortId = String(captainId || "")
        .slice(-6)
        .toUpperCase();

    const random = Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `CG-${shortId}-${Date.now()}-${random}`;
}

function normalizeTopupMethod(method) {
    const safeMethod = String(method || "manual")
        .trim()
        .toLowerCase();

    const allowedMethods = ["nequi", "bancolombia", "pse", "manual", "wompi"];

    if (!allowedMethods.includes(safeMethod)) {
        return null;
    }

    return safeMethod;
}

module.exports.getMyWallet = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                ok: false,
                message: "Conductor no autenticado.",
            });
        }

        const captain = await walletService.getCaptainWallet(captainId);
        const setting = await walletService.getDefaultCommissionSetting();

        return res.status(200).json({
            ok: true,
            wallet: {
                balance: captain.wallet?.balance || 0,
                currency: captain.wallet?.currency || "COP",
                lastMovementAt: captain.wallet?.lastMovementAt || null,
            },
            commission: {
                percentage: setting.percentage,
                minimumCommission: setting.minimumCommission,
                minimumBalanceToAccept: setting.minimumBalanceToAccept,
                active: setting.active,
                description: setting.description || "Comisión general Central Go",
            },
        });
    } catch (error) {
        console.error("[wallet.getMyWallet] error:", error);

        return res.status(error.statusCode || 500).json({
            ok: false,
            message: error.message || "Error consultando billetera.",
            code: error.code || "WALLET_ERROR",
        });
    }
};

module.exports.createTopup = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                ok: false,
                message: "Conductor no autenticado.",
            });
        }

        const amount = Number(req.body?.amount || 0);
        const method = normalizeTopupMethod(req.body?.method);
        const paymentProofUrl = String(req.body?.paymentProofUrl || "").trim();

        if (!method) {
            return res.status(400).json({
                ok: false,
                message: "Método de recarga inválido.",
            });
        }

        if (!Number.isFinite(amount) || amount < 1000) {
            return res.status(400).json({
                ok: false,
                message: "La recarga mínima es de $1.000 COP.",
            });
        }

        const roundedAmount = Math.round(amount);
        const reference = makeTopupReference(captainId);

        const topup = await topupModel.create({
            captain: captainId,
            amount: roundedAmount,
            currency: "COP",
            method,
            reference,
            status: "pending",
            paymentProofUrl,
            metadata: {
                createdFrom: "captain_app",
                userAgent: req.headers["user-agent"] || "",
                ip: req.ip || "",
            },
        });

        return res.status(201).json({
            ok: true,
            message:
                "Recarga creada. Cuando el pago sea confirmado, el saldo se actualizará.",
            topup,
            paymentInstructions: {
                reference,
                amount: roundedAmount,
                currency: "COP",
                method,
                note:
                    "En esta fase la recarga queda pendiente para aprobación administrativa. Luego se puede conectar Wompi para aprobación automática.",
            },
        });
    } catch (error) {
        console.error("[wallet.createTopup] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error creando recarga.",
        });
    }
};

module.exports.getMyTopups = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                ok: false,
                message: "Conductor no autenticado.",
            });
        }

        const limitParam = Number(req.query?.limit || 50);
        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
            100
        );

        const status = String(req.query?.status || "").trim();

        const filter = {
            captain: captainId,
        };

        if (status) {
            filter.status = status;
        }

        const topups = await topupModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            ok: true,
            count: topups.length,
            topups,
        });
    } catch (error) {
        console.error("[wallet.getMyTopups] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando recargas.",
        });
    }
};

module.exports.getMyMovements = async (req, res) => {
    try {
        const captainId = req.captain?._id;

        if (!captainId) {
            return res.status(401).json({
                ok: false,
                message: "Conductor no autenticado.",
            });
        }

        const limitParam = Number(req.query?.limit || 50);
        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
            100
        );

        const type = String(req.query?.type || "").trim();

        const filter = {
            captain: captainId,
        };

        if (type) {
            filter.type = type;
        }

        const movements = await walletTransactionModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("ride", "pickup destination fare offeredFare status createdAt completedAt")
            .populate("topup", "reference method status amount createdAt approvedAt");

        return res.status(200).json({
            ok: true,
            count: movements.length,
            movements,
        });
    } catch (error) {
        console.error("[wallet.getMyMovements] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando movimientos.",
        });
    }
};