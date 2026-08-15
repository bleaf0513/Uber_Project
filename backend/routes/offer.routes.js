const express = require("express");
const router = express.Router();

const { body, query } = require("express-validator");

const authMiddleware = require("../middlewares/auth.middleware");
const offerController = require("../controllers/offer.controller");

/*
 * =========================================================
 * CONFIGURACIONES COMPARTIDAS
 * =========================================================
 */

const TIPOS_VEHICULO_CARGA = [
    "moto",
    "carro",
    "motocarro",
    "camioneta",
    "van",
    "camion_ultraliviano",
    "camion_liviano",
    "camion_mediano",
    "camion_pesado",
    "camion_sencillo",
    "doble_troque",
    "volqueta",
    "minimula",
    "tractomula",
    "cama_baja",
    "vehiculo_especial",
    "otro",
];

const TIPOS_CARROCERIA = [
    "no_especificada",
    "furgon_cerrado",
    "estacas",
    "plataforma",
    "refrigerada",
    "volco",
    "tanque",
    "portacontenedor",
    "cama_baja",
    "carroceria_abierta",
    "otro",
];

const UNIDADES_CANTIDAD_CARGA = [
    "unidades",
    "cajas",
    "bultos",
    "pacas",
    "canastillas",
    "sacos",
    "rollos",
    "tambores",
    "estibas",
    "contenedores",
    "otro",
];

const MODALIDADES_PRECIO_CARGA = [
    "precio_fijo",
    "recibir_ofertas",
    "carga_retorno",
    "por_acordar",
];

const FORMAS_PAGO_CARGA = [
    "por_acordar",
    "efectivo",
    "transferencia",
    "pago_anticipado",
    "contra_entrega",
    "credito",
];

const ESTADOS_CARGA = [
    "borrador",
    "active",
    "paused",
    "recibiendo_propuestas",
    "assigned",
    "reserved",
    "recogida",
    "in_transit",
    "delivered",
    "completed",
    "cancelled",
];

/*
 * =========================================================
 * MERCANCÍA
 * =========================================================
 */

router.post(
    "/goods/create",

    authMiddleware.authCaptain,

    body("productName")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 2,
            max: 150,
        })
        .withMessage(
            "El nombre del producto es inválido."
        ),

    body("quantityAvailable")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "La cantidad disponible debe ser mayor que cero."
        ),

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
        .withMessage(
            "La unidad de cantidad es inválida."
        ),

    body("suggestedPrice")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El precio sugerido debe ser mayor que cero."
        ),

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
        .withMessage(
            "El tipo de precio es inválido."
        ),

    body("origin")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El origen es inválido."
        ),

    body("destination")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El destino es inválido."
        ),

    body("departureTime")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isISO8601()
        .withMessage(
            "La fecha de salida es inválida."
        ),

    body("vehicleType")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isIn([
            "motorcycle",
            "car",
            "light_cargo",
            "van",
            "truck",
        ])
        .withMessage(
            "El tipo de vehículo es inválido."
        ),

    body("description")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "La descripción es inválida."
        ),

    body("notes")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "Las notas son inválidas."
        ),

    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo negociable es inválido."
        ),

    offerController.createGoodsOffer
);

router.get(
    "/goods/list",

    query("origin")
        .optional()
        .isString(),

    query("destination")
        .optional()
        .isString(),

    query("status")
        .optional()
        .isIn([
            "active",
            "paused",
            "sold_out",
            "cancelled",
            "completed",
        ]),

    query("includeEmpty")
        .optional()
        .isBoolean(),

    offerController.listGoodsOffers
);

/*
 * =========================================================
 * MARKETPLACE DE CARGAS
 * =========================================================
 *
 * El usuario publica una carga.
 * El conductor envía propuestas.
 * =========================================================
 */

/*
 * Crear una publicación de carga.
 *
 * IMPORTANTE:
 * Ahora usa authUser, no authCaptain.
 */
router.post(
    "/space/create",

    authMiddleware.authUser,

    body("title")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 120,
        })
        .withMessage(
            "El título de la carga es inválido."
        ),

    body("cargoType")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 2,
            max: 120,
        })
        .withMessage(
            "El tipo de carga es inválido."
        ),

    body("weight")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El peso debe ser mayor que cero."
        ),

    body("weightUnit")
        .isString()
        .isIn([
            "kg",
            "toneladas",
        ])
        .withMessage(
            "La unidad de peso es inválida."
        ),

    body("volumeM3")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "El volumen debe ser un número válido."
        ),

    body("lengthMeters")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "El largo es inválido."
        ),

    body("widthMeters")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "El ancho es inválido."
        ),

    body("heightMeters")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "El alto es inválido."
        ),

    body("packageQuantity")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "La cantidad de paquetes es inválida."
        ),

    body("packageUnit")
        .optional()
        .isIn(
            UNIDADES_CANTIDAD_CARGA
        )
        .withMessage(
            "La unidad de empaque es inválida."
        ),

    body("palletCount")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isInt({
            min: 0,
        })
        .withMessage(
            "La cantidad de estibas es inválida."
        ),

    body("origin")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El origen es inválido."
        ),

    body("originCity")
        .optional()
        .isString()
        .isLength({
            max: 100,
        })
        .withMessage(
            "La ciudad de origen es inválida."
        ),

    body("originDepartment")
        .optional()
        .isString()
        .isLength({
            max: 100,
        })
        .withMessage(
            "El departamento de origen es inválido."
        ),

    body("destination")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El destino es inválido."
        ),

    body("destinationCity")
        .optional()
        .isString()
        .isLength({
            max: 100,
        })
        .withMessage(
            "La ciudad de destino es inválida."
        ),

    body("destinationDepartment")
        .optional()
        .isString()
        .isLength({
            max: 100,
        })
        .withMessage(
            "El departamento de destino es inválido."
        ),

    body("stops")
        .optional()
        .isArray()
        .withMessage(
            "Las paradas deben enviarse como una lista."
        ),

    body("stops.*")
        .optional()
        .isString()
        .isLength({
            min: 2,
            max: 250,
        })
        .withMessage(
            "Una de las paradas es inválida."
        ),

    body("pickupTime")
        .isISO8601()
        .withMessage(
            "La fecha de recogida es inválida."
        ),

    body("deliveryDeadline")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isISO8601()
        .withMessage(
            "La fecha límite de entrega es inválida."
        ),

    body("pickupIsFlexible")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de recogida flexible es inválido."
        ),

    body("requiredVehicleType")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isIn(
            TIPOS_VEHICULO_CARGA
        )
        .withMessage(
            "El tipo de vehículo requerido es inválido."
        ),

    body("requiredBodyType")
        .optional()
        .isIn(
            TIPOS_CARROCERIA
        )
        .withMessage(
            "El tipo de carrocería es inválido."
        ),

    body("vehicleSuggestionOverridden")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de selección manual del vehículo es inválido."
        ),

    body("requiresRefrigeration")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de refrigeración es inválido."
        ),

    body("isFragile")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de carga frágil es inválido."
        ),

    body("isHazardous")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de carga peligrosa es inválido."
        ),

    body("requiresTarp")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de carpa es inválido."
        ),

    body("requiresLoading")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de cargue es inválido."
        ),

    body("requiresUnloading")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de descargue es inválido."
        ),

    body("requiresAssistant")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de ayudante es inválido."
        ),

    body("loadingIncludedInPrice")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de cargue incluido es inválido."
        ),

    body("unloadingIncludedInPrice")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de descargue incluido es inválido."
        ),

    body("priceMode")
        .optional()
        .isIn(
            MODALIDADES_PRECIO_CARGA
        )
        .withMessage(
            "La modalidad de precio es inválida."
        ),

    body("suggestedPrice")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "El precio sugerido es inválido."
        ),

    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo negociable es inválido."
        ),

    body("paymentMethod")
        .optional()
        .isIn(
            FORMAS_PAGO_CARGA
        )
        .withMessage(
            "La forma de pago es inválida."
        ),

    body("paymentTermDays")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isInt({
            min: 0,
        })
        .withMessage(
            "El plazo de pago es inválido."
        ),

    body("includesTolls")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de peajes es inválido."
        ),

    body("includesFuel")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de combustible es inválido."
        ),

    body("description")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "La descripción es inválida."
        ),

    body("notes")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "Las notas son inválidas."
        ),

    body("contactInstructions")
        .optional()
        .isString()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Las instrucciones de contacto son inválidas."
        ),

    body("photos")
        .optional()
        .isArray()
        .withMessage(
            "Las fotos deben enviarse como una lista."
        ),

    body("photos.*")
        .optional()
        .isString()
        .withMessage(
            "Una de las fotos es inválida."
        ),

    offerController.createSpaceOffer
);

/*
 * Listar cargas disponibles.
 *
 * Esta ruta puede ser consultada por el frontend de conductores.
 * El controlador solamente devuelve cargas activas por defecto.
 */
router.get(
    "/space/list",

    query("origin")
        .optional()
        .isString(),

    query("destination")
        .optional()
        .isString(),

    query("requiredVehicleType")
        .optional()
        .isIn(
            TIPOS_VEHICULO_CARGA
        ),

    query("requiredBodyType")
        .optional()
        .isIn(
            TIPOS_CARROCERIA
        ),

    query("priceMode")
        .optional()
        .isIn(
            MODALIDADES_PRECIO_CARGA
        ),

    query("maxWeightKg")
        .optional()
        .isFloat({
            gt: 0,
        }),

    query("status")
        .optional()
        .isIn(
            ESTADOS_CARGA
        ),

    query("includeEmpty")
        .optional()
        .isBoolean(),

    offerController.listSpaceOffers
);

/*
 * Consultar las cargas publicadas por el usuario autenticado.
 */
router.get(
    "/space/my-offers",

    authMiddleware.authUser,

    offerController.getMySpaceOffers
);

/*
 * El conductor envía una propuesta para una carga.
 */
router.post(
    "/space/bid/create",

    authMiddleware.authCaptain,

    body("listingId")
        .isMongoId()
        .withMessage(
            "El identificador de la carga es inválido."
        ),

    body("offeredPrice")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El precio de la propuesta debe ser mayor que cero."
        ),

    body("message")
        .optional()
        .isString()
        .isLength({
            max: 1500,
        })
        .withMessage(
            "El mensaje es inválido."
        ),

    body("proposedVehicleType")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isIn(
            TIPOS_VEHICULO_CARGA
        )
        .withMessage(
            "El tipo de vehículo propuesto es inválido."
        ),

    body("proposedVehicleBrand")
        .optional()
        .isString()
        .isLength({
            max: 80,
        })
        .withMessage(
            "La marca del vehículo es inválida."
        ),

    body("proposedVehicleReference")
        .optional()
        .isString()
        .isLength({
            max: 100,
        })
        .withMessage(
            "La referencia del vehículo es inválida."
        ),

    body("proposedVehicleModel")
        .optional()
        .isString()
        .isLength({
            max: 20,
        })
        .withMessage(
            "El modelo del vehículo es inválido."
        ),

    body("proposedVehiclePlate")
        .optional()
        .isString()
        .isLength({
            max: 15,
        })
        .withMessage(
            "La placa del vehículo es inválida."
        ),

    body("proposedBodyType")
        .optional()
        .isIn(
            TIPOS_CARROCERIA
        )
        .withMessage(
            "El tipo de carrocería propuesto es inválido."
        ),

    body("proposedVehicleCapacity")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "La capacidad del vehículo es inválida."
        ),

    body("proposedVehicleCapacityUnit")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isIn([
            "kg",
            "toneladas",
            "m3",
        ])
        .withMessage(
            "La unidad de capacidad del vehículo es inválida."
        ),

    body("availablePickupTime")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isISO8601()
        .withMessage(
            "La fecha disponible para recoger es inválida."
        ),

    body("estimatedDeliveryTime")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isISO8601()
        .withMessage(
            "La fecha estimada de entrega es inválida."
        ),

    body("estimatedDurationHours")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            min: 0,
        })
        .withMessage(
            "La duración estimada es inválida."
        ),

    body("includesLoading")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de cargue incluido es inválido."
        ),

    body("includesUnloading")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de descargue incluido es inválido."
        ),

    body("includesAssistant")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de ayudante incluido es inválido."
        ),

    body("includesTolls")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de peajes incluidos es inválido."
        ),

    body("includesFuel")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de combustible incluido es inválido."
        ),

    body("includesInsurance")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo de seguro incluido es inválido."
        ),

    offerController.createSpaceBid
);

/*
 * El usuario responde una propuesta de un conductor.
 *
 * Acciones:
 * accepted
 * rejected
 * countered
 */
router.post(
    "/space/bid/respond",

    authMiddleware.authUser,

    body("bidId")
        .isMongoId()
        .withMessage(
            "El identificador de la propuesta es inválido."
        ),

    body("action")
        .isString()
        .isIn([
            "accepted",
            "rejected",
            "countered",
        ])
        .withMessage(
            "La acción es inválida."
        ),

    body("counterPrice")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El precio de la contraoferta es inválido."
        ),

    body("counterMessage")
        .optional()
        .isString()
        .isLength({
            max: 1500,
        })
        .withMessage(
            "El mensaje de la contraoferta es inválido."
        ),

    offerController.respondToSpaceBid
);

/*
 * El conductor responde una contraoferta enviada por el usuario.
 */
router.post(
    "/space/bid/captain-respond",

    authMiddleware.authCaptain,

    body("bidId")
        .isMongoId()
        .withMessage(
            "El identificador de la propuesta es inválido."
        ),

    body("action")
        .isString()
        .isIn([
            "accepted",
            "rejected",
        ])
        .withMessage(
            "La acción es inválida."
        ),

    offerController.captainRespondToSpaceCounter
);

/*
 * El usuario consulta todas las propuestas recibidas
 * para sus cargas.
 */
router.get(
    "/space/bid/my-received",

    authMiddleware.authUser,

    offerController.getMyReceivedSpaceBids
);

/*
 * El conductor consulta todas las propuestas que ha enviado.
 */
router.get(
    "/space/bid/my-sent",

    authMiddleware.authCaptain,

    offerController.getMySentSpaceBids
);

/*
 * =========================================================
 * CUPOS
 * =========================================================
 */

router.post(
    "/seat/create",

    authMiddleware.authCaptain,

    body("seatsAvailable")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "La cantidad de cupos debe ser mayor que cero."
        ),

    body("seatUnit")
        .optional()
        .isIn([
            "cupo",
            "cupos",
            "puesto",
            "puestos",
        ])
        .withMessage(
            "La unidad de cupos es inválida."
        ),

    body("suggestedPrice")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El precio sugerido debe ser mayor que cero."
        ),

    body("origin")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El origen es inválido."
        ),

    body("destination")
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            min: 3,
            max: 250,
        })
        .withMessage(
            "El destino es inválido."
        ),

    body("stops")
        .optional()
        .isArray()
        .withMessage(
            "Las paradas deben enviarse como una lista."
        ),

    body("departureTime")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isISO8601()
        .withMessage(
            "La fecha de salida es inválida."
        ),

    body("vehicleType")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isIn([
            "motorcycle",
            "car",
            "light_cargo",
            "van",
            "truck",
        ])
        .withMessage(
            "El tipo de vehículo es inválido."
        ),

    body("description")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "La descripción es inválida."
        ),

    body("notes")
        .optional()
        .isString()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "Las notas son inválidas."
        ),

    body("isNegotiable")
        .optional()
        .isBoolean()
        .withMessage(
            "El campo negociable es inválido."
        ),

    offerController.createSeatOffer
);

router.get(
    "/seat/list",

    query("origin")
        .optional()
        .isString(),

    query("destination")
        .optional()
        .isString(),

    query("status")
        .optional()
        .isIn([
            "active",
            "paused",
            "full",
            "cancelled",
            "completed",
        ]),

    query("includeEmpty")
        .optional()
        .isBoolean(),

    offerController.listSeatOffers
);

/*
 * =========================================================
 * NEGOCIACIÓN TRADICIONAL
 * Solo Mercancía y Cupos
 * =========================================================
 */

/*
 * El usuario envía una solicitud para Mercancía o Cupos.
 *
 * Space ya no se permite aquí.
 */
router.post(
    "/bid/create",

    authMiddleware.authUser,

    body("listingType")
        .isString()
        .isIn([
            "goods",
            "seat",
        ])
        .withMessage(
            "El tipo de publicación es inválido."
        ),

    body("listingId")
        .isMongoId()
        .withMessage(
            "El identificador de la publicación es inválido."
        ),

    body("requestedQuantity")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "La cantidad solicitada debe ser mayor que cero."
        ),

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
        .withMessage(
            "La unidad solicitada es inválida."
        ),

    body("offeredPrice")
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El valor ofrecido debe ser mayor que cero."
        ),

    body("message")
        .optional()
        .isString()
        .isLength({
            max: 1500,
        })
        .withMessage(
            "El mensaje es inválido."
        ),

    offerController.createBid
);

/*
 * El conductor responde solicitudes de Mercancía o Cupos.
 */
router.post(
    "/bid/respond",

    authMiddleware.authCaptain,

    body("bidId")
        .isMongoId()
        .withMessage(
            "El identificador de la oferta es inválido."
        ),

    body("action")
        .isString()
        .isIn([
            "accepted",
            "rejected",
            "countered",
        ])
        .withMessage(
            "La acción es inválida."
        ),

    body("counterPrice")
        .optional({
            nullable: true,
            checkFalsy: true,
        })
        .isFloat({
            gt: 0,
        })
        .withMessage(
            "El precio de la contraoferta es inválido."
        ),

    body("counterMessage")
        .optional()
        .isString()
        .isLength({
            max: 1500,
        })
        .withMessage(
            "El mensaje de la contraoferta es inválido."
        ),

    offerController.respondToBid
);

/*
 * El usuario responde una contraoferta de Mercancía o Cupos.
 */
router.post(
    "/bid/customer-respond",

    authMiddleware.authUser,

    body("bidId")
        .isMongoId()
        .withMessage(
            "El identificador de la oferta es inválido."
        ),

    body("action")
        .isString()
        .isIn([
            "accepted",
            "rejected",
        ])
        .withMessage(
            "La acción es inválida."
        ),

    offerController.customerRespondToBid
);

/*
 * Solicitudes recibidas por el conductor.
 * Solamente Mercancía y Cupos.
 */
router.get(
    "/bid/my-received",

    authMiddleware.authCaptain,

    offerController.getMyReceivedBids
);

/*
 * Solicitudes enviadas por el usuario.
 * Solamente Mercancía y Cupos.
 */
router.get(
    "/bid/my-sent",

    authMiddleware.authUser,

    offerController.getMySentBids
);

module.exports = router;