const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const authMiddleware = require("../middlewares/auth.middleware");
const offerController = require("../controllers/offer.controller");

/**
 * =========================
 * MERCANCÍA
 * =========================
 */

router.post(
    "/goods/create",
    authMiddleware.authCaptain,
    body("productName")
        .isString()
        .notEmpty()
        .isLength({ min: 2 })
        .withMessage("Invalid product name"),
    body("quantityAvailable")
        .isNumeric()
        .withMessage("Invalid quantity available"),
    body("quantityUnit")
        .isString()
        .isIn([
            "kg",
            "gramos",
            "libras",
            "bultos",
            "pacas",
            "cajas",
            "canastillas",
            "toneladas",
            "unidades",
        ])
        .withMessage("Invalid quantity unit"),
    body("suggestedPrice")
        .isNumeric()
        .withMessage("Invalid suggested price"),
    body("priceType")
        .isString()
        .isIn([
            "por_kg",
            "por_gramo",
            "por_libra",
            "por_bulto",
            "por_paca",
            "por_caja",
            "por_canastilla",
            "por_tonelada",
            "por_unidad",
            "precio_total",
        ])
        .withMessage("Invalid price type"),
    body("origin")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid origin"),
    body("destination")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid destination"),
    body("departureTime")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Invalid departure time"),
    body("vehicleType")
        .optional({ nullable: true })
        .isIn(["motorcycle", "car", "light_cargo", "van", "truck"])
        .withMessage("Invalid vehicle type"),
    body("description")
        .optional()
        .isString()
        .withMessage("Invalid description"),
    body("notes")
        .optional()
        .isString()
        .withMessage("Invalid notes"),
    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage("Invalid negotiable flag"),
    offerController.createGoodsOffer
);

router.get(
    "/goods/list",
    authMiddleware.authUser,
    query("origin").optional().isString(),
    query("destination").optional().isString(),
    query("status").optional().isIn(["active", "paused", "sold_out", "cancelled", "completed"]),
    offerController.listGoodsOffers
);

/**
 * =========================
 * ESPACIO
 * =========================
 */

router.post(
    "/space/create",
    authMiddleware.authCaptain,
    body("capacityAvailable")
        .isNumeric()
        .withMessage("Invalid capacity available"),
    body("capacityUnit")
        .isString()
        .isIn([
            "kg",
            "libras",
            "toneladas",
            "bultos",
            "pacas",
            "cajas",
            "canastillas",
            "m3",
            "espacio_parcial",
            "vehiculo_completo",
        ])
        .withMessage("Invalid capacity unit"),
    body("cargoType")
        .optional()
        .isString()
        .withMessage("Invalid cargo type"),
    body("suggestedPrice")
        .isNumeric()
        .withMessage("Invalid suggested price"),
    body("priceType")
        .isString()
        .isIn([
            "por_kg",
            "por_libra",
            "por_tonelada",
            "por_bulto",
            "por_paca",
            "por_caja",
            "por_canastilla",
            "por_m3",
            "precio_total",
        ])
        .withMessage("Invalid price type"),
    body("origin")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid origin"),
    body("destination")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid destination"),
    body("departureTime")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Invalid departure time"),
    body("vehicleType")
        .optional({ nullable: true })
        .isIn(["motorcycle", "car", "light_cargo", "van", "truck"])
        .withMessage("Invalid vehicle type"),
    body("description")
        .optional()
        .isString()
        .withMessage("Invalid description"),
    body("notes")
        .optional()
        .isString()
        .withMessage("Invalid notes"),
    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage("Invalid negotiable flag"),
    offerController.createSpaceOffer
);

router.get(
    "/space/list",
    authMiddleware.authUser,
    query("origin").optional().isString(),
    query("destination").optional().isString(),
    query("status").optional().isIn(["active", "paused", "reserved", "cancelled", "completed"]),
    offerController.listSpaceOffers
);

/**
 * =========================
 * CUPOS
 * =========================
 */

router.post(
    "/seat/create",
    authMiddleware.authCaptain,
    body("seatsAvailable")
        .isNumeric()
        .withMessage("Invalid seats available"),
    body("seatUnit")
        .optional()
        .isIn(["cupo", "cupos", "puesto", "puestos"])
        .withMessage("Invalid seat unit"),
    body("suggestedPrice")
        .isNumeric()
        .withMessage("Invalid suggested price"),
    body("origin")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid origin"),
    body("destination")
        .isString()
        .notEmpty()
        .isLength({ min: 3 })
        .withMessage("Invalid destination"),
    body("stops")
        .optional()
        .isArray()
        .withMessage("Invalid stops"),
    body("departureTime")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Invalid departure time"),
    body("vehicleType")
        .optional({ nullable: true })
        .isIn(["motorcycle", "car", "light_cargo", "van", "truck"])
        .withMessage("Invalid vehicle type"),
    body("description")
        .optional()
        .isString()
        .withMessage("Invalid description"),
    body("notes")
        .optional()
        .isString()
        .withMessage("Invalid notes"),
    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage("Invalid negotiable flag"),
    offerController.createSeatOffer
);

router.get(
    "/seat/list",
    authMiddleware.authUser,
    query("origin").optional().isString(),
    query("destination").optional().isString(),
    query("status").optional().isIn(["active", "paused", "full", "cancelled", "completed"]),
    offerController.listSeatOffers
);

/**
 * =========================
 * OFERTAS / NEGOCIACIÓN
 * =========================
 */

router.post(
    "/bid/create",
    authMiddleware.authUser,
    body("listingType")
        .isString()
        .isIn(["goods", "space", "seat"])
        .withMessage("Invalid listing type"),
    body("listingId")
        .isMongoId()
        .withMessage("Invalid listing id"),
    body("requestedQuantity")
        .isNumeric()
        .withMessage("Invalid requested quantity"),
    body("requestedUnit")
        .isString()
        .isIn([
            "kg",
            "gramos",
            "libras",
            "bultos",
            "pacas",
            "cajas",
            "canastillas",
            "toneladas",
            "unidades",
            "m3",
            "cupo",
            "cupos",
            "puesto",
            "puestos",
        ])
        .withMessage("Invalid requested unit"),
    body("offeredPrice")
        .isNumeric()
        .withMessage("Invalid offered price"),
    body("message")
        .optional()
        .isString()
        .withMessage("Invalid message"),
    offerController.createBid
);

router.post(
    "/bid/respond",
    authMiddleware.authCaptain,
    body("bidId")
        .isMongoId()
        .withMessage("Invalid bid id"),
    body("action")
        .isString()
        .isIn(["accepted", "rejected", "countered"])
        .withMessage("Invalid action"),
    body("counterPrice")
        .optional({ nullable: true })
        .isNumeric()
        .withMessage("Invalid counter price"),
    body("counterMessage")
        .optional()
        .isString()
        .withMessage("Invalid counter message"),
    offerController.respondToBid
);

router.get(
    "/bid/my-received",
    authMiddleware.authCaptain,
    offerController.getMyReceivedBids
);

router.get(
    "/bid/my-sent",
    authMiddleware.authUser,
    offerController.getMySentBids
);

module.exports = router;
