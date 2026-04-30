const express = require("express");
const router = express.Router();

const rideController = require("../controllers/ride.controller");
const { body, query, param } = require("express-validator");
const authMiddleware = require("../middlewares/auth.middleware");

const VALID_VEHICLE_TYPES = [
    "motorcycle",
    "car",
    "light_cargo",
    "van",
    "truck",
    "motocarro",
    "pickup",
    "moving",
];

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
        .isIn(VALID_VEHICLE_TYPES)
        .withMessage("Invalid Vehicle Type"),
    body("offeredFare")
        .optional()
        .isNumeric()
        .withMessage("Invalid offered fare"),
    rideController.createRide
);

router.get(
    "/fare",
    authMiddleware.authUser,
    query("pickup")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid Pickup Address"),
    query("destination")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid Destination Address"),
    rideController.getFare
);

router.post(
    "/cancel",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.cancelRide
);

router.post(
    "/confirm",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.confirmRide
);

router.post(
    "/captain-offer",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("price").isNumeric().withMessage("Invalid price"),
    body("message").optional().isString().withMessage("Invalid message"),
    rideController.captainOfferRide
);

router.post(
    "/respond-offer",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("captainId").isMongoId().withMessage("Invalid captain id"),
    body("action").isIn(["accepted", "rejected"]).withMessage("Invalid action"),
    rideController.userRespondToCaptainOffer
);

router.get(
    "/my-active",
    authMiddleware.authUser,
    rideController.getMyActiveRide
);

router.get(
    "/available-for-captain",
    authMiddleware.authCaptain,
    rideController.getAvailableForCaptain
);

router.get(
    "/captain-stats",
    authMiddleware.authCaptain,
    rideController.getCaptainStats
);

router.get(
    "/captain-history",
    authMiddleware.authCaptain,
    rideController.getCaptainHistory
);

/*
  IMPORTANTE:
  Estas rutas específicas deben ir antes de "/:rideId/offers",
  para que Express no confunda textos como "start-ride"
  o "user-at-pickup" con un rideId.
*/

router.post(
    "/arrived",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.arrived
);

router.post(
    "/user-at-pickup",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.userAtPickup
);

router.post(
    "/start-ride",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.startRide
);

router.post(
    "/end-ride",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.endRide
);

router.post(
    "/rate-captain",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("rating")
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be between 1 and 5"),
    body("comment")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Comment too long"),
    rideController.rateCaptain
);

router.post(
    "/rate-user",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("rating")
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be between 1 and 5"),
    body("comment")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Comment too long"),
    rideController.rateUser
);

router.post(
    "/cancel-by-captain",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("reason").isString().notEmpty().withMessage("Invalid reason"),
    body("notes").optional().isString().withMessage("Invalid notes"),
    rideController.cancelByCaptain
);

router.post(
    "/chat-message",
    authMiddleware.authUser,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("message")
        .isString()
        .trim()
        .notEmpty()
        .isLength({ max: 1000 })
        .withMessage("Invalid message"),
    body("senderType")
        .optional()
        .isIn(["user"])
        .withMessage("Invalid sender type"),
    (req, res, next) => {
        req.body.senderType = "user";
        next();
    },
    rideController.sendRideChatMessage
);

router.post(
    "/captain-chat-message",
    authMiddleware.authCaptain,
    body("rideId").isMongoId().withMessage("Invalid ride id"),
    body("message")
        .isString()
        .trim()
        .notEmpty()
        .isLength({ max: 1000 })
        .withMessage("Invalid message"),
    body("senderType")
        .optional()
        .isIn(["captain"])
        .withMessage("Invalid sender type"),
    (req, res, next) => {
        req.body.senderType = "captain";
        next();
    },
    rideController.sendRideChatMessage
);

router.get(
    "/:rideId/offers",
    authMiddleware.authUser,
    param("rideId").isMongoId().withMessage("Invalid ride id"),
    rideController.getRideOffers
);

module.exports = router;