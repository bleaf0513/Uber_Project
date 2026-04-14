const express = require("express");
const router = express.Router();
const rideController = require("../controllers/ride.controller");
const { body, query, param } = require("express-validator");
const authMiddleware = require("../middlewares/auth.middleware");

router.post(
    "/create",
    authMiddleware.authUser,
    body("pickup")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid Pickup Address"),
    body("destination")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid Destination Address"),
    body("vehicle")
        .isString()
        .notEmpty()
        .isIn(["motorcycle", "car", "light_cargo", "van", "truck"])
        .withMessage("Invalid Vehicle Type"),
    body("offeredFare")
        .optional()
        .isNumeric()
        .withMessage("Invalid offered fare"),
    rideController.createRide
);

router.post(
    "/cancel",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.cancelRide
);

// Mantener por compatibilidad si ya lo usas en frontend,
// pero ahora confirm solo acepta si el captain ya fue seleccionado por el usuario.
router.post(
    "/confirm",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.confirmRide
);

// NUEVO: el conductor envía oferta o contraoferta
router.post(
    "/captain-offer",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("price").isNumeric().withMessage("Invalid price"),
    body("message").optional().isString().withMessage("Invalid message"),
    rideController.captainOfferRide
);

// NUEVO: el usuario acepta o rechaza una oferta de conductor
router.post(
    "/user-respond-offer",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("captainId").isMongoId().withMessage("Invalid captain id"),
    body("action")
        .isString()
        .isIn(["accepted", "rejected"])
        .withMessage("Invalid action"),
    rideController.userRespondToCaptainOffer
);

// NUEVO: obtener un ride por id con ofertas
router.get(
    "/:rideId/offers",
    authMiddleware.authUser,
    param("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.getRideOffers
);

// NUEVO: ride activo del usuario
router.get(
    "/my-active",
    authMiddleware.authUser,
    rideController.getMyActiveRide
);

router.get(
    "/start-ride",
    authMiddleware.authCaptain,
    query("rideId").isMongoId().withMessage("Invalid ride id"),
    query("otp")
        .isString()
        .isLength({ min: 6, max: 6 })
        .withMessage("Invalid OTP"),
    rideController.startRide
);

router.post(
    "/end-ride",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.endRide
);

module.exports = router;
