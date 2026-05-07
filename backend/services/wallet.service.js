const captainModel = require("../models/captain.model");
const walletTransactionModel = require("../models/walletTransaction.model");
const commissionSettingModel = require("../models/commissionSetting.model");

function roundMoney(value) {
    const number = Number(value) || 0;
    return Math.max(0, Math.round(number));
}

async function getDefaultCommissionSetting() {
    let setting = await commissionSettingModel.findOne({
        key: "default",
    });

    if (!setting) {
        setting = await commissionSettingModel.create({
            key: "default",
            percentage: 10,
            minimumCommission: 1000,
            minimumBalanceToAccept: 5000,
            active: true,
            description: "Comisión general Central Go",
            updatedBy: "system",
        });
    }

    return setting;
}

async function getCaptainWallet(captainId) {
    const captain = await captainModel
        .findById(captainId)
        .select("fullname email wallet status");

    if (!captain) {
        const error = new Error("Conductor no encontrado.");
        error.statusCode = 404;
        error.code = "CAPTAIN_NOT_FOUND";
        throw error;
    }

    if (!captain.wallet) {
        captain.wallet = {
            balance: 0,
            currency: "COP",
            lastMovementAt: null,
        };

        await captain.save();
    }

    if (!captain.wallet.currency) {
        captain.wallet.currency = "COP";
        await captain.save();
    }

    return captain;
}

async function assertCaptainCanAcceptRide(captainId) {
    const setting = await getDefaultCommissionSetting();

    if (!setting.active) {
        return {
            ok: true,
            setting,
            reason: "COMMISSION_DISABLED",
        };
    }

    const captain = await getCaptainWallet(captainId);

    const balance = roundMoney(captain.wallet?.balance || 0);
    const minimumBalanceToAccept = roundMoney(
        setting.minimumBalanceToAccept || 0
    );

    if (balance < minimumBalanceToAccept) {
        const error = new Error(
            `Saldo insuficiente. Debes tener mínimo $${minimumBalanceToAccept.toLocaleString(
                "es-CO"
            )} COP para aceptar u ofertar servicios.`
        );

        error.statusCode = 402;
        error.code = "INSUFFICIENT_WALLET_BALANCE";
        error.wallet = {
            balance,
            minimumBalanceToAccept,
            currency: "COP",
        };

        throw error;
    }

    return {
        ok: true,
        setting,
        balance,
        minimumBalanceToAccept,
    };
}

function calculateCommission(fare, setting) {
    const rideFare = roundMoney(fare);

    if (!setting?.active) {
        return 0;
    }

    if (rideFare <= 0) {
        return 0;
    }

    const percentage = Number(setting?.percentage || 0);
    const minimumCommission = roundMoney(setting?.minimumCommission || 0);

    const percentageCommission = roundMoney((rideFare * percentage) / 100);

    return Math.max(percentageCommission, minimumCommission);
}

async function debitCaptainWallet({
    captainId,
    amount,
    type,
    description,
    ride = null,
    topup = null,
    reference = "",
    metadata = {},
}) {
    const safeAmount = roundMoney(amount);

    if (safeAmount <= 0) {
        const error = new Error("El valor a descontar debe ser mayor a cero.");
        error.statusCode = 400;
        error.code = "INVALID_DEBIT_AMOUNT";
        throw error;
    }

    const captain = await getCaptainWallet(captainId);

    const balanceBefore = roundMoney(captain.wallet?.balance || 0);
    const balanceAfter = Math.max(0, balanceBefore - safeAmount);

    captain.wallet.balance = balanceAfter;
    captain.wallet.currency = "COP";
    captain.wallet.lastMovementAt = new Date();

    await captain.save();

    const transaction = await walletTransactionModel.create({
        captain: captainId,
        type: type || "manual_debit",
        amount: safeAmount,
        currency: "COP",
        balanceBefore,
        balanceAfter,
        description: description || "Débito de billetera Central Go",
        ride,
        topup,
        reference,
        metadata,
    });

    return {
        ok: true,
        balanceBefore,
        balanceAfter,
        transaction,
    };
}

async function creditCaptainWallet({
    captainId,
    amount,
    type,
    description,
    ride = null,
    topup = null,
    reference = "",
    metadata = {},
}) {
    const safeAmount = roundMoney(amount);

    if (safeAmount <= 0) {
        const error = new Error("El valor a acreditar debe ser mayor a cero.");
        error.statusCode = 400;
        error.code = "INVALID_CREDIT_AMOUNT";
        throw error;
    }

    const captain = await getCaptainWallet(captainId);

    const balanceBefore = roundMoney(captain.wallet?.balance || 0);
    const balanceAfter = balanceBefore + safeAmount;

    captain.wallet.balance = balanceAfter;
    captain.wallet.currency = "COP";
    captain.wallet.lastMovementAt = new Date();

    await captain.save();

    const transaction = await walletTransactionModel.create({
        captain: captainId,
        type: type || "topup",
        amount: safeAmount,
        currency: "COP",
        balanceBefore,
        balanceAfter,
        description: description || "Recarga de saldo Central Go",
        ride,
        topup,
        reference,
        metadata,
    });

    return {
        ok: true,
        balanceBefore,
        balanceAfter,
        transaction,
    };
}

async function debitCommissionForRide(ride) {
    if (!ride?._id) {
        return {
            charged: false,
            reason: "RIDE_MISSING",
        };
    }

    if (!ride?.captain) {
        return {
            charged: false,
            reason: "CAPTAIN_MISSING",
        };
    }

    const existingTransaction = await walletTransactionModel.findOne({
        ride: ride._id,
        type: "commission_debit",
    });

    if (existingTransaction) {
        return {
            charged: false,
            alreadyCharged: true,
            reason: "COMMISSION_ALREADY_CHARGED",
            transaction: existingTransaction,
        };
    }

    const setting = await getDefaultCommissionSetting();

    if (!setting.active) {
        return {
            charged: false,
            reason: "COMMISSION_DISABLED",
            setting,
        };
    }

    const fare = roundMoney(
        ride.fare ?? ride.offeredFare ?? ride.suggestedFare ?? 0
    );

    const commission = calculateCommission(fare, setting);

    if (commission <= 0) {
        return {
            charged: false,
            reason: "ZERO_COMMISSION",
            setting,
            fare,
        };
    }

    const captainId = ride.captain?._id || ride.captain;

    const result = await debitCaptainWallet({
        captainId,
        amount: commission,
        type: "commission_debit",
        description: `Comisión Central Go ${setting.percentage}% del viaje`,
        ride: ride._id,
        reference: `COMMISSION-${ride._id}`,
        metadata: {
            fare,
            percentage: setting.percentage,
            minimumCommission: setting.minimumCommission,
            minimumBalanceToAccept: setting.minimumBalanceToAccept,
        },
    });

    return {
        charged: true,
        commission,
        fare,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        transaction: result.transaction,
        setting,
    };
}

async function refundCommissionForRide({ ride, reason = "" }) {
    if (!ride?._id || !ride?.captain) {
        return {
            refunded: false,
            reason: "RIDE_OR_CAPTAIN_MISSING",
        };
    }

    const commissionTransaction = await walletTransactionModel.findOne({
        ride: ride._id,
        type: "commission_debit",
    });

    if (!commissionTransaction) {
        return {
            refunded: false,
            reason: "COMMISSION_TRANSACTION_NOT_FOUND",
        };
    }

    const existingRefund = await walletTransactionModel.findOne({
        ride: ride._id,
        type: "refund",
        reference: `REFUND-COMMISSION-${ride._id}`,
    });

    if (existingRefund) {
        return {
            refunded: false,
            alreadyRefunded: true,
            transaction: existingRefund,
        };
    }

    const captainId = ride.captain?._id || ride.captain;

    const result = await creditCaptainWallet({
        captainId,
        amount: commissionTransaction.amount,
        type: "refund",
        description: reason || "Devolución de comisión Central Go",
        ride: ride._id,
        reference: `REFUND-COMMISSION-${ride._id}`,
        metadata: {
            originalTransaction: commissionTransaction._id,
        },
    });

    return {
        refunded: true,
        amount: commissionTransaction.amount,
        transaction: result.transaction,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
    };
}

module.exports = {
    roundMoney,
    getDefaultCommissionSetting,
    getCaptainWallet,
    assertCaptainCanAcceptRide,
    calculateCommission,
    debitCaptainWallet,
    creditCaptainWallet,
    debitCommissionForRide,
    refundCommissionForRide,
};