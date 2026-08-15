const express = require("express");
const router = express.Router();

const authSuperAdmin = require("../middlewares/authSuperAdmin");

const {
    login,
    logout,
    me,
    dashboard,
    getEnterprisesOverview,
    getDriverApplications,
    getDriverApplicationById,
    approveDriverApplication,
    rejectDriverApplication,

    // Wallet conductores
    getCaptainWallets,
    topupCaptainWallet,
    getCaptainWalletTransactions,
} = require("../controllers/superAdmin.controller");

router.post("/login", login);
router.post("/logout", authSuperAdmin, logout);
router.get("/me", authSuperAdmin, me);
router.get("/dashboard", authSuperAdmin, dashboard);

// Empresas registradas y resumen administrativo por empresa
router.get(
    "/enterprises-overview",
    authSuperAdmin,
    getEnterprisesOverview
);

// Listado liviano de solicitudes.
// No descarga fotografías ni documentos privados.
router.get(
    "/driver-applications",
    authSuperAdmin,
    getDriverApplications
);

// Expediente privado de una solicitud.
// Los documentos se descargan solamente al abrir el expediente.
router.get(
    "/driver-applications/:id",
    authSuperAdmin,
    getDriverApplicationById
);

router.patch(
    "/driver-applications/:id/approve",
    authSuperAdmin,
    approveDriverApplication
);

router.patch(
    "/driver-applications/:id/reject",
    authSuperAdmin,
    rejectDriverApplication
);

// Saldo / wallet de conductores
router.get(
    "/captain-wallets",
    authSuperAdmin,
    getCaptainWallets
);

router.post(
    "/captain-wallets/:captainId/topup",
    authSuperAdmin,
    topupCaptainWallet
);

router.get(
    "/captain-wallets/:captainId/transactions",
    authSuperAdmin,
    getCaptainWalletTransactions
);

module.exports = router;