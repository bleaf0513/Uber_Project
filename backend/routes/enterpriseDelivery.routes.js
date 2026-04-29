const express = require('express');
const router = express.Router();

const authEnterprise = require('../middlewares/authEnterprise');
const authEnterpriseDriver = require('../middlewares/authEnterpriseDriver');

const {
    getEnterpriseDeliveries,
    getMyEnterpriseDeliveries,
    createEnterpriseDelivery,
    updateEnterpriseDeliveryStatusByDriver,
    deleteEnterpriseDelivery,

    // Rutas inteligentes
    getPendingRouteDeliveries,
    optimizeEnterpriseRoutes,
    assignOptimizedRoute,
} = require('../controllers/enterpriseDelivery.controller');

router.get('/', authEnterprise, getEnterpriseDeliveries);

/**
 * Entregas del conductor autenticado.
 */
router.get('/me', authEnterpriseDriver, getMyEnterpriseDeliveries);

/**
 * RUTAS INTELIGENTES
 *
 * Importante:
 * Estas rutas deben ir ANTES de /:id/status
 * para evitar que Express confunda "pending-routes" con un id.
 */
router.get('/pending-routes', authEnterprise, getPendingRouteDeliveries);
router.post('/optimize-routes', authEnterprise, optimizeEnterpriseRoutes);
router.post('/assign-route', authEnterprise, assignOptimizedRoute);

/**
 * Crear entrega.
 * Ahora puede venir con:
 * - assignedDriverId = ID real del conductor
 * - assignedDriverId = "PENDING_ROUTE"
 */
router.post('/', authEnterprise, createEnterpriseDelivery);

/**
 * Actualizar estado desde conductor.
 */
router.patch('/:id/status', authEnterpriseDriver, updateEnterpriseDeliveryStatusByDriver);

/**
 * Eliminar entrega desde empresa.
 */
router.delete('/:id', authEnterprise, deleteEnterpriseDelivery);

module.exports = router;