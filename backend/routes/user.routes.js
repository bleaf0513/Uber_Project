const express = require("express");
const { body } = require("express-validator");

const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

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
    ],
    userController.registerUser
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
    userController.loginUser
);

router.get(
    "/profile",
    authMiddleware.authUser,
    userController.getUserProfile
);

router.get(
    "/logout",
    authMiddleware.authUser,
    userController.logoutUser
);

/**
 * Registrar token push del usuario.
 * El frontend lo llamará cuando Firebase genere el token FCM.
 */
router.post(
    "/push-token",
    authMiddleware.authUser,
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
    userController.registerPushToken
);

/**
 * Desactivar token push del usuario.
 * Lo usaremos cuando cierre sesión o cuando el token ya no sirva.
 */
router.delete(
    "/push-token",
    authMiddleware.authUser,
    [
        body("token")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Push token is required"),
    ],
    userController.unregisterPushToken
);

router.get("/", (req, res) => {
    res.send("Hello World");
});

module.exports = router;