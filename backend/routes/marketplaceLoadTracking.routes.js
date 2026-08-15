const express = require("express");

const router = express.Router();

const {
    authUser,
    authCaptain,
} = require("../middlewares/auth.middleware");

const {
    ensureTrackingForAssignedLoad,
    activateProfessionalTracking,
    updateMarketplaceLocation,
    updateTrackingStatus,
    getCustomerTracking,
    getCaptainTracking,
    getMyCustomerTrackings,
    getMyCaptainTrackings,
} = require(
    "../controllers/marketplaceLoadTracking.controller"
);

/*
 * =========================================================
 * SEGUIMIENTO DE CARGAS DEL MARKETPLACE
 * =========================================================
 *
 * Estas rutas son totalmente independientes de:
 *
 * /enterprise-drivers
 * /enterprise-deliveries
 *
 * No modifican el funcionamiento empresarial.
 */

/*
 * =========================================================
 * RUTAS DEL CLIENTE
 * =========================================================
 */

/*
 * Ver todos los seguimientos pertenecientes al usuario.
 *
 * GET:
 * /marketplace-load-tracking/customer/my-trackings
 */
router.get(
    "/customer/my-trackings",
    authUser,
    getMyCustomerTrackings
);

/*
 * Crear o recuperar el seguimiento de una carga ya asignada.
 *
 * Sirve para cargas aceptadas antes de implementar
 * la creación automática del seguimiento.
 *
 * POST:
 * /marketplace-load-tracking/customer/ensure/:spaceOfferId
 */
router.post(
    "/customer/ensure/:spaceOfferId",
    authUser,
    ensureTrackingForAssignedLoad
);

/*
 * Activar el plan de seguimiento profesional.
 *
 * PATCH:
 * /marketplace-load-tracking/customer/:trackingId/activate-professional
 */
router.patch(
    "/customer/:trackingId/activate-professional",
    authUser,
    activateProfessionalTracking
);

/*
 * Consultar un seguimiento específico.
 *
 * GET:
 * /marketplace-load-tracking/customer/:trackingId
 */
router.get(
    "/customer/:trackingId",
    authUser,
    getCustomerTracking
);

/*
 * =========================================================
 * RUTAS DEL CONDUCTOR
 * =========================================================
 */

/*
 * Ver todos los servicios asignados al conductor.
 *
 * GET:
 * /marketplace-load-tracking/captain/my-trackings
 */
router.get(
    "/captain/my-trackings",
    authCaptain,
    getMyCaptainTrackings
);

/*
 * Consultar un seguimiento específico como conductor.
 *
 * GET:
 * /marketplace-load-tracking/captain/:trackingId
 */
router.get(
    "/captain/:trackingId",
    authCaptain,
    getCaptainTracking
);

/*
 * Actualizar la ubicación GPS del conductor.
 *
 * Esta ruta será utilizada tanto por:
 *
 * - navigator.geolocation
 * - GPS nativo Android en segundo plano
 *
 * PATCH:
 * /marketplace-load-tracking/:trackingId/location
 */
router.patch(
    "/:trackingId/location",
    authCaptain,
    updateMarketplaceLocation
);

/*
 * Actualizar el estado profesional del transporte.
 *
 * PATCH:
 * /marketplace-load-tracking/:trackingId/status
 *
 * Estados posibles del conductor:
 *
 * driver_heading_to_pickup
 * arrived_at_pickup
 * loading
 * picked_up
 * in_transit
 * near_destination
 * arrived_at_destination
 * unloading
 * delivered
 */
router.patch(
    "/:trackingId/status",
    authCaptain,
    updateTrackingStatus
);

module.exports = router;