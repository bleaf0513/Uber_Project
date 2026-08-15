const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const captainController = require("../controllers/captain.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const VALID_VEHICLE_TYPES = [
    "motorcycle",
    "car",
    "motocarro",
    "pickup",
    "van",
    "light_truck",
    "medium_truck",
    "heavy_truck",
    "simple_truck",
    "double_troque",
    "dump_truck",
    "mini_trailer",
    "tractor_trailer",
    "lowboy",
    "special_vehicle",
];

const VALID_BODY_TYPES = [
    "not_specified",
    "closed_van",
    "stakes",
    "platform",
    "refrigerated",
    "dump",
    "tank",
    "container_carrier",
    "lowboy",
    "open_body",
    "other",
];

const VALID_CAPACITY_UNITS = [
    "kg",
    "ton",
];

const DOCUMENT_FIELDS = [
    {
        path: "documents.identificationCard.front",
        label: "La foto frontal de la cédula es obligatoria",
    },
    {
        path: "documents.identificationCard.back",
        label: "La foto posterior de la cédula es obligatoria",
    },
    {
        path: "documents.drivingLicense.front",
        label: "La foto frontal de la licencia es obligatoria",
    },
    {
        path: "documents.drivingLicense.back",
        label: "La foto posterior de la licencia es obligatoria",
    },
    {
        path: "documents.vehicleRegistration.front",
        label: "La foto frontal de la tarjeta de propiedad es obligatoria",
    },
    {
        path: "documents.vehicleRegistration.back",
        label: "La foto posterior de la tarjeta de propiedad es obligatoria",
    },
];

const registerValidators = [
    body("email")
        .trim()
        .isEmail()
        .withMessage("Ingresa un correo electrónico válido"),

    body("fullname.firstname")
        .trim()
        .isLength({ min: 3, max: 80 })
        .withMessage("El nombre debe tener entre 3 y 80 caracteres"),

    body("fullname.lastname")
        .trim()
        .isLength({ min: 2, max: 80 })
        .withMessage("El apellido debe tener entre 2 y 80 caracteres"),

    body("password")
        .isLength({ min: 6, max: 128 })
        .withMessage("La contraseña debe tener mínimo 6 caracteres"),

    body("identification.type")
        .isIn(["CC", "CE", "PASSPORT", "OTHER"])
        .withMessage("El tipo de identificación no es válido"),

    body("identification.number")
        .trim()
        .isLength({ min: 5, max: 40 })
        .withMessage("El número de identificación debe tener entre 5 y 40 caracteres"),

    body("vehicle.color")
        .trim()
        .isLength({ min: 3, max: 80 })
        .withMessage("El color del vehículo debe tener mínimo 3 caracteres"),

    body("vehicle.plate")
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage("La placa del vehículo debe tener entre 3 y 20 caracteres"),

    body("vehicle.capacity")
        .isFloat({ min: 0.01 })
        .withMessage("La capacidad del vehículo debe ser mayor que cero"),

    body("vehicle.capacityUnit")
        .isIn(VALID_CAPACITY_UNITS)
        .withMessage("La unidad de capacidad debe ser kg o ton"),

    body("vehicle.capacityKg")
        .isFloat({ min: 1 })
        .withMessage("La capacidad equivalente en kilogramos debe ser válida"),

    body("vehicle.vehicleType")
        .isIn(VALID_VEHICLE_TYPES)
        .withMessage("El tipo de vehículo seleccionado no es válido"),

    body("vehicle.bodyType")
        .optional()
        .isIn(VALID_BODY_TYPES)
        .withMessage("El tipo de carrocería no es válido"),

    body("vehicle.brand")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 80 })
        .withMessage("La marca del vehículo no es válida"),

    body("vehicle.reference")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 80 })
        .withMessage("La referencia del vehículo no es válida"),

    body("vehicle.model")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 40 })
        .withMessage("El modelo del vehículo no es válido"),

    body("vehicle.axleCount")
        .optional({ nullable: true })
        .isInt({ min: 1, max: 20 })
        .withMessage("El número de ejes debe estar entre 1 y 20"),

    body("vehicle.photo")
        .optional()
        .isString()
        .withMessage("La foto del vehículo no es válida"),

    body("securityConsent.accepted")
        .equals("true")
        .withMessage("Debes autorizar el tratamiento de tus datos"),

    body("securityConsent.acceptedAt")
        .optional()
        .isISO8601()
        .withMessage("La fecha de autorización no es válida"),

    body("securityConsent.privacyPolicyVersion")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 40 })
        .withMessage("La versión de política de privacidad no es válida"),

    ...DOCUMENT_FIELDS.map((documentField) =>
        body(documentField.path)
            .isString()
            .notEmpty()
            .withMessage(documentField.label)
    ),
];

router.post(
    "/register",
    registerValidators,
    captainController.registerCaptain
);

router.post(
    "/login",
    [
        body("email")
            .trim()
            .isEmail()
            .withMessage("Ingresa un correo electrónico válido"),

        body("password")
            .isLength({ min: 6, max: 128 })
            .withMessage("La contraseña debe tener mínimo 6 caracteres"),
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
 */
router.post(
    "/push-token",
    authMiddleware.authCaptain,
    [
        body("token")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("El token push es obligatorio"),

        body("platform")
            .optional()
            .isIn(["web", "android", "ios", "unknown"])
            .withMessage("La plataforma push no es válida"),

        body("deviceId")
            .optional()
            .isString()
            .trim()
            .isLength({ max: 250 })
            .withMessage("El identificador del dispositivo no es válido"),

        body("userAgent")
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage("El navegador o dispositivo no es válido"),
    ],
    captainController.registerPushToken
);

/**
 * Desactivar token push del conductor.
 */
router.delete(
    "/push-token",
    authMiddleware.authCaptain,
    [
        body("token")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("El token push es obligatorio"),
    ],
    captainController.unregisterPushToken
);

/**
 * Conductores cercanos para el mapa.
 */
router.get(
    "/nearby",
    captainController.getNearbyCaptains
);

router.get("/", (req, res) => {
    res.send("Captain API active");
});

module.exports = router;