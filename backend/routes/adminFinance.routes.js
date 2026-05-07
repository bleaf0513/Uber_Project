const express = require("express");
const router = express.Router();

const adminFinanceController = require("../controllers/adminFinance.controller");

/**
 * Protección temporal para el módulo financiero.
 *
 * IMPORTANTE:
 * En Render debes crear una variable de entorno:
 *
 * ADMIN_FINANCE_SECRET=una_clave_larga_segura
 *
 * Para consumir estas rutas debes enviar el header:
 *
 * x-admin-finance-secret: tu_clave
 *
 * Más adelante podemos reemplazar esto por authSuperAdmin
 * cuando conectemos el panel visual administrativo.
 */
function adminFinanceGuard(req, res, next) {
    const secret = process.env.ADMIN_FINANCE_SECRET;

    if (!secret) {
        return res.status(500).json({
            ok: false,
            message: "ADMIN_FINANCE_SECRET no está configurado.",
        });
    }

    const provided =
        req.headers["x-admin-finance-secret"] ||
        req.query?.adminFinanceSecret ||
        "";

    if (String(provided) !== String(secret)) {
        return res.status(401).json({
            ok: false,
            message: "No autorizado.",
        });
    }

    return next();
}

router.use(adminFinanceGuard);

/**
 * GET /admin/finance/summary
 *
 * Devuelve:
 * - saldo total en billeteras
 * - total comisiones descontadas
 * - total recargas aprobadas
 * - recargas pendientes
 * - configuración actual de comisión
 */
router.get(
    "/summary",
    adminFinanceController.getSummary
);

/**
 * GET /admin/finance/topups
 *
 * Lista recargas.
 *
 * Query opcional:
 * ?status=pending
 * ?status=approved
 * ?status=rejected
 * ?method=nequi
 * ?limit=100
 */
router.get(
    "/topups",
    adminFinanceController.getTopups
);

/**
 * PATCH /admin/finance/topups/:topupId/approve
 *
 * Aprueba una recarga pendiente y suma saldo al conductor.
 *
 * Body opcional:
 * {
 *   "adminNotes": "Pago confirmado por Nequi"
 * }
 */
router.patch(
    "/topups/:topupId/approve",
    adminFinanceController.approveTopup
);

/**
 * PATCH /admin/finance/topups/:topupId/reject
 *
 * Rechaza una recarga pendiente.
 *
 * Body opcional:
 * {
 *   "adminNotes": "Comprobante no válido"
 * }
 */
router.patch(
    "/topups/:topupId/reject",
    adminFinanceController.rejectTopup
);

/**
 * GET /admin/finance/transactions
 *
 * Lista movimientos de billetera.
 *
 * Query opcional:
 * ?type=commission_debit
 * ?type=topup
 * ?captainId=ID_DEL_CONDUCTOR
 * ?limit=150
 */
router.get(
    "/transactions",
    adminFinanceController.getTransactions
);

/**
 * GET /admin/finance/commission-setting
 *
 * Devuelve la configuración actual:
 * - porcentaje
 * - comisión mínima
 * - saldo mínimo para aceptar servicios
 * - activo / inactivo
 */
router.get(
    "/commission-setting",
    adminFinanceController.getCommissionSetting
);

/**
 * PATCH /admin/finance/commission-setting
 *
 * Actualiza la configuración de comisión.
 *
 * Body ejemplo:
 * {
 *   "percentage": 10,
 *   "minimumCommission": 1000,
 *   "minimumBalanceToAccept": 5000,
 *   "active": true,
 *   "description": "Comisión general Central Go"
 * }
 */
router.patch(
    "/commission-setting",
    adminFinanceController.updateCommissionSetting
);

module.exports = router;