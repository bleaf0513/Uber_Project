const { validationResult } = require("express-validator");

const GoodsOffer = require("../models/goodsOffer.model");
const SpaceOffer = require("../models/spaceOffer.model");
const SeatOffer = require("../models/seatOffer.model");
const OfferBid = require("../models/offerBid.model");

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

const attachGoodsComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        availableLabel: `${normalizeNumber(obj.quantityAvailable)} ${
            obj.quantityUnit || ""
        } disponibles`,
    };
};

const attachSpaceComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        availableLabel: `${normalizeNumber(obj.capacityAvailable)} ${
            obj.capacityUnit || ""
        } disponibles`,
    };
};

const attachSeatComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: `${formatCOP(obj.suggestedPrice)} por ${
            obj.seatUnit || "cupo"
        }`,
        availableLabel: `${normalizeNumber(obj.seatsAvailable)} ${
            obj.seatUnit || "cupos"
        } disponibles`,
    };
};

const getListingConfigFromBid = (bid) => {
    if (bid.listingType === "goods") {
        return {
            Model: GoodsOffer,
            listingId: bid.goodsOffer,
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

    const availableBefore = normalizeNumber(listingBefore[config.quantityField]);

    if (availableBefore < requestedQuantity) {
        throw new Error(
            `No hay disponibilidad suficiente. Disponible actual: ${availableBefore} ${listingUnit}. Solicitado: ${requestedQuantity} ${requestedUnit}.`
        );
    }

    const updatedListing = await config.Model.findOneAndUpdate(
        {
            _id: listingId,
            status: "active",
            [config.unitField]: requestedUnit,
            [config.quantityField]: { $gte: requestedQuantity },
        },
        {
            $inc: {
                [config.quantityField]: -requestedQuantity,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!updatedListing) {
        throw new Error(
            "No se pudo descontar la disponibilidad. Puede que otro usuario haya tomado esa cantidad primero."
        );
    }

    const remaining = normalizeNumber(updatedListing[config.quantityField]);

    if (remaining <= 0) {
        updatedListing[config.quantityField] = 0;
        updatedListing.status = config.emptyStatus;
        await updatedListing.save();
    }

    return updatedListing;
};

const rejectOtherPendingBidsIfSoldOut = async (acceptedBid, updatedListing) => {
    const config = getListingConfigFromBid(acceptedBid);

    if (!config || !updatedListing) return;

    const remaining = normalizeNumber(updatedListing[config.quantityField]);

    if (remaining > 0) return;

    const filter = {
        _id: { $ne: acceptedBid._id },
        listingType: acceptedBid.listingType,
        status: { $in: ["pending", "countered"] },
    };

    if (acceptedBid.listingType === "goods") {
        filter.goodsOffer = acceptedBid.goodsOffer;
    }

    if (acceptedBid.listingType === "space") {
        filter.spaceOffer = acceptedBid.spaceOffer;
    }

    if (acceptedBid.listingType === "seat") {
        filter.seatOffer = acceptedBid.seatOffer;
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

        return res.status(200).json({
            offers: offers.map(attachGoodsComputedFields),
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

        return res.status(200).json({
            offers: offers.map(attachSpaceComputedFields),
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

        return res.status(200).json({
            offers: offers.map(attachSeatComputedFields),
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

        const bidPayload = {
            listingType,
            customer: req.user._id,
            requestedQuantity: requestedQty,
            requestedUnit,
            offeredPrice: offered,
            message: message || "",
        };

        if (listingType === "goods") {
            listing = await GoodsOffer.findById(listingId);

            if (!listing) {
                return res.status(404).json({
                    message: "Publicación de mercancía no encontrada.",
                });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de mercancía no está activa.",
                });
            }

            if (String(requestedUnit) !== String(listing.quantityUnit)) {
                return res.status(400).json({
                    message: `Debes ofertar en la misma unidad publicada: ${listing.quantityUnit}.`,
                });
            }

            if (requestedQty > normalizeNumber(listing.quantityAvailable)) {
                return res.status(400).json({
                    message: `No hay suficiente mercancía disponible. Disponible: ${listing.quantityAvailable} ${listing.quantityUnit}.`,
                });
            }

            bidPayload.goodsOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        if (listingType === "space") {
            listing = await SpaceOffer.findById(listingId);

            if (!listing) {
                return res.status(404).json({
                    message: "Publicación de espacio no encontrada.",
                });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de espacio no está activa.",
                });
            }

            if (String(requestedUnit) !== String(listing.capacityUnit)) {
                return res.status(400).json({
                    message: `Debes ofertar en la misma unidad publicada: ${listing.capacityUnit}.`,
                });
            }

            if (requestedQty > normalizeNumber(listing.capacityAvailable)) {
                return res.status(400).json({
                    message: `No hay suficiente espacio disponible. Disponible: ${listing.capacityAvailable} ${listing.capacityUnit}.`,
                });
            }

            bidPayload.spaceOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        if (listingType === "seat") {
            listing = await SeatOffer.findById(listingId);

            if (!listing) {
                return res.status(404).json({
                    message: "Publicación de cupos no encontrada.",
                });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de cupos no está activa.",
                });
            }

            if (String(requestedUnit) !== String(listing.seatUnit)) {
                return res.status(400).json({
                    message: `Debes ofertar en la misma unidad publicada: ${listing.seatUnit}.`,
                });
            }

            if (requestedQty > normalizeNumber(listing.seatsAvailable)) {
                return res.status(400).json({
                    message: `No hay suficientes cupos disponibles. Disponible: ${listing.seatsAvailable} ${listing.seatUnit}.`,
                });
            }

            bidPayload.seatOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        const bid = await OfferBid.create(bidPayload);

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

        if (action === "accepted") {
            updatedListing = await discountAvailabilityForBid(bid);
            await rejectOtherPendingBidsIfSoldOut(bid, updatedListing);
            bid.status = "accepted";
        } else if (action === "rejected") {
            bid.status = "rejected";
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
        } else {
            return res.status(400).json({
                message: "Acción inválida.",
            });
        }

        await bid.save();

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
                    ? "Oferta aceptada. La disponibilidad fue descontada correctamente."
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
            await rejectOtherPendingBidsIfSoldOut(bid, updatedListing);
            bid.status = "accepted";
        } else if (action === "rejected") {
            bid.status = "rejected";
        } else {
            return res.status(400).json({
                message: "Acción inválida.",
            });
        }

        await bid.save();

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
                    ? "Contraoferta aceptada. La disponibilidad fue descontada correctamente."
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