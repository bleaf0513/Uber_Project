const { validationResult } = require("express-validator");

const GoodsOffer = require("../models/goodsOffer.model");
const SpaceOffer = require("../models/spaceOffer.model");
const SeatOffer = require("../models/seatOffer.model");
const OfferBid = require("../models/offerBid.model");
const User = require("../models/user.model");
const Captain = require("../models/captain.model");

const { sendMessageToSocketId } = require("../socket");
const pushService = require("../services/push.service");

const {
    createTrackingFromAcceptedBid,
} = require("./marketplaceLoadTracking.controller");

/* =========================================================
 * CONFIGURACIÓN GENERAL
 * ========================================================= */

const PRICE_TYPE_LABELS = {
    por_kg: "por kg",
    por_gramo: "por gramo",
    por_libra: "por libra",
    por_bulto: "por bulto",
    por_paca: "por paca",
    por_caja: "por caja",
    por_canastilla: "por canastilla",
    por_tonelada: "por tonelada",
    por_unidad: "por unidad",
    por_m3: "por m³",
    precio_total: "precio total",
};

const VEHICLE_LABELS = {
    moto: "Moto",
    carro: "Carro",
    motocarro: "Motocarro",
    camioneta: "Camioneta",
    van: "Van",
    camion_ultraliviano: "Camión ultraliviano",
    camion_liviano: "Camión liviano",
    camion_mediano: "Camión mediano",
    camion_pesado: "Camión pesado",
    camion_sencillo: "Camión sencillo",
    doble_troque: "Doble troque",
    volqueta: "Volqueta",
    minimula: "Minimula",
    tractomula: "Tractomula",
    cama_baja: "Cama baja",
    vehiculo_especial: "Vehículo especial",
    otro: "Otro",
};

const BODY_TYPE_LABELS = {
    no_especificada: "No especificada",
    furgon_cerrado: "Furgón cerrado",
    estacas: "Estacas",
    plataforma: "Plataforma",
    refrigerada: "Refrigerada",
    volco: "Volco",
    tanque: "Tanque",
    portacontenedor: "Portacontenedor",
    cama_baja: "Cama baja",
    carroceria_abierta: "Carrocería abierta",
    otro: "Otro",
};

const formatCOP = (value) => {
    const number = Number(value || 0);

    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(number);
};

const normalizeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const buildPriceLabel = (suggestedPrice, priceType) => {
    const label = PRICE_TYPE_LABELS[priceType] || "precio";
    return `${formatCOP(suggestedPrice)} ${label}`;
};

const getCustomerName = (customer) => {
    const first = customer?.fullname?.firstname || "";
    const last = customer?.fullname?.lastname || "";
    const full = `${first} ${last}`.trim();

    return full || customer?.email || "Cliente";
};

const getCaptainName = (captain) => {
    const first = captain?.fullname?.firstname || "";
    const last = captain?.fullname?.lastname || "";
    const full = `${first} ${last}`.trim();

    return full || "Transportador";
};

const runNotification = (label, callback) => {
    setImmediate(() => {
        Promise.resolve()
            .then(callback)
            .catch((error) => {
                console.error(`[offers] ${label}:`, error);
            });
    });
};

/* =========================================================
 * CAMPOS CALCULADOS
 * ========================================================= */

const attachGoodsComputedFields = (offer, salesInfo = null) => {
    const obj =
        typeof offer?.toObject === "function"
            ? offer.toObject()
            : offer || {};

    const publishedQuantity = normalizeNumber(obj.quantityAvailable);
    const soldQuantity = normalizeNumber(salesInfo?.soldQuantity);
    const soldMoney = normalizeNumber(salesInfo?.soldMoney);
    const realAvailable = Math.max(
        publishedQuantity - soldQuantity,
        0
    );

    return {
        ...obj,

        priceLabel: buildPriceLabel(
            obj.suggestedPrice,
            obj.priceType
        ),

        publishedQuantity,

        publishedLabel:
            `${publishedQuantity} ` +
            `${obj.quantityUnit || ""} publicados`,

        soldQuantity,
        soldMoney,

        soldLabel:
            `${soldQuantity} ` +
            `${obj.quantityUnit || ""} vendidos`,

        realAvailable,
        availableReal: realAvailable,

        availableLabel:
            `${realAvailable} ` +
            `${obj.quantityUnit || ""} disponibles`,

        sales: Array.isArray(salesInfo?.sales)
            ? salesInfo.sales
            : [],
    };
};

const attachSpaceComputedFields = (offer) => {
    const obj =
        typeof offer?.toObject === "function"
            ? offer.toObject()
            : offer || {};

    const available =
        ["active", "recibiendo_propuestas"].includes(
            obj.status
        ) && !obj.selectedBid;

    return {
        ...obj,

        priceLabel:
            normalizeNumber(obj.suggestedPrice) > 0
                ? formatCOP(obj.suggestedPrice)
                : "Recibe propuestas",

        publishedQuantity: 1,
        publishedLabel: "1 carga publicada",

        soldQuantity: obj.selectedBid ? 1 : 0,
        soldMoney: 0,

        soldLabel: obj.selectedBid
            ? "Carga asignada"
            : "Sin asignar",

        realAvailable: available ? 1 : 0,
        availableReal: available ? 1 : 0,

        availableLabel: available
            ? "Recibiendo propuestas"
            : "Carga no disponible",

        weightLabel:
            obj.weightUnit === "toneladas"
                ? `${obj.weight} toneladas`
                : `${obj.weight} kg`,

        normalizedWeightLabel:
            `${normalizeNumber(obj.weightKg)} kg`,

        suggestedVehicleLabel:
            VEHICLE_LABELS[obj.suggestedVehicleType] ||
            "Por definir",

        requiredVehicleLabel:
            VEHICLE_LABELS[obj.requiredVehicleType] ||
            "Por definir",

        requiredBodyLabel:
            BODY_TYPE_LABELS[obj.requiredBodyType] ||
            "No especificada",
    };
};

const attachSeatComputedFields = (
    offer,
    salesInfo = null
) => {
    const obj =
        typeof offer?.toObject === "function"
            ? offer.toObject()
            : offer || {};

    const publishedQuantity =
        normalizeNumber(obj.seatsAvailable);

    const soldQuantity =
        normalizeNumber(salesInfo?.soldQuantity);

    const soldMoney =
        normalizeNumber(salesInfo?.soldMoney);

    const realAvailable = Math.max(
        publishedQuantity - soldQuantity,
        0
    );

    return {
        ...obj,

        priceLabel:
            `${formatCOP(obj.suggestedPrice)} por ` +
            `${obj.seatUnit || "cupo"}`,

        publishedQuantity,

        publishedLabel:
            `${publishedQuantity} ` +
            `${obj.seatUnit || "cupos"} publicados`,

        soldQuantity,
        soldMoney,

        soldLabel:
            `${soldQuantity} ` +
            `${obj.seatUnit || "cupos"} vendidos`,

        realAvailable,
        availableReal: realAvailable,

        availableLabel:
            `${realAvailable} ` +
            `${obj.seatUnit || "cupos"} disponibles`,

        sales: Array.isArray(salesInfo?.sales)
            ? salesInfo.sales
            : [],
    };
};

/* =========================================================
 * DISPONIBILIDAD DE MERCANCÍA Y CUPOS
 * ========================================================= */

const getAcceptedQuantity = async ({
    listingType,
    fieldName,
    offerId,
}) => {
    const result = await OfferBid.aggregate([
        {
            $match: {
                listingType,
                [fieldName]: offerId,
                status: "accepted",
            },
        },
        {
            $group: {
                _id: `$${fieldName}`,
                quantity: {
                    $sum: "$requestedQuantity",
                },
            },
        },
    ]);

    return normalizeNumber(result?.[0]?.quantity);
};

const buildSalesMap = async ({
    listingType,
    fieldName,
    offerIds,
}) => {
    if (!Array.isArray(offerIds) || offerIds.length === 0) {
        return {};
    }

    const bids = await OfferBid.find({
        listingType,
        [fieldName]: {
            $in: offerIds,
        },
        status: "accepted",
    })
        .populate("customer", "fullname email")
        .sort({
            updatedAt: -1,
        });

    const result = {};

    bids.forEach((bid) => {
        const reference = bid[fieldName];

        const id = String(
            reference?._id || reference
        );

        if (!result[id]) {
            result[id] = {
                soldQuantity: 0,
                soldMoney: 0,
                sales: [],
            };
        }

        const quantity =
            normalizeNumber(bid.requestedQuantity);

        const price =
            normalizeNumber(bid.offeredPrice);

        result[id].soldQuantity += quantity;
        result[id].soldMoney += price;

        result[id].sales.push({
            bidId: bid._id,

            customerName:
                getCustomerName(bid.customer),

            customerEmail:
                bid?.customer?.email || "",

            quantity,
            unit: bid.requestedUnit,
            price,
            message: bid.message || "",

            date:
                bid.updatedAt ||
                bid.createdAt,
        });
    });

    return result;
};

const shouldIncludeEmpty = (req) => {
    return String(
        req.query.includeEmpty || "false"
    ) === "true";
};

const filterAvailableOnly = (offers, req) => {
    if (shouldIncludeEmpty(req)) {
        return offers;
    }

    return offers.filter((offer) => {
        const available = Number(
            offer.availableReal ??
            offer.realAvailable ??
            0
        );

        return available > 0;
    });
};

const getTraditionalListingConfig = (bid) => {
    if (bid.listingType === "goods") {
        return {
            Model: GoodsOffer,
            listingId: bid.goodsOffer,
            bidField: "goodsOffer",
            quantityField: "quantityAvailable",
            unitField: "quantityUnit",
            emptyStatus: "sold_out",
        };
    }

    if (bid.listingType === "seat") {
        return {
            Model: SeatOffer,
            listingId: bid.seatOffer,
            bidField: "seatOffer",
            quantityField: "seatsAvailable",
            unitField: "seatUnit",
            emptyStatus: "full",
        };
    }

    return null;
};

const acceptTraditionalBid = async (bid) => {
    const config =
        getTraditionalListingConfig(bid);

    if (!config) {
        throw new Error(
            "Tipo de publicación inválido."
        );
    }

    const listingId =
        config.listingId?._id ||
        config.listingId;

    const listing =
        await config.Model.findById(
            listingId
        );

    if (!listing) {
        throw new Error(
            "La publicación ya no existe."
        );
    }

    if (listing.status !== "active") {
        throw new Error(
            "La publicación ya no está activa."
        );
    }

    const requestedQuantity =
        normalizeNumber(
            bid.requestedQuantity
        );

    const requestedUnit =
        String(
            bid.requestedUnit || ""
        ).trim();

    const listingUnit =
        String(
            listing[
                config.unitField
            ] || ""
        ).trim();

    if (requestedUnit !== listingUnit) {
        throw new Error(
            "La unidad solicitada no coincide " +
            "con la unidad publicada."
        );
    }

    const soldQuantity =
        await getAcceptedQuantity({
            listingType:
                bid.listingType,

            fieldName:
                config.bidField,

            offerId:
                listing._id,
        });

    const available =
        normalizeNumber(
            listing[
                config.quantityField
            ]
        ) - soldQuantity;

    if (requestedQuantity > available) {
        throw new Error(
            `No hay disponibilidad suficiente. ` +
            `Disponible: ${available} ${listingUnit}.`
        );
    }

    bid.status = "accepted";
    await bid.save();

    const availableAfter =
        available - requestedQuantity;

    if (availableAfter <= 0) {
        await config.Model.findByIdAndUpdate(
            listing._id,
            {
                $set: {
                    status:
                        config.emptyStatus,
                },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        await OfferBid.updateMany(
            {
                _id: {
                    $ne: bid._id,
                },

                listingType:
                    bid.listingType,

                [config.bidField]:
                    listing._id,

                status: {
                    $in: [
                        "pending",
                        "countered",
                    ],
                },
            },
            {
                $set: {
                    status: "rejected",

                    counterMessage:
                        "La publicación ya no tiene disponibilidad.",

                    rejectedAt:
                        new Date(),

                    respondedAt:
                        new Date(),
                },
            }
        );
    }

    return config.Model.findById(
        listing._id
    );
};

/* =========================================================
 * NOTIFICACIONES DEL MARKETPLACE DE CARGAS
 * ========================================================= */

const notifyUserNewSpaceBid = async (bidId) => {
    try {
        const bid = await OfferBid.findById(
            bidId
        )
            .populate(
                "customer",
                "fullname email socketId fcmTokens"
            )
            .populate(
                "driver",
                "fullname vehicle"
            )
            .populate("spaceOffer");

        if (!bid?.customer) {
            return;
        }

        const userId =
            bid.customer._id ||
            bid.customer;

        const title =
            "Nueva propuesta para tu carga";

        const body =
            `${getCaptainName(bid.driver)} ` +
            `ofrece realizar el viaje por ` +
            `${formatCOP(bid.offeredPrice)}.`;

        const user =
            await User.findById(
                userId
            ).select(
                "socketId fcmTokens"
            );

        if (user?.socketId) {
            sendMessageToSocketId(
                user.socketId,
                {
                    event:
                        "new-space-bid",

                    data: {
                        bidId:
                            String(bid._id),

                        status:
                            bid.status,

                        offeredPrice:
                            bid.offeredPrice,

                        offeredPriceLabel:
                            formatCOP(
                                bid.offeredPrice
                            ),

                        driverName:
                            getCaptainName(
                                bid.driver
                            ),

                        loadTitle:
                            bid?.spaceOffer
                                ?.title ||
                            "Carga disponible",
                    },
                }
            );
        }

        await pushService.sendToUser(
            userId,
            {
                title,
                body,

                type:
                    "marketplace_space_bid_received",

                data: {
                    bidId:
                        String(bid._id),

                    listingType:
                        "space",

                    status:
                        bid.status,

                    screen:
                        "user_space_bids_received",
                },

                link:
                    `${process.env.FRONTEND_URL || ""}` +
                    `/my-load-offers`,

                requireInteraction:
                    true,
            }
        );
    } catch (error) {
        console.error(
            "notifyUserNewSpaceBid:",
            error
        );
    }
};

const notifyCaptainSpaceBidUpdated = async (
    bidId,
    action
) => {
    try {
        const bid = await OfferBid.findById(
            bidId
        )
            .populate(
                "customer",
                "fullname email"
            )
            .populate(
                "driver",
                "fullname vehicle socketId fcmTokens"
            )
            .populate("spaceOffer");

        if (!bid?.driver) {
            return;
        }

        const captainId =
            bid.driver._id ||
            bid.driver;

        const title =
            action === "accepted"
                ? "Tu propuesta fue aceptada"
                : action === "rejected"
                ? "Tu propuesta no fue seleccionada"
                : action === "countered"
                ? "Recibiste una contraoferta"
                : "Actualización de propuesta";

        const body =
            action === "countered"
                ? `El cliente propone ` +
                  `${formatCOP(bid.counterPrice)}.`
                : `${getCustomerName(bid.customer)} ` +
                  `actualizó tu propuesta.`;

        const captain =
            await Captain.findById(
                captainId
            ).select(
                "socketId fcmTokens"
            );

        if (captain?.socketId) {
            sendMessageToSocketId(
                captain.socketId,
                {
                    event:
                        "space-bid-updated",

                    data: {
                        bidId:
                            String(bid._id),

                        status:
                            bid.status,

                        action,

                        offeredPrice:
                            bid.offeredPrice,

                        counterPrice:
                            bid.counterPrice,

                        title:
                            bid?.spaceOffer
                                ?.title ||
                            "Carga disponible",
                    },
                }
            );
        }

        await pushService.sendToCaptain(
            captainId,
            {
                title,
                body,

                type:
                    "marketplace_space_bid_updated",

                data: {
                    bidId:
                        String(bid._id),

                    listingType:
                        "space",

                    status:
                        bid.status,

                    action,

                    screen:
                        "captain_space_bids_sent",
                },

                link:
                    `${process.env.FRONTEND_URL || ""}` +
                    `/captain/load-proposals`,

                requireInteraction:
                    true,
            }
        );
    } catch (error) {
        console.error(
            "notifyCaptainSpaceBidUpdated:",
            error
        );
    }
};

const notifyUserSpaceCounterResponse = async (
    bidId,
    action
) => {
    try {
        const bid = await OfferBid.findById(
            bidId
        )
            .populate(
                "customer",
                "fullname email socketId fcmTokens"
            )
            .populate(
                "driver",
                "fullname vehicle"
            )
            .populate("spaceOffer");

        if (!bid?.customer) {
            return;
        }

        const userId =
            bid.customer._id ||
            bid.customer;

        const title =
            action === "accepted"
                ? "Contraoferta aceptada"
                : "Contraoferta rechazada";

        const body =
            `${getCaptainName(bid.driver)} ` +
            `${action === "accepted"
                ? "aceptó"
                : "rechazó"} ` +
            `tu contraoferta.`;

        const user =
            await User.findById(
                userId
            ).select(
                "socketId fcmTokens"
            );

        if (user?.socketId) {
            sendMessageToSocketId(
                user.socketId,
                {
                    event:
                        "space-counter-response",

                    data: {
                        bidId:
                            String(bid._id),

                        action,

                        status:
                            bid.status,
                    },
                }
            );
        }

        await pushService.sendToUser(
            userId,
            {
                title,
                body,

                type:
                    "marketplace_space_counter_response",

                data: {
                    bidId:
                        String(bid._id),

                    listingType:
                        "space",

                    status:
                        bid.status,

                    action,

                    screen:
                        "user_space_bids_received",
                },

                link:
                    `${process.env.FRONTEND_URL || ""}` +
                    `/my-load-offers`,

                requireInteraction:
                    true,
            }
        );
    } catch (error) {
        console.error(
            "notifyUserSpaceCounterResponse:",
            error
        );
    }
};

/* =========================================================
 * MERCANCÍA
 * ========================================================= */

module.exports.createGoodsOffer = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const offer =
            await GoodsOffer.create({
                driver:
                    req.captain._id,

                productName:
                    req.body.productName,

                quantityAvailable:
                    Number(
                        req.body
                            .quantityAvailable
                    ),

                quantityUnit:
                    req.body.quantityUnit,

                suggestedPrice:
                    Number(
                        req.body
                            .suggestedPrice
                    ),

                priceType:
                    req.body.priceType,

                origin:
                    req.body.origin,

                destination:
                    req.body.destination,

                departureTime:
                    req.body
                        .departureTime ||
                    null,

                vehicleType:
                    req.body
                        .vehicleType ||
                    null,

                description:
                    req.body
                        .description ||
                    "",

                notes:
                    req.body.notes ||
                    "",

                photos:
                    Array.isArray(
                        req.body.photos
                    )
                        ? req.body.photos
                              .filter(
                                  (photo) =>
                                      typeof photo ===
                                          "string" &&
                                      photo.trim()
                                          .length >
                                          0
                              )
                              .slice(0, 4)
                        : [],

                isNegotiable:
                    typeof req.body
                        .isNegotiable ===
                    "boolean"
                        ? req.body
                              .isNegotiable
                        : true,
            });

        return res.status(201).json({
            offer:
                attachGoodsComputedFields(
                    offer
                ),
        });
    } catch (error) {
        console.error(
            "Error creating goods offer:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error creando oferta de mercancía.",
        });
    }
};

module.exports.listGoodsOffers = async (
    req,
    res
) => {
    try {
        const filter = {
            status:
                req.query.status ||
                "active",
        };

        if (req.query.origin) {
            filter.origin = {
                $regex:
                    req.query.origin,

                $options: "i",
            };
        }

        if (req.query.destination) {
            filter.destination = {
                $regex:
                    req.query
                        .destination,

                $options: "i",
            };
        }

        const offers =
            await GoodsOffer.find(
                filter
            )
                .populate(
                    "driver",
                    "fullname vehicle"
                )
                .sort({
                    createdAt: -1,
                });

        const salesMap =
            await buildSalesMap({
                listingType:
                    "goods",

                fieldName:
                    "goodsOffer",

                offerIds:
                    offers.map(
                        (offer) =>
                            offer._id
                    ),
            });

        let computed =
            offers.map((offer) =>
                attachGoodsComputedFields(
                    offer,

                    salesMap[
                        String(
                            offer._id
                        )
                    ]
                )
            );

        computed =
            filterAvailableOnly(
                computed,
                req
            );

        return res.status(200).json({
            offers: computed,
        });
    } catch (error) {
        console.error(
            "Error listing goods offers:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error listando ofertas de mercancía.",
        });
    }
};

/* =========================================================
 * MARKETPLACE DE CARGAS
 * ========================================================= */

module.exports.createSpaceOffer = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const offer =
            await SpaceOffer.create({
                customer:
                    req.user._id,

                title:
                    req.body.title,

                cargoType:
                    req.body.cargoType,

                weight:
                    Number(
                        req.body.weight
                    ),

                weightUnit:
                    req.body
                        .weightUnit ||
                    "kg",

                /*
                 * Valor temporal obligatorio.
                 * El modelo lo recalcula en pre-validate.
                 */
                weightKg: 1,

                volumeM3:
                    Number(
                        req.body
                            .volumeM3 ||
                        0
                    ),

                lengthMeters:
                    Number(
                        req.body
                            .lengthMeters ||
                        0
                    ),

                widthMeters:
                    Number(
                        req.body
                            .widthMeters ||
                        0
                    ),

                heightMeters:
                    Number(
                        req.body
                            .heightMeters ||
                        0
                    ),

                packageQuantity:
                    Number(
                        req.body
                            .packageQuantity ||
                        0
                    ),

                packageUnit:
                    req.body
                        .packageUnit ||
                    "unidades",

                palletCount:
                    Number(
                        req.body
                            .palletCount ||
                        0
                    ),

                origin:
                    req.body.origin,

                originCity:
                    req.body
                        .originCity ||
                    "",

                originDepartment:
                    req.body
                        .originDepartment ||
                    "",

                destination:
                    req.body.destination,

                destinationCity:
                    req.body
                        .destinationCity ||
                    "",

                destinationDepartment:
                    req.body
                        .destinationDepartment ||
                    "",

                stops:
                    Array.isArray(
                        req.body.stops
                    )
                        ? req.body.stops
                        : [],

                pickupTime:
                    req.body
                        .pickupTime,

                deliveryDeadline:
                    req.body
                        .deliveryDeadline ||
                    null,

                pickupIsFlexible:
                    Boolean(
                        req.body
                            .pickupIsFlexible
                    ),

                requiredVehicleType:
                    req.body
                        .requiredVehicleType ||
                    null,

                requiredBodyType:
                    req.body
                        .requiredBodyType ||
                    "no_especificada",

                vehicleSuggestionOverridden:
                    Boolean(
                        req.body
                            .vehicleSuggestionOverridden
                    ),

                requiresRefrigeration:
                    Boolean(
                        req.body
                            .requiresRefrigeration
                    ),

                isFragile:
                    Boolean(
                        req.body.isFragile
                    ),

                isHazardous:
                    Boolean(
                        req.body
                            .isHazardous
                    ),

                requiresTarp:
                    Boolean(
                        req.body
                            .requiresTarp
                    ),

                requiresLoading:
                    Boolean(
                        req.body
                            .requiresLoading
                    ),

                requiresUnloading:
                    Boolean(
                        req.body
                            .requiresUnloading
                    ),

                requiresAssistant:
                    Boolean(
                        req.body
                            .requiresAssistant
                    ),

                loadingIncludedInPrice:
                    Boolean(
                        req.body
                            .loadingIncludedInPrice
                    ),

                unloadingIncludedInPrice:
                    Boolean(
                        req.body
                            .unloadingIncludedInPrice
                    ),

                priceMode:
                    req.body
                        .priceMode ||
                    "recibir_ofertas",

                suggestedPrice:
                    Number(
                        req.body
                            .suggestedPrice ||
                        0
                    ),

                isNegotiable:
                    typeof req.body
                        .isNegotiable ===
                    "boolean"
                        ? req.body
                              .isNegotiable
                        : true,

                paymentMethod:
                    req.body
                        .paymentMethod ||
                    "por_acordar",

                paymentTermDays:
                    Number(
                        req.body
                            .paymentTermDays ||
                        0
                    ),

                includesTolls:
                    typeof req.body
                        .includesTolls ===
                    "boolean"
                        ? req.body
                              .includesTolls
                        : true,

                includesFuel:
                    typeof req.body
                        .includesFuel ===
                    "boolean"
                        ? req.body
                              .includesFuel
                        : true,

                description:
                    req.body
                        .description ||
                    "",

                notes:
                    req.body.notes ||
                    "",

                contactInstructions:
                    req.body
                        .contactInstructions ||
                    "",

                photos:
                    Array.isArray(
                        req.body.photos
                    )
                        ? req.body.photos
                        : [],

                status: "active",
            });

        return res.status(201).json({
            offer:
                attachSpaceComputedFields(
                    offer
                ),

            message:
                "Carga publicada correctamente.",
        });
    } catch (error) {
        console.error(
            "Error creating space offer:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error creando la publicación de carga.",
        });
    }
};

module.exports.listSpaceOffers = async (
    req,
    res
) => {
    try {
        const filter = {
            status:
                req.query.status ||
                "active",
        };

        if (req.query.origin) {
            filter.origin = {
                $regex:
                    req.query.origin,

                $options: "i",
            };
        }

        if (req.query.destination) {
            filter.destination = {
                $regex:
                    req.query
                        .destination,

                $options: "i",
            };
        }

        if (
            req.query
                .requiredVehicleType
        ) {
            filter.requiredVehicleType =
                req.query
                    .requiredVehicleType;
        }

        if (
            req.query.requiredBodyType
        ) {
            filter.requiredBodyType =
                req.query
                    .requiredBodyType;
        }

        if (req.query.priceMode) {
            filter.priceMode =
                req.query.priceMode;
        }

        if (req.query.maxWeightKg) {
            filter.weightKg = {
                $lte: Number(
                    req.query
                        .maxWeightKg
                ),
            };
        }

        const offers =
            await SpaceOffer.find(
                filter
            )
                .populate(
                    "customer",
                    "fullname email"
                )
                .populate(
                    "selectedDriver",
                    "fullname vehicle"
                )
                .sort({
                    createdAt: -1,
                });

        let computed =
            offers.map(
                attachSpaceComputedFields
            );

        computed =
            filterAvailableOnly(
                computed,
                req
            );

        return res.status(200).json({
            offers: computed,
        });
    } catch (error) {
        console.error(
            "Error listing space offers:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error listando cargas disponibles.",
        });
    }
};

module.exports.getMySpaceOffers = async (
    req,
    res
) => {
    try {
        const offers =
            await SpaceOffer.find({
                customer:
                    req.user._id,
            })
                .populate(
                    "selectedDriver",
                    "fullname vehicle"
                )
                .sort({
                    createdAt: -1,
                });

        const ids =
            offers.map(
                (offer) =>
                    offer._id
            );

        const counts =
            ids.length > 0
                ? await OfferBid.aggregate([
                      {
                          $match: {
                              listingType:
                                  "space",

                              spaceOffer: {
                                  $in: ids,
                              },
                          },
                      },
                      {
                          $group: {
                              _id:
                                  "$spaceOffer",

                              total: {
                                  $sum: 1,
                              },

                              active: {
                                  $sum: {
                                      $cond: [
                                          {
                                              $in: [
                                                  "$status",

                                                  [
                                                      "pending",
                                                      "countered",
                                                  ],
                                              ],
                                          },

                                          1,
                                          0,
                                      ],
                                  },
                              },
                          },
                      },
                  ])
                : [];

        const countMap = {};

        counts.forEach((item) => {
            countMap[
                String(item._id)
            ] = item;
        });

        return res.status(200).json({
            offers: offers.map(
                (offer) => ({
                    ...attachSpaceComputedFields(
                        offer
                    ),

                    proposalsCount:
                        countMap[
                            String(
                                offer._id
                            )
                        ]?.total ||
                        0,

                    activeProposalsCount:
                        countMap[
                            String(
                                offer._id
                            )
                        ]?.active ||
                        0,
                })
            ),
        });
    } catch (error) {
        console.error(
            "Error fetching my loads:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error consultando tus cargas.",
        });
    }
};

module.exports.createSpaceBid = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const listing =
            await SpaceOffer.findById(
                req.body.listingId
            );

        if (!listing) {
            return res.status(404).json({
                message:
                    "Carga no encontrada.",
            });
        }

        if (
            ![
                "active",
                "recibiendo_propuestas",
            ].includes(listing.status)
        ) {
            return res.status(400).json({
                message:
                    "Esta carga ya no recibe propuestas.",
            });
        }

        if (listing.selectedBid) {
            return res.status(400).json({
                message:
                    "Esta carga ya tiene un transportador seleccionado.",
            });
        }

        const previous =
            await OfferBid.findOne({
                listingType:
                    "space",

                spaceOffer:
                    listing._id,

                driver:
                    req.captain._id,

                status: {
                    $in: [
                        "pending",
                        "countered",
                    ],
                },
            });

        if (previous) {
            return res.status(409).json({
                message:
                    "Ya tienes una propuesta activa para esta carga.",

                bid: previous,
            });
        }

        const offeredPrice =
            normalizeNumber(
                req.body.offeredPrice
            );

        if (offeredPrice <= 0) {
            return res.status(400).json({
                message:
                    "El valor debe ser mayor que cero.",
            });
        }

        const capacity =
            normalizeNumber(
                req.body
                    .proposedVehicleCapacity
            );

        const capacityUnit =
            req.body
                .proposedVehicleCapacityUnit ||
            null;

        const capacityKg =
            capacityUnit === "toneladas"
                ? capacity * 1000
                : capacityUnit === "kg"
                ? capacity
                : null;

        if (
            capacityKg &&
            normalizeNumber(
                listing
                    .recommendedMinCapacityKg
            ) > 0 &&
            capacityKg <
                normalizeNumber(
                    listing
                        .recommendedMinCapacityKg
                )
        ) {
            return res.status(400).json({
                message:
                    `La capacidad del vehículo es menor ` +
                    `a la recomendada para la carga: ` +
                    `${listing.recommendedMinCapacityKg} kg.`,
            });
        }

        const bid =
            await OfferBid.create({
                listingType:
                    "space",

                spaceOffer:
                    listing._id,

                customer:
                    listing.customer,

                driver:
                    req.captain._id,

                requestedQuantity: 1,

                requestedUnit:
                    "vehiculo_completo",

                offeredPrice,

                message:
                    req.body.message ||
                    "",

                proposedVehicleType:
                    req.body
                        .proposedVehicleType ||
                    null,

                proposedVehicleBrand:
                    req.body
                        .proposedVehicleBrand ||
                    "",

                proposedVehicleReference:
                    req.body
                        .proposedVehicleReference ||
                    "",

                proposedVehicleModel:
                    req.body
                        .proposedVehicleModel ||
                    "",

                proposedVehiclePlate:
                    req.body
                        .proposedVehiclePlate ||
                    "",

                proposedBodyType:
                    req.body
                        .proposedBodyType ||
                    "no_especificada",

                proposedVehicleCapacity:
                    capacity || null,

                proposedVehicleCapacityUnit:
                    capacityUnit,

                availablePickupTime:
                    req.body
                        .availablePickupTime ||
                    null,

                estimatedDeliveryTime:
                    req.body
                        .estimatedDeliveryTime ||
                    null,

                estimatedDurationHours:
                    normalizeNumber(
                        req.body
                            .estimatedDurationHours
                    ) || null,

                includesLoading:
                    Boolean(
                        req.body
                            .includesLoading
                    ),

                includesUnloading:
                    Boolean(
                        req.body
                            .includesUnloading
                    ),

                includesAssistant:
                    Boolean(
                        req.body
                            .includesAssistant
                    ),

                includesTolls:
                    typeof req.body
                        .includesTolls ===
                    "boolean"
                        ? req.body
                              .includesTolls
                        : true,

                includesFuel:
                    typeof req.body
                        .includesFuel ===
                    "boolean"
                        ? req.body
                              .includesFuel
                        : true,

                includesInsurance:
                    Boolean(
                        req.body
                            .includesInsurance
                    ),
            });

        await SpaceOffer.findByIdAndUpdate(
            listing._id,
            {
                $set: {
                    status:
                        "recibiendo_propuestas",
                },

                $inc: {
                    proposalsCount: 1,
                },
            }
        );

        runNotification(
            "Nueva propuesta de carga",
            () =>
                notifyUserNewSpaceBid(
                    bid._id
                )
        );

        return res.status(201).json({
            bid,

            message:
                "Propuesta enviada correctamente.",
        });
    } catch (error) {
        console.error(
            "Error creating space bid:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error enviando la propuesta.",
        });
    }
};

module.exports.respondToSpaceBid = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const {
            bidId,
            action,
            counterPrice,
            counterMessage,
        } = req.body;

        const bid =
            await OfferBid.findById(
                bidId
            );

        if (
            !bid ||
            bid.listingType !==
                "space"
        ) {
            return res.status(404).json({
                message:
                    "Propuesta no encontrada.",
            });
        }

        if (
            String(bid.customer) !==
            String(req.user._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para responder.",
            });
        }

        if (
            ![
                "pending",
                "countered",
            ].includes(bid.status)
        ) {
            return res.status(400).json({
                message:
                    "Esta propuesta ya fue respondida.",
            });
        }

        const listing =
            await SpaceOffer.findById(
                bid.spaceOffer
            );

        if (!listing) {
            return res.status(404).json({
                message:
                    "La carga ya no existe.",
            });
        }

        if (action === "accepted") {
            if (listing.selectedBid) {
                return res.status(409).json({
                    message:
                        "Ya existe un transportador seleccionado.",
                });
            }

            bid.status = "accepted";
            await bid.save();

            const updatedListing =
                await SpaceOffer.findByIdAndUpdate(
                    listing._id,
                    {
                        $set: {
                            status:
                                "assigned",

                            selectedBid:
                                bid._id,

                            selectedDriver:
                                bid.driver,

                            assignedAt:
                                new Date(),
                        },
                    },
                    {
                        new: true,
                        runValidators: true,
                    }
                );

            let tracking = null;

            try {
                tracking =
                    await createTrackingFromAcceptedBid({
                        bidId:
                            bid._id,

                        trackingPlan:
                            "basic",
                    });
            } catch (trackingError) {
                console.error(
                    "No se pudo crear el seguimiento de la carga aceptada:",
                    trackingError
                );
            }

            await OfferBid.updateMany(
                {
                    _id: {
                        $ne: bid._id,
                    },

                    listingType:
                        "space",

                    spaceOffer:
                        listing._id,

                    status: {
                        $in: [
                            "pending",
                            "countered",
                        ],
                    },
                },
                {
                    $set: {
                        status:
                            "rejected",

                        counterMessage:
                            "El cliente seleccionó otra propuesta.",

                        rejectedAt:
                            new Date(),

                        respondedAt:
                            new Date(),
                    },
                }
            );

            runNotification(
                "Propuesta aceptada",
                () =>
                    notifyCaptainSpaceBidUpdated(
                        bid._id,
                        "accepted"
                    )
            );

            return res.status(200).json({
                bid,

                listing:
                    attachSpaceComputedFields(
                        updatedListing
                    ),

                tracking,

                message:
                    tracking
                        ? "Propuesta aceptada, transportador seleccionado y seguimiento creado."
                        : "Propuesta aceptada y transportador seleccionado. El seguimiento quedó pendiente de creación.",
            });
        }

        if (action === "rejected") {
            bid.status = "rejected";
            await bid.save();

            runNotification(
                "Propuesta rechazada",
                () =>
                    notifyCaptainSpaceBidUpdated(
                        bid._id,
                        "rejected"
                    )
            );

            return res.status(200).json({
                bid,

                message:
                    "Propuesta rechazada correctamente.",
            });
        }

        if (action === "countered") {
            const price =
                normalizeNumber(
                    counterPrice
                );

            if (price <= 0) {
                return res.status(400).json({
                    message:
                        "La contraoferta debe ser mayor que cero.",
                });
            }

            bid.status = "countered";
            bid.counterPrice = price;

            bid.counterMessage =
                counterMessage || "";

            await bid.save();

            runNotification(
                "Contraoferta enviada",
                () =>
                    notifyCaptainSpaceBidUpdated(
                        bid._id,
                        "countered"
                    )
            );

            return res.status(200).json({
                bid,

                message:
                    "Contraoferta enviada correctamente.",
            });
        }

        return res.status(400).json({
            message:
                "Acción inválida.",
        });
    } catch (error) {
        console.error(
            "Error responding space bid:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error respondiendo la propuesta.",
        });
    }
};

module.exports.captainRespondToSpaceCounter =
async (req, res) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const {
            bidId,
            action,
        } = req.body;

        const bid =
            await OfferBid.findById(
                bidId
            );

        if (
            !bid ||
            bid.listingType !==
                "space"
        ) {
            return res.status(404).json({
                message:
                    "Propuesta no encontrada.",
            });
        }

        if (
            String(bid.driver) !==
            String(req.captain._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para responder.",
            });
        }

        if (
            bid.status !==
            "countered"
        ) {
            return res.status(400).json({
                message:
                    "No hay una contraoferta activa.",
            });
        }

        if (action === "rejected") {
            bid.status = "rejected";
            await bid.save();

            runNotification(
                "Contraoferta rechazada",
                () =>
                    notifyUserSpaceCounterResponse(
                        bid._id,
                        "rejected"
                    )
            );

            return res.status(200).json({
                bid,

                message:
                    "Contraoferta rechazada.",
            });
        }

        if (action === "accepted") {
            const listing =
                await SpaceOffer.findById(
                    bid.spaceOffer
                );

            if (!listing) {
                return res.status(404).json({
                    message:
                        "La carga ya no existe.",
                });
            }

            if (listing.selectedBid) {
                return res.status(409).json({
                    message:
                        "La carga ya tiene transportador.",
                });
            }

            const acceptedCounterPrice =
                normalizeNumber(
                    bid.counterPrice
                );

            if (acceptedCounterPrice <= 0) {
                return res.status(400).json({
                    message:
                        "La contraoferta no tiene un valor válido.",
                });
            }

            bid.offeredPrice =
                acceptedCounterPrice;

            bid.status =
                "accepted";

            await bid.save();

            const updatedListing =
                await SpaceOffer.findByIdAndUpdate(
                    listing._id,
                    {
                        $set: {
                            status:
                                "assigned",

                            selectedBid:
                                bid._id,

                            selectedDriver:
                                bid.driver,

                            assignedAt:
                                new Date(),
                        },
                    },
                    {
                        new: true,
                        runValidators: true,
                    }
                );

            let tracking = null;

            try {
                tracking =
                    await createTrackingFromAcceptedBid({
                        bidId:
                            bid._id,

                        trackingPlan:
                            "basic",
                    });
            } catch (trackingError) {
                console.error(
                    "No se pudo crear el seguimiento de la contraoferta aceptada:",
                    trackingError
                );
            }

            await OfferBid.updateMany(
                {
                    _id: {
                        $ne: bid._id,
                    },

                    listingType:
                        "space",

                    spaceOffer:
                        listing._id,

                    status: {
                        $in: [
                            "pending",
                            "countered",
                        ],
                    },
                },
                {
                    $set: {
                        status:
                            "rejected",

                        counterMessage:
                            "El cliente seleccionó otra propuesta.",

                        rejectedAt:
                            new Date(),

                        respondedAt:
                            new Date(),
                    },
                }
            );

            runNotification(
                "Contraoferta aceptada",
                () =>
                    notifyUserSpaceCounterResponse(
                        bid._id,
                        "accepted"
                    )
            );

            return res.status(200).json({
                bid,

                listing:
                    attachSpaceComputedFields(
                        updatedListing
                    ),

                tracking,

                message:
                    tracking
                        ? "Contraoferta aceptada, servicio asignado y seguimiento creado."
                        : "Contraoferta aceptada y servicio asignado. El seguimiento quedó pendiente de creación.",
            });
        }

        return res.status(400).json({
            message:
                "Acción inválida.",
        });
    } catch (error) {
        console.error(
            "Error responding counter:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error respondiendo la contraoferta.",
        });
    }
};

module.exports.getMyReceivedSpaceBids =
async (req, res) => {
    try {
        const offers =
            await SpaceOffer.find({
                customer:
                    req.user._id,
            }).select("_id");

        const bids =
            await OfferBid.find({
                listingType:
                    "space",

                spaceOffer: {
                    $in: offers.map(
                        (offer) =>
                            offer._id
                    ),
                },
            })
                .populate(
                    "driver",
                    "fullname vehicle profileImage"
                )
                .populate(
                    "spaceOffer"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            bids,
        });
    } catch (error) {
        console.error(
            "Error received space bids:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error consultando propuestas recibidas.",
        });
    }
};

module.exports.getMySentSpaceBids =
async (req, res) => {
    try {
        const bids =
            await OfferBid.find({
                listingType:
                    "space",

                driver:
                    req.captain._id,
            })
                .populate(
                    "customer",
                    "fullname email"
                )
                .populate(
                    "spaceOffer"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            bids,
        });
    } catch (error) {
        console.error(
            "Error sent space bids:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error consultando propuestas enviadas.",
        });
    }
};

/* =========================================================
 * CUPOS
 * ========================================================= */

module.exports.createSeatOffer = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const offer =
            await SeatOffer.create({
                driver:
                    req.captain._id,

                seatsAvailable:
                    Number(
                        req.body
                            .seatsAvailable
                    ),

                seatUnit:
                    req.body.seatUnit ||
                    "cupos",

                suggestedPrice:
                    Number(
                        req.body
                            .suggestedPrice
                    ),

                origin:
                    req.body.origin,

                stops:
                    Array.isArray(
                        req.body.stops
                    )
                        ? req.body.stops
                        : [],

                destination:
                    req.body.destination,

                departureTime:
                    req.body
                        .departureTime ||
                    null,

                vehicleType:
                    req.body
                        .vehicleType ||
                    null,

                description:
                    req.body
                        .description ||
                    "",

                notes:
                    req.body.notes ||
                    "",

                isNegotiable:
                    typeof req.body
                        .isNegotiable ===
                    "boolean"
                        ? req.body
                              .isNegotiable
                        : true,
            });

        return res.status(201).json({
            offer:
                attachSeatComputedFields(
                    offer
                ),
        });
    } catch (error) {
        console.error(
            "Error creating seat offer:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error creando oferta de cupos.",
        });
    }
};

module.exports.listSeatOffers = async (
    req,
    res
) => {
    try {
        const filter = {
            status:
                req.query.status ||
                "active",
        };

        if (req.query.origin) {
            filter.origin = {
                $regex:
                    req.query.origin,

                $options: "i",
            };
        }

        if (req.query.destination) {
            filter.destination = {
                $regex:
                    req.query
                        .destination,

                $options: "i",
            };
        }

        const offers =
            await SeatOffer.find(
                filter
            )
                .populate(
                    "driver",
                    "fullname vehicle"
                )
                .sort({
                    createdAt: -1,
                });

        const salesMap =
            await buildSalesMap({
                listingType:
                    "seat",

                fieldName:
                    "seatOffer",

                offerIds:
                    offers.map(
                        (offer) =>
                            offer._id
                    ),
            });

        let computed =
            offers.map((offer) =>
                attachSeatComputedFields(
                    offer,

                    salesMap[
                        String(
                            offer._id
                        )
                    ]
                )
            );

        computed =
            filterAvailableOnly(
                computed,
                req
            );

        return res.status(200).json({
            offers: computed,
        });
    } catch (error) {
        console.error(
            "Error listing seat offers:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error listando ofertas de cupos.",
        });
    }
};

/* =========================================================
 * PUJAS EXISTENTES DE MERCANCÍA Y CUPOS
 * ========================================================= */

module.exports.createBid = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const {
            listingType,
            listingId,
            requestedQuantity,
            requestedUnit,
            offeredPrice,
            message,
        } = req.body;

        if (
            !["goods", "seat"].includes(
                listingType
            )
        ) {
            return res.status(400).json({
                message:
                    "Tipo de publicación inválido.",
            });
        }

        const quantity =
            normalizeNumber(
                requestedQuantity
            );

        const price =
            normalizeNumber(
                offeredPrice
            );

        if (quantity <= 0) {
            return res.status(400).json({
                message:
                    "La cantidad debe ser mayor que cero.",
            });
        }

        if (price <= 0) {
            return res.status(400).json({
                message:
                    "El valor debe ser mayor que cero.",
            });
        }

        let listing;
        let referenceField;
        let quantityField;
        let unitField;

        if (listingType === "goods") {
            listing =
                await GoodsOffer.findById(
                    listingId
                );

            referenceField =
                "goodsOffer";

            quantityField =
                "quantityAvailable";

            unitField =
                "quantityUnit";
        } else {
            listing =
                await SeatOffer.findById(
                    listingId
                );

            referenceField =
                "seatOffer";

            quantityField =
                "seatsAvailable";

            unitField =
                "seatUnit";
        }

        if (!listing) {
            return res.status(404).json({
                message:
                    "Publicación no encontrada.",
            });
        }

        if (listing.status !== "active") {
            return res.status(400).json({
                message:
                    "La publicación no está activa.",
            });
        }

        if (
            String(requestedUnit) !==
            String(
                listing[unitField]
            )
        ) {
            return res.status(400).json({
                message:
                    `Debes ofertar en ` +
                    `${listing[unitField]}.`,
            });
        }

        const accepted =
            await getAcceptedQuantity({
                listingType,

                fieldName:
                    referenceField,

                offerId:
                    listing._id,
            });

        const available =
            normalizeNumber(
                listing[
                    quantityField
                ]
            ) - accepted;

        if (quantity > available) {
            return res.status(400).json({
                message:
                    `Disponible: ${available} ` +
                    `${listing[unitField]}.`,
            });
        }

        const bid =
            await OfferBid.create({
                listingType,

                customer:
                    req.user._id,

                driver:
                    listing.driver,

                requestedQuantity:
                    quantity,

                requestedUnit,

                offeredPrice:
                    price,

                message:
                    message || "",

                [referenceField]:
                    listing._id,
            });

        return res.status(201).json({
            bid,

            message:
                "Solicitud enviada correctamente.",
        });
    } catch (error) {
        console.error(
            "Error creating bid:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error creando solicitud.",
        });
    }
};

module.exports.respondToBid = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const {
            bidId,
            action,
            counterPrice,
            counterMessage,
        } = req.body;

        const bid =
            await OfferBid.findById(
                bidId
            );

        if (!bid) {
            return res.status(404).json({
                message:
                    "Oferta no encontrada.",
            });
        }

        if (bid.listingType === "space") {
            return res.status(400).json({
                message:
                    "Usa la ruta de propuestas de carga.",
            });
        }

        if (
            String(bid.driver) !==
            String(req.captain._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización.",
            });
        }

        if (
            ![
                "pending",
                "countered",
            ].includes(bid.status)
        ) {
            return res.status(400).json({
                message:
                    "La oferta ya fue respondida.",
            });
        }

        let listing = null;

        if (action === "accepted") {
            listing =
                await acceptTraditionalBid(
                    bid
                );
        } else if (
            action === "rejected"
        ) {
            bid.status =
                "rejected";

            await bid.save();
        } else if (
            action === "countered"
        ) {
            const price =
                normalizeNumber(
                    counterPrice
                );

            if (price <= 0) {
                return res.status(400).json({
                    message:
                        "Contraoferta inválida.",
                });
            }

            bid.status =
                "countered";

            bid.counterPrice =
                price;

            bid.counterMessage =
                counterMessage ||
                "";

            await bid.save();
        } else {
            return res.status(400).json({
                message:
                    "Acción inválida.",
            });
        }

        return res.status(200).json({
            bid,
            listing,

            message:
                action === "accepted"
                    ? "Oferta aceptada."
                    : action === "rejected"
                    ? "Oferta rechazada."
                    : "Contraoferta enviada.",
        });
    } catch (error) {
        console.error(
            "Error responding bid:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error respondiendo oferta.",
        });
    }
};

module.exports.customerRespondToBid =
async (req, res) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
            });
        }

        const {
            bidId,
            action,
        } = req.body;

        const bid =
            await OfferBid.findById(
                bidId
            );

        if (!bid) {
            return res.status(404).json({
                message:
                    "Oferta no encontrada.",
            });
        }

        if (bid.listingType === "space") {
            return res.status(400).json({
                message:
                    "Usa la ruta de contraofertas de cargas.",
            });
        }

        if (
            String(bid.customer) !==
            String(req.user._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización.",
            });
        }

        if (
            bid.status !==
            "countered"
        ) {
            return res.status(400).json({
                message:
                    "No hay contraoferta activa.",
            });
        }

        let listing = null;

        if (action === "accepted") {
            listing =
                await acceptTraditionalBid(
                    bid
                );
        } else if (
            action === "rejected"
        ) {
            bid.status =
                "rejected";

            await bid.save();
        } else {
            return res.status(400).json({
                message:
                    "Acción inválida.",
            });
        }

        return res.status(200).json({
            bid,
            listing,

            message:
                action === "accepted"
                    ? "Contraoferta aceptada."
                    : "Contraoferta rechazada.",
        });
    } catch (error) {
        console.error(
            "Error customer response:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error respondiendo contraoferta.",
        });
    }
};

module.exports.getMyReceivedBids = async (
    req,
    res
) => {
    try {
        const bids =
            await OfferBid.find({
                driver:
                    req.captain._id,

                listingType: {
                    $in: [
                        "goods",
                        "seat",
                    ],
                },
            })
                .populate(
                    "customer",
                    "fullname email"
                )
                .populate(
                    "goodsOffer"
                )
                .populate(
                    "seatOffer"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            bids,
        });
    } catch (error) {
        console.error(
            "Error received bids:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error consultando solicitudes.",
        });
    }
};

module.exports.getMySentBids = async (
    req,
    res
) => {
    try {
        const bids =
            await OfferBid.find({
                customer:
                    req.user._id,

                listingType: {
                    $in: [
                        "goods",
                        "seat",
                    ],
                },
            })
                .populate(
                    "driver",
                    "fullname vehicle"
                )
                .populate(
                    "goodsOffer"
                )
                .populate(
                    "seatOffer"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            bids,
        });
    } catch (error) {
        console.error(
            "Error sent bids:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "Error consultando solicitudes.",
        });
    }
};