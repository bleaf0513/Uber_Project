const captainModel = require("../models/captain.model");
const topupModel = require("../models/topup.model");
const walletTransactionModel = require("../models/walletTransaction.model");
const commissionSettingModel = require("../models/commissionSetting.model");
const walletService = require("../services/wallet.service");

function normalizeBoolean(value, defaultValue = true) {
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
        const safeValue = value.trim().toLowerCase();

        if (safeValue === "true") return true;
        if (safeValue === "false") return false;
    }

    return defaultValue;
}

module.exports.getSummary = async (req, res) => {
    try {
        const totalWalletAgg = await captainModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalBalance: {
                        $sum: {
                            $ifNull: ["$wallet.balance", 0],
                        },
                    },
                    captains: {
                        $sum: 1,
                    },
                },
            },
        ]);

        const commissionAgg = await walletTransactionModel.aggregate([
            {
                $match: {
                    type: "commission_debit",
                },
            },
            {
                $group: {
                    _id: null,
                    totalCommission: {
                        $sum: "$amount",
                    },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]);

        const approvedTopupAgg = await topupModel.aggregate([
            {
                $match: {
                    status: "approved",
                },
            },
            {
                $group: {
                    _id: null,
                    totalTopups: {
                        $sum: "$amount",
                    },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]);

        const pendingTopups = await topupModel.countDocuments({
            status: "pending",
        });

        const rejectedTopups = await topupModel.countDocuments({
            status: "rejected",
        });

        const setting = await walletService.getDefaultCommissionSetting();

        return res.status(200).json({
            ok: true,
            summary: {
                totalWalletBalance: totalWalletAgg[0]?.totalBalance || 0,
                totalCaptains: totalWalletAgg[0]?.captains || 0,
                totalCommission: commissionAgg[0]?.totalCommission || 0,
                commissionCount: commissionAgg[0]?.count || 0,
                totalApprovedTopups: approvedTopupAgg[0]?.totalTopups || 0,
                approvedTopupCount: approvedTopupAgg[0]?.count || 0,
                pendingTopups,
                rejectedTopups,
            },
            commissionSetting: setting,
        });
    } catch (error) {
        console.error("[adminFinance.getSummary] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando resumen financiero.",
        });
    }
};

module.exports.getTopups = async (req, res) => {
    try {
        const status = String(req.query?.status || "").trim();
        const method = String(req.query?.method || "").trim();
        const limitParam = Number(req.query?.limit || 100);

        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100,
            200
        );

        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (method) {
            filter.method = method;
        }

        const topups = await topupModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("captain", "fullname email phone wallet vehicle status");

        return res.status(200).json({
            ok: true,
            count: topups.length,
            topups,
        });
    } catch (error) {
        console.error("[adminFinance.getTopups] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando recargas.",
        });
    }
};

module.exports.approveTopup = async (req, res) => {
    try {
        const { topupId } = req.params;

        const topup = await topupModel.findById(topupId);

        if (!topup) {
            return res.status(404).json({
                ok: false,
                message: "Recarga no encontrada.",
            });
        }

        if (topup.status === "approved") {
            return res.status(400).json({
                ok: false,
                message: "Esta recarga ya fue aprobada.",
            });
        }

        if (topup.status !== "pending") {
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden aprobar recargas pendientes.",
            });
        }

        topup.status = "approved";
        topup.approvedAt = new Date();
        topup.adminNotes = String(req.body?.adminNotes || topup.adminNotes || "")
            .trim()
            .slice(0, 500);

        await topup.save();

        const walletResult = await walletService.creditCaptainWallet({
            captainId: topup.captain,
            amount: topup.amount,
            type: "topup",
            description: `Recarga aprobada por ${topup.method}`,
            topup: topup._id,
            reference: topup.reference,
            metadata: {
                method: topup.method,
                approvedBy: "admin_finance",
                adminNotes: topup.adminNotes,
            },
        });

        const populatedTopup = await topupModel
            .findById(topup._id)
            .populate("captain", "fullname email phone wallet vehicle status");

        return res.status(200).json({
            ok: true,
            message: "Recarga aprobada y saldo actualizado.",
            topup: populatedTopup,
            wallet: walletResult,
        });
    } catch (error) {
        console.error("[adminFinance.approveTopup] error:", error);

        return res.status(error.statusCode || 500).json({
            ok: false,
            message: error.message || "Error aprobando recarga.",
            code: error.code || "APPROVE_TOPUP_ERROR",
        });
    }
};

module.exports.rejectTopup = async (req, res) => {
    try {
        const { topupId } = req.params;

        const topup = await topupModel.findById(topupId);

        if (!topup) {
            return res.status(404).json({
                ok: false,
                message: "Recarga no encontrada.",
            });
        }

        if (topup.status !== "pending") {
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden rechazar recargas pendientes.",
            });
        }

        topup.status = "rejected";
        topup.rejectedAt = new Date();
        topup.adminNotes = String(req.body?.adminNotes || "")
            .trim()
            .slice(0, 500);

        await topup.save();

        const populatedTopup = await topupModel
            .findById(topup._id)
            .populate("captain", "fullname email phone wallet vehicle status");

        return res.status(200).json({
            ok: true,
            message: "Recarga rechazada correctamente.",
            topup: populatedTopup,
        });
    } catch (error) {
        console.error("[adminFinance.rejectTopup] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error rechazando recarga.",
        });
    }
};

module.exports.getTransactions = async (req, res) => {
    try {
        const type = String(req.query?.type || "").trim();
        const captainId = String(req.query?.captainId || "").trim();
        const limitParam = Number(req.query?.limit || 150);

        const limit = Math.min(
            Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 150,
            300
        );

        const filter = {};

        if (type) {
            filter.type = type;
        }

        if (captainId) {
            filter.captain = captainId;
        }

        const transactions = await walletTransactionModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("captain", "fullname email phone wallet vehicle status")
            .populate("ride", "pickup destination fare offeredFare status createdAt completedAt")
            .populate("topup", "reference method status amount createdAt approvedAt");

        return res.status(200).json({
            ok: true,
            count: transactions.length,
            transactions,
        });
    } catch (error) {
        console.error("[adminFinance.getTransactions] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando transacciones.",
        });
    }
};

module.exports.getCommissionSetting = async (req, res) => {
    try {
        const setting = await walletService.getDefaultCommissionSetting();

        return res.status(200).json({
            ok: true,
            setting,
        });
    } catch (error) {
        console.error("[adminFinance.getCommissionSetting] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error consultando configuración.",
        });
    }
};

module.exports.updateCommissionSetting = async (req, res) => {
    try {
        const percentage = Number(req.body?.percentage);
        const minimumCommission = Number(req.body?.minimumCommission);
        const minimumBalanceToAccept = Number(req.body?.minimumBalanceToAccept);
        const active = normalizeBoolean(req.body?.active, true);
        const description = String(
            req.body?.description || "Comisión general Central Go"
        )
            .trim()
            .slice(0, 300);

        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({
                ok: false,
                message: "Porcentaje inválido. Debe estar entre 0 y 100.",
            });
        }

        if (!Number.isFinite(minimumCommission) || minimumCommission < 0) {
            return res.status(400).json({
                ok: false,
                message: "Comisión mínima inválida.",
            });
        }

        if (
            !Number.isFinite(minimumBalanceToAccept) ||
            minimumBalanceToAccept < 0
        ) {
            return res.status(400).json({
                ok: false,
                message: "Saldo mínimo inválido.",
            });
        }

        const setting = await commissionSettingModel.findOneAndUpdate(
            {
                key: "default",
            },
            {
                $set: {
                    percentage: Math.round(percentage * 100) / 100,
                    minimumCommission: Math.round(minimumCommission),
                    minimumBalanceToAccept: Math.round(minimumBalanceToAccept),
                    active,
                    description,
                    updatedBy: "admin_finance",
                },
            },
            {
                new: true,
                upsert: true,
            }
        );

        return res.status(200).json({
            ok: true,
            message: "Configuración de comisión actualizada.",
            setting,
        });
    } catch (error) {
        console.error("[adminFinance.updateCommissionSetting] error:", error);

        return res.status(500).json({
            ok: false,
            message: error.message || "Error actualizando configuración.",
        });
    }
};