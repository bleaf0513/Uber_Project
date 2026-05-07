const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const walletController = require("../controllers/wallet.controller");

/**
 * Billetera del conductor
 *
 * Todas estas rutas requieren que el conductor esté autenticado
 * con authCaptain, igual que /rides/captain-offer, /rides/end-ride,
 * /rides/captain/active, etc.
 */

/**
 * GET /wallet/me
 *
 * Devuelve:
 * - saldo actual del conductor
 * - moneda
 * - fecha del último movimiento
 * - configuración actual de comisión
 */
router.get(
    "/me",
    authMiddleware.authCaptain,
    walletController.getMyWallet
);

/**
 * POST /wallet/topups
 *
 * Crea una solicitud de recarga pendiente.
 *
 * Body ejemplo:
 * {
 *   "amount": 20000,
 *   "method": "nequi",
 *   "paymentProofUrl": ""
 * }
 *
 * Métodos permitidos:
 * - nequi
 * - bancolombia
 * - pse
 * - manual
 * - wompi
 */
router.post(
    "/topups",
    authMiddleware.authCaptain,
    walletController.createTopup
);

/**
 * GET /wallet/topups
 *
 * Lista las recargas del conductor.
 *
 * Query opcional:
 * ?status=pending
 * ?status=approved
 * ?limit=50
 */
router.get(
    "/topups",
    authMiddleware.authCaptain,
    walletController.getMyTopups
);

/**
 * GET /wallet/movements
 *
 * Lista los movimientos de saldo del conductor:
 * - topup
 * - commission_debit
 * - refund
 * - adjustment
 * - manual_credit
 * - manual_debit
 *
 * Query opcional:
 * ?type=commission_debit
 * ?limit=50
 */
router.get(
    "/movements",
    authMiddleware.authCaptain,
    walletController.getMyMovements
);

module.exports = router;