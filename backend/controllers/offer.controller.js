const { validationResult } = require("express-validator");

const GoodsOffer = require("../models/goodsOffer.model");
const SpaceOffer = require("../models/spaceOffer.model");
const SeatOffer = require("../models/seatOffer.model");
const OfferBid = require("../models/offerBid.model");
const User = require("../models/user.model");
const Captain = require("../models/captain.model");
const { sendMessageToSocketId } = require("../socket");

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

const getCustomerNameFromBid = (bid) => {
    const first = bid?.customer?.fullname?.firstname || "";
    const last = bid?.customer?.fullname?.lastname || "";
    const full = `${first} ${last}`.trim();

    return full || bid?.customer?.email || "Cliente";
};

const getCaptainName = (captain) => {
    const first = captain?.fullname?.firstname || "";
    const last = captain?.fullname?.lastname || "";
    return `${first} ${last}`.trim() || "Transportador";
};

const getListingTitleFromBid = (bid) => {
    if (bid?.listingType === "goods") {
        return bid?.goodsOffer?.productName || "Mercancía";
    }

    if (bid?.listingType === "space") {
        return bid?.spaceOffer?.cargoType
            ? `Espacio para ${bid.spaceOffer.cargoType}`
            : "Espacio disponible";
    }

    if (bid?.listingType === "seat") {
        return "Cupos disponibles";
    }

    return "Oferta";
};

const buildBidNotificationPayload = (bid, extra = {}) => {
    return {
        bidId: String(bid?._id || ""),
        listingType: bid?.listingType || "",
        status: bid?.status || "",
        title: getListingTitleFromBid(bid),
        requestedQuantity: normalizeNumber(bid?.requestedQuantity),
        requestedUnit: bid?.requestedUnit || "",
        offeredPrice: normalizeNumber(bid?.offeredPrice),
        offeredPriceLabel: formatCOP(bid?.offeredPrice),
        counterPrice: bid?.counterPrice || null,
        counterPriceLabel: bid?.counterPrice ? formatCOP(bid.counterPrice) : "",
        message: bid?.message || "",
        counterMessage: bid?.counterMessage || "",
        customerName: getCustomerNameFromBid(bid),
        captainName: getCaptainName(bid?.driver),
        createdAt: bid?.createdAt,
        updatedAt: bid?.updatedAt,
        ...extra,
    };
};

const notifyCaptainNewBid = async (bidId) => {
    try {
        const bid = await OfferBid.findById(bidId)
            .populate("customer", "fullname email")
            .populate("driver", "fullname vehicle socketId")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer");

        if (!bid?.driver) return;

        const captain = await Captain.findById(bid.driver._id || bid.driver).select("socketId");

        if (!captain?.socketId) {
            console.log("[offers] captain offline, notification skipped:", String(bid.driver._id || bid.driver));
            return;
        }

        sendMessageToSocketId(captain.socketId, {
            event: "new-offer-bid",
            data: buildBidNotificationPayload(bid, {
                notificationTitle: "Nueva oferta recibida",
                notificationBody: `${getCustomerNameFromBid(bid)} ofertó ${bid.requestedQuantity} ${bid.requestedUnit} por ${formatCOP(bid.offeredPrice)}.`,
            }),
        });
    } catch (error) {
        console.error("[offers] notifyCaptainNewBid error:", error);
    }
};

const notifyUserBidUpdated = async (bidId, action) => {
    try {
        const bid = await OfferBid.findById(bidId)
            .populate("customer", "fullname email socketId")
            .populate("driver", "fullname vehicle")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer");

        if (!bid?.customer) return;

        const user = await User.findById(bid.customer._id || bid.customer).select("socketId");

        if (!user?.socketId) {
            console.log("[offers] user offline, notification skipped:", String(bid.customer._id || bid.customer));
            return;
        }

        const actionLabels = {
            accepted: "aceptó",
            rejected: "rechazó",
            countered: "envió una contraoferta",
            completed: "completó",
            cancelled: "canceló",
        };

        sendMessageToSocketId(user.socketId, {
            event: "offer-bid-updated",
            data: buildBidNotificationPayload(bid, {
                action,
                notificationTitle: "Respuesta a tu oferta",
                notificationBody: `${getCaptainName(bid.driver)} ${actionLabels[action] || "respondió"} tu oferta.`,
            }),
        });
    } catch (error) {
        console.error("[offers] notifyUserBidUpdated error:", error);
    }
};

const notifyCaptainCustomerCounterResponse = async (bidId, action) => {
    try {
        const bid = await OfferBid.findById(bidId)
            .populate("customer", "fullname email")
            .populate("driver", "fullname vehicle socketId")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer");

        if (!bid?.driver) return;

        const captain = await Captain.findById(bid.driver._id || bid.driver).select("socketId");

        if (!captain?.socketId) {
            console.log("[offers] captain offline, counter response notification skipped:", String(bid.driver._id || bid.driver));
            return;
        }

        const actionLabel = action === "accepted" ? "aceptó" : "rechazó";

        sendMessageToSocketId(captain.socketId, {
            event: "offer-counter-response",
            data: buildBidNotificationPayload(bid, {
                action,
                notificationTitle: "Respuesta a tu contraoferta",
                notificationBody: `${getCustomerNameFromBid(bid)} ${actionLabel} tu contraoferta.`,
            }),
        });
    } catch (error) {
        console.error("[offers] notifyCaptainCustomerCounterResponse error:", error);
    }
};

const buildSalesMap = async ({ listingType, fieldName, offerIds }) => {
    if (!Array.isArray(offerIds) || offerIds.length === 0) {
        return {};
    }

    const acceptedBids = await OfferBid.find({
        listingType,
        [fieldName]: { $in: offerIds },
        status: "accepted",
    })
        .populate("customer", "fullname email")
        .sort({ updatedAt: -1 });

    const salesMap = {};

    acceptedBids.forEach((bid) => {
        const rawOfferId = bid[fieldName];
        const offerId = String(rawOfferId?._id || rawOfferId);

        if (!salesMap[offerId]) {
            salesMap[offerId] = {
                soldQuantity: 0,
                soldMoney: 0,
                sales: [],
            };
        }

        const quantity = normalizeNumber(bid.requestedQuantity);
        const money = normalizeNumber(bid.offeredPrice);

        salesMap[offerId].soldQuantity += quantity;
        salesMap[offerId].soldMoney += money;

        salesMap[offerId].sales.push({
            bidId: bid._id,
            customerName: getCustomerNameFromBid(bid),
            customerEmail: bid?.customer?.email || "",
            quantity,
            unit: bid.requestedUnit,
            price: money,
            message: bid.message || "",
            date: bid.updatedAt || bid.createdAt,
        });
    });

    return salesMap;
};

const getAcceptedSoldQuantity = async ({ listingType, fieldName, offerId }) => {
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
                soldQuantity: { $sum: "$requestedQuantity" },
            },
        },
    ]);

    return normalizeNumber(result?.[0]?.soldQuantity);
};

const attachGoodsComputedFields = (offer, salesInfo = null) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    const publishedQuantity = normalizeNumber(obj.quantityAvailable);
    const soldQuantity = normalizeNumber(salesInfo?.soldQuantity);
    const soldMoney = normalizeNumber(salesInfo?.soldMoney);
    const realAvailable = Math.max(publishedQuantity - soldQuantity, 0);

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        publishedQuantity,
        publishedLabel: `${publishedQuantity} ${obj.quantityUnit || ""} publicados`,
        soldQuantity,
        soldMoney,
        soldLabel: `${soldQuantity} ${obj.quantityUnit || ""} vendidos`,
        realAvailable,
        availableReal: realAvailable,
        availableLabel: `${realAvailable} ${obj.quantityUnit || ""} disponibles`,
        sales: Array.isArray(salesInfo?.sales) ? salesInfo.sales : [],
    };
};

const attachSpaceComputedFields = (offer, salesInfo = null) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    const publishedQuantity = normalizeNumber(obj.capacityAvailable);
    const soldQuantity = normalizeNumber(salesInfo?.soldQuantity);
    const soldMoney = normalizeNumber(salesInfo?.soldMoney);
    const realAvailable = Math.max(publishedQuantity - soldQuantity, 0);

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        publishedQuantity,
        publishedLabel: `${publishedQuantity} ${obj.capacityUnit || ""} publicados`,
        soldQuantity,
        soldMoney,
        soldLabel: `${soldQuantity} ${obj.capacityUnit || ""} vendidos`,
        realAvailable,
        availableReal: realAvailable,
        availableLabel: `${realAvailable} ${obj.capacityUnit || ""} disponibles`,
        sales: Array.isArray(salesInfo?.sales) ? salesInfo.sales : [],
    };
};

const attachSeatComputedFields = (offer, salesInfo = null) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    const publishedQuantity = normalizeNumber(obj.seatsAvailable);
    const soldQuantity = normalizeNumber(salesInfo?.soldQuantity);
    const soldMoney = normalizeNumber(salesInfo?.soldMoney);
    const realAvailable = Math.max(publishedQuantity - soldQuantity, 0);

    return {
        ...obj,
        priceLabel: `${formatCOP(obj.suggestedPrice)} por ${obj.seatUnit || "cupo"}`,
        publishedQuantity,
        publishedLabel: `${publishedQuantity} ${obj.seatUnit || "cupos"} publicados`,
        soldQuantity,
        soldMoney,
        soldLabel: `${soldQuantity} ${obj.seatUnit || "cupos"} vendidos`,
        realAvailable,
        availableReal: realAvailable,
        availableLabel: `${realAvailable} ${obj.seatUnit || "cupos"} disponibles`,
        sales: Array.isArray(salesInfo?.sales) ? salesInfo.sales : [],
    };
};

const shouldIncludeEmpty = (req) => {
    return String(req.query.includeEmpty || "false") === "true";
};

const filterAvailableOnly = (offers, req) => {
    if (shouldIncludeEmpty(req)) {
        return offers;
    }

    return offers.filter((offer) => {
        const available = Number(offer.availableReal ?? offer.realAvailable ?? 0);
        return available > 0;
    });
};

const getListingConfigFromBid = (bid) => {
    if (bid.listingType === "goods") {
        return {
            Model: GoodsOffer,
            listingId: bid.goodsOffer,
            bidField: "goodsOffer",
            quantityField: "quantityAvailable",
            unitField: "quantityUnit",
            emptyStatus: "sold_out",
            listingName: "mercancía",
        };
    }

    if (bid.listingType === "space") {
        return {
            Model: SpaceOffer,
            listingId: bid.spaceOffer,
            bidField: "spaceOffer",
            quantityField: "capacityAvailable",
            unitField: "capacityUnit",
            emptyStatus: "reserved",
            listingName: "espacio",
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
            listingName: "cupos",
        };
    }

    return null;
};

const getListingIdFromBid = (bid, config) => {
    if (!config || !config.listingId) return null;

    if (typeof config.listingId === "object" && config.listingId._id) {
        return config.listingId._id;
    }

    return config.listingId;
};

const getRealAvailableForListing = async ({
    listingType,
    bidField,
    listingId,
    publishedQuantity,
}) => {
    const soldQuantity = await getAcceptedSoldQuantity({
        listingType,
        fieldName: bidField,
        offerId: listingId,
    });

    return Math.max(normalizeNumber(publishedQuantity) - soldQuantity, 0);
};

const discountAvailabilityForBid = async (bid) => {
    const config = getListingConfigFromBid(bid);

    if (!config) {
        throw new Error("Tipo de publicación inválido.");
    }

    const listingId = getListingIdFromBid(bid, config);

    if (!listingId) {
        throw new Error("No se pudo identificar la publicación de esta oferta.");
    }

    const requestedQuantity = normalizeNumber(bid.requestedQuantity);

    if (requestedQuantity <= 0) {
        throw new Error("La cantidad solicitada debe ser mayor que cero.");
    }

    const requestedUnit = String(bid.requestedUnit || "").trim();

    if (!requestedUnit) {
        throw new Error("La unidad solicitada no es válida.");
    }

    const listingBefore = await config.Model.findById(listingId);

    if (!listingBefore) {
        throw new Error("La publicación ya no existe.");
    }

    if (listingBefore.status !== "active") {
        throw new Error("La publicación ya no está activa.");
    }

    const listingUnit = String(listingBefore[config.unitField] || "").trim();

    if (listingUnit !== requestedUnit) {
        throw new Error(
            `La unidad solicitada (${requestedUnit}) no coincide con la unidad publicada (${listingUnit}).`
        );
    }

    const realAvailableBefore = await getRealAvailableForListing({
        listingType: bid.listingType,
        bidField: config.bidField,
        listingId,
        publishedQuantity: listingBefore[config.quantityField],
    });

    if (realAvailableBefore < requestedQuantity) {
        throw new Error(
            `No hay disponibilidad suficiente. Disponible real: ${realAvailableBefore} ${listingUnit}. Solicitado: ${requestedQuantity} ${requestedUnit}.`
        );
    }

    const realAvailableAfter = Math.max(realAvailableBefore - requestedQuantity, 0);

    if (realAvailableAfter <= 0) {
        const updatedListing = await config.Model.findByIdAndUpdate(
            listingId,
            { $set: { status: config.emptyStatus } },
            { new: true, runValidators: true }
        );

        return updatedListing;
    }

    return listingBefore;
};

const rejectOtherPendingBidsIfSoldOut = async (acceptedBid, updatedListing) => {
    const config = getListingConfigFromBid(acceptedBid);

    if (!config || !updatedListing) return;

    const listingId = getListingIdFromBid(acceptedBid, config);

    if (!listingId) return;

    const realAvailable = await getRealAvailableForListing({
        listingType: acceptedBid.listingType,
        bidField: config.bidField,
        listingId,
        publishedQuantity: updatedListing[config.quantityField],
    });

    if (realAvailable > 0) return;

    const filter = {
        _id: { $ne: acceptedBid._id },
        listingType: acceptedBid.listingType,
        status: { $in: ["pending", "countered"] },
    };

    if (acceptedBid.listingType === "goods") {
        filter.goodsOffer = listingId;
    }

    if (acceptedBid.listingType === "space") {
        filter.spaceOffer = listingId;
    }

    if (acceptedBid.listingType === "seat") {
        filter.seatOffer = listingId;
    }

    await OfferBid.updateMany(filter, {
        $set: {
            status: "rejected",
            counterMessage: "La publicación ya no tiene disponibilidad.",
        },
    });
};

module.exports.createGoodsOffer = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const offer = await GoodsOffer.create({
            driver: req.captain._id,
            productName: req.body.productName,
            quantityAvailable: Number(req.body.quantityAvailable),
            quantityUnit: req.body.quantityUnit,
            suggestedPrice: Number(req.body.suggestedPrice),
            priceType: req.body.priceType,
            origin: req.body.origin,
            destination: req.body.destination,
            departureTime: req.body.departureTime || null,
            vehicleType: req.body.vehicleType || null,
            description: req.body.description || "",
            notes: req.body.notes || "",
            isNegotiable:
                typeof req.body.isNegotiable === "boolean"
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json({
            offer: attachGoodsComputedFields(offer),
        });
    } catch (error) {
        console.error("Error creating goods offer:", error);

        return res.status(500).json({
            message: error?.message || "Error creando oferta de mercancía.",
        });
    }
};

module.exports.listGoodsOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: "i" };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: "i" };
        }

        filter.status = req.query.status || "active";

        const offers = await GoodsOffer.find(filter)
            .populate("driver", "fullname vehicle")
            .sort({ createdAt: -1 });

        const salesMap = await buildSalesMap({
            listingType: "goods",
            fieldName: "goodsOffer",
            offerIds: offers.map((offer) => offer._id),
        });

        let computedOffers = offers.map((offer) =>
            attachGoodsComputedFields(offer, salesMap[String(offer._id)])
        );

        computedOffers = filterAvailableOnly(computedOffers, req);

        return res.status(200).json({
            offers: computedOffers,
        });
    } catch (error) {
        console.error("Error listing goods offers:", error);

        return res.status(500).json({
            message: error?.message || "Error listando ofertas de mercancía.",
        });
    }
};

module.exports.createSpaceOffer = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const offer = await SpaceOffer.create({
            driver: req.captain._id,
            capacityAvailable: Number(req.body.capacityAvailable),
            capacityUnit: req.body.capacityUnit,
            cargoType: req.body.cargoType || "",
            suggestedPrice: Number(req.body.suggestedPrice),
            priceType: req.body.priceType,
            origin: req.body.origin,
            destination: req.body.destination,
            departureTime: req.body.departureTime || null,
            vehicleType: req.body.vehicleType || null,
            description: req.body.description || "",
            notes: req.body.notes || "",
            isNegotiable:
                typeof req.body.isNegotiable === "boolean"
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json({
            offer: attachSpaceComputedFields(offer),
        });
    } catch (error) {
        console.error("Error creating space offer:", error);

        return res.status(500).json({
            message: error?.message || "Error creando oferta de espacio.",
        });
    }
};

module.exports.listSpaceOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: "i" };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: "i" };
        }

        filter.status = req.query.status || "active";

        const offers = await SpaceOffer.find(filter)
            .populate("driver", "fullname vehicle")
            .sort({ createdAt: -1 });

        const salesMap = await buildSalesMap({
            listingType: "space",
            fieldName: "spaceOffer",
            offerIds: offers.map((offer) => offer._id),
        });

        let computedOffers = offers.map((offer) =>
            attachSpaceComputedFields(offer, salesMap[String(offer._id)])
        );

        computedOffers = filterAvailableOnly(computedOffers, req);

        return res.status(200).json({
            offers: computedOffers,
        });
    } catch (error) {
        console.error("Error listing space offers:", error);

        return res.status(500).json({
            message: error?.message || "Error listando ofertas de espacio.",
        });
    }
};

module.exports.createSeatOffer = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const offer = await SeatOffer.create({
            driver: req.captain._id,
            seatsAvailable: Number(req.body.seatsAvailable),
            seatUnit: req.body.seatUnit || "cupos",
            suggestedPrice: Number(req.body.suggestedPrice),
            origin: req.body.origin,
            stops: Array.isArray(req.body.stops) ? req.body.stops : [],
            destination: req.body.destination,
            departureTime: req.body.departureTime || null,
            vehicleType: req.body.vehicleType || null,
            description: req.body.description || "",
            notes: req.body.notes || "",
            isNegotiable:
                typeof req.body.isNegotiable === "boolean"
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json({
            offer: attachSeatComputedFields(offer),
        });
    } catch (error) {
        console.error("Error creating seat offer:", error);

        return res.status(500).json({
            message: error?.message || "Error creando oferta de cupos.",
        });
    }
};

module.exports.listSeatOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: "i" };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: "i" };
        }

        filter.status = req.query.status || "active";

        const offers = await SeatOffer.find(filter)
            .populate("driver", "fullname vehicle")
            .sort({ createdAt: -1 });

        const salesMap = await buildSalesMap({
            listingType: "seat",
            fieldName: "seatOffer",
            offerIds: offers.map((offer) => offer._id),
        });

        let computedOffers = offers.map((offer) =>
            attachSeatComputedFields(offer, salesMap[String(offer._id)])
        );

        computedOffers = filterAvailableOnly(computedOffers, req);

        return res.status(200).json({
            offers: computedOffers,
        });
    } catch (error) {
        console.error("Error listing seat offers:", error);

        return res.status(500).json({
            message: error?.message || "Error listando ofertas de cupos.",
        });
    }
};

module.exports.createBid = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            listingType,
            listingId,
            requestedQuantity,
            requestedUnit,
            offeredPrice,
            message,
        } = req.body;

        const requestedQty = normalizeNumber(requestedQuantity);
        const offered = normalizeNumber(offeredPrice);

        if (!["goods", "space", "seat"].includes(listingType)) {
            return res.status(400).json({
                message: "Tipo de publicación inválido.",
            });
        }

        if (requestedQty <= 0) {
            return res.status(400).json({
                message: "La cantidad solicitada debe ser mayor que cero.",
            });
        }

        if (offered <= 0) {
            return res.status(400).json({
                message: "El valor ofrecido debe ser mayor que cero.",
            });
        }

        let listing = null;
        let bidField = "";
        let quantityField = "";
        let unitField = "";

        if (listingType === "goods") {
            listing = await GoodsOffer.findById(listingId);
            bidField = "goodsOffer";
            quantityField = "quantityAvailable";
            unitField = "quantityUnit";
        }

        if (listingType === "space") {
            listing = await SpaceOffer.findById(listingId);
            bidField = "spaceOffer";
            quantityField = "capacityAvailable";
            unitField = "capacityUnit";
        }

        if (listingType === "seat") {
            listing = await SeatOffer.findById(listingId);
            bidField = "seatOffer";
            quantityField = "seatsAvailable";
            unitField = "seatUnit";
        }

        if (!listing) {
            return res.status(404).json({
                message: "Publicación no encontrada.",
            });
        }

        if (listing.status !== "active") {
            return res.status(400).json({
                message: "Esta publicación no está activa.",
            });
        }

        if (String(requestedUnit) !== String(listing[unitField])) {
            return res.status(400).json({
                message: `Debes ofertar en la misma unidad publicada: ${listing[unitField]}.`,
            });
        }

        const realAvailable = await getRealAvailableForListing({
            listingType,
            bidField,
            listingId: listing._id,
            publishedQuantity: listing[quantityField],
        });

        if (requestedQty > realAvailable) {
            return res.status(400).json({
                message: `No hay suficiente disponibilidad. Disponible real: ${realAvailable} ${listing[unitField]}.`,
            });
        }

        const bidPayload = {
            listingType,
            customer: req.user._id,
            driver: listing.driver,
            requestedQuantity: requestedQty,
            requestedUnit,
            offeredPrice: offered,
            message: message || "",
            [bidField]: listing._id,
        };

        const bid = await OfferBid.create(bidPayload);

        await notifyCaptainNewBid(bid._id);

        return res.status(201).json({
            bid,
            message: "Solicitud enviada correctamente.",
        });
    } catch (error) {
        console.error("Error creating bid:", error);

        return res.status(500).json({
            message: error?.message || "Error creando solicitud.",
        });
    }
};

module.exports.respondToBid = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { bidId, action, counterPrice, counterMessage } = req.body;

        const bid = await OfferBid.findById(bidId);

        if (!bid) {
            return res.status(404).json({
                message: "Oferta no encontrada.",
            });
        }

        if (String(bid.driver) !== String(req.captain._id)) {
            return res.status(403).json({
                message: "No tienes autorización para responder esta oferta.",
            });
        }

        if (!["pending", "countered"].includes(bid.status)) {
            return res.status(400).json({
                message: "Esta oferta ya fue respondida anteriormente.",
            });
        }

        let updatedListing = null;
        let finalAction = action;

        if (action === "accepted") {
            updatedListing = await discountAvailabilityForBid(bid);
            bid.status = "accepted";
            await bid.save();
            await rejectOtherPendingBidsIfSoldOut(bid, updatedListing);
        } else if (action === "rejected") {
            bid.status = "rejected";
            await bid.save();
        } else if (action === "countered") {
            const counter = normalizeNumber(counterPrice);

            if (counter <= 0) {
                return res.status(400).json({
                    message: "La contraoferta debe tener un precio mayor que cero.",
                });
            }

            bid.status = "countered";
            bid.counterPrice = counter;
            bid.counterMessage = counterMessage || "";
            await bid.save();
        } else {
            return res.status(400).json({
                message: "Acción inválida.",
            });
        }

        await notifyUserBidUpdated(bid._id, finalAction);

        const populatedBid = await OfferBid.findById(bid._id)
            .populate("customer", "fullname email")
            .populate("driver", "fullname vehicle")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer");

        return res.status(200).json({
            bid: populatedBid,
            listing: updatedListing,
            message:
                action === "accepted"
                    ? "Oferta aceptada. La disponibilidad real fue actualizada correctamente."
                    : action === "rejected"
                    ? "Oferta rechazada correctamente."
                    : "Contraoferta enviada correctamente.",
        });
    } catch (error) {
        console.error("Error responding to bid:", error);

        return res.status(500).json({
            message: error?.message || "Error respondiendo la oferta.",
        });
    }
};

module.exports.customerRespondToBid = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { bidId, action } = req.body;

        const bid = await OfferBid.findById(bidId);

        if (!bid) {
            return res.status(404).json({
                message: "Oferta no encontrada.",
            });
        }

        if (String(bid.customer) !== String(req.user._id)) {
            return res.status(403).json({
                message: "No tienes autorización para responder esta contraoferta.",
            });
        }

        if (bid.status !== "countered") {
            return res.status(400).json({
                message: "Esta oferta no tiene una contraoferta activa.",
            });
        }

        let updatedListing = null;

        if (action === "accepted") {
            updatedListing = await discountAvailabilityForBid(bid);
            bid.status = "accepted";
            await bid.save();
            await rejectOtherPendingBidsIfSoldOut(bid, updatedListing);
        } else if (action === "rejected") {
            bid.status = "rejected";
            await bid.save();
        } else {
            return res.status(400).json({
                message: "Acción inválida.",
            });
        }

        await notifyCaptainCustomerCounterResponse(bid._id, action);

        const populatedBid = await OfferBid.findById(bid._id)
            .populate("customer", "fullname email")
            .populate("driver", "fullname vehicle")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer");

        return res.status(200).json({
            bid: populatedBid,
            listing: updatedListing,
            message:
                action === "accepted"
                    ? "Contraoferta aceptada. La disponibilidad real fue actualizada correctamente."
                    : "Contraoferta rechazada correctamente.",
        });
    } catch (error) {
        console.error("Error responding to counteroffer:", error);

        return res.status(500).json({
            message: error?.message || "Error respondiendo la contraoferta.",
        });
    }
};

module.exports.getMyReceivedBids = async (req, res) => {
    try {
        const bids = await OfferBid.find({ driver: req.captain._id })
            .populate("customer", "fullname email")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer")
            .sort({ createdAt: -1 });

        return res.status(200).json({ bids });
    } catch (error) {
        console.error("Error fetching received bids:", error);

        return res.status(500).json({
            message: error?.message || "Error consultando solicitudes recibidas.",
        });
    }
};

module.exports.getMySentBids = async (req, res) => {
    try {
        const bids = await OfferBid.find({ customer: req.user._id })
            .populate("driver", "fullname vehicle")
            .populate("goodsOffer")
            .populate("spaceOffer")
            .populate("seatOffer")
            .sort({ createdAt: -1 });

        return res.status(200).json({ bids });
    } catch (error) {
        console.error("Error fetching sent bids:", error);

        return res.status(500).json({
            message: error?.message || "Error consultando solicitudes enviadas.",
        });
    }
};