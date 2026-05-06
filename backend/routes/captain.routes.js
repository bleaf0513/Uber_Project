const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const captainController = require("../controllers/captain.controller");
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
    "/register",
    [
        body("email")
            .isEmail()
            .withMessage("Please enter a valid email"),

        body("fullname.firstname")
            .isLength({ min: 3 })
            .withMessage("First name must be at least 3 characters long"),

        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters long"),

        body("vehicle.color")
            .isLength({ min: 3 })
            .withMessage("Color must be at least 3 characters long"),

        body("vehicle.plate")
            .isLength({ min: 3 })
            .withMessage("Plate must be at least 3 characters long"),

        body("vehicle.capacity")
            .isInt({ min: 1 })
            .withMessage("Capacity must be at least 1"),

        body("vehicle.vehicleType")
            .isIn(VALID_VEHICLE_TYPES)
            .withMessage("Please enter a valid vehicle type"),

        body("documents.drivingLicenseImage")
            .isString()
            .notEmpty()
            .withMessage("Driving license image is required"),

        body("documents.vehicleRegistrationImage")
            .isString()
            .notEmpty()
            .withMessage("Vehicle registration image is required"),
    ],
    captainController.registerCaptain
);

router.post(
    "/login",
    [
        body("email")
            .isEmail()
            .withMessage("Please enter a valid email"),

        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters long"),
    ],
    captainController.loginCaptain
);

router.get(
    "/profile",
    authMiddleware.authCaptain,
    captainController.getCaptainProfile
);

router.get(
    "/logout",
    authMiddleware.authCaptain,
    captainController.logoutCaptain
);

/**
 * Registrar token push del conductor.
 * El frontend lo llamará cuando Firebase genere el token FCM.
 */
router.post(
    "/push-token",
    authMiddleware.authCaptain,
    [
        body("token")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Push token is required"),

        body("platform")
            .optional()
            .isIn(["web", "android", "ios", "unknown"])
            .withMessage("Invalid platform"),

        body("deviceId")
            .optional()
            .isString()
            .trim()
            .isLength({ max: 250 })
            .withMessage("Invalid device id"),

        body("userAgent")
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Invalid user agent"),
    ],
    captainController.registerPushToken
);

/**
 * Desactivar token push del conductor.
 * Lo usaremos cuando cierre sesión o cuando el token ya no sirva.
 */
router.delete(
    "/push-token",
    authMiddleware.authCaptain,
    [
        body("token")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Push token is required"),
    ],
    captainController.unregisterPushToken
);

// Conductores cercanos para el mapa
router.get(
    "/nearby",
    captainController.getNearbyCaptains
);

router.get("/", (req, res) => {
    res.send("Hello World");
});

module.exports = router;