const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

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

const money = (value) => {
    const number = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(number);
};

const buildPriceLabel = (suggestedPrice, priceType) => {
    const label = PRICE_TYPE_LABELS[priceType] || "precio";
    return `${money(suggestedPrice)} ${label}`;
};

const normalizeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getListingModelByType = (listingType) => {
    if (listingType === "goods") return GoodsOffer;
    if (listingType === "space") return SpaceOffer;
    if (listingType === "seat") return SeatOffer;
    return null;
};

const getListingQuantityInfo = (listingType, listing) => {
    if (listingType === "goods") {
        return {
            availableField: "quantityAvailable",
            unitField: "quantityUnit",
            available: normalizeNumber(listing.quantityAvailable),
            unit: listing.quantityUnit,
            emptyStatus: "sold_out",
        };
    }

    if (listingType === "space") {
        return {
            availableField: "capacityAvailable",
            unitField: "capacityUnit",
            available: normalizeNumber(listing.capacityAvailable),
            unit: listing.capacityUnit,
            emptyStatus: "reserved",
        };
    }

    if (listingType === "seat") {
        return {
            availableField: "seatsAvailable",
            unitField: "seatUnit",
            available: normalizeNumber(listing.seatsAvailable),
            unit: listing.seatUnit,
            emptyStatus: "full",
        };
    }

    return null;
};

const attachGoodsComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        availableLabel: `${obj.quantityAvailable} ${obj.quantityUnit} disponibles`,
        offerInstruction: `Oferta por cantidad en ${obj.quantityUnit}. Precio publicado: ${buildPriceLabel(
            obj.suggestedPrice,
            obj.priceType
        )}. Disponible: ${obj.quantityAvailable} ${obj.quantityUnit}.`,
    };
};

const attachSpaceComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: buildPriceLabel(obj.suggestedPrice, obj.priceType),
        availableLabel: `${obj.capacityAvailable} ${obj.capacityUnit} disponibles`,
        offerInstruction: `Oferta por capacidad en ${obj.capacityUnit}. Precio publicado: ${buildPriceLabel(
            obj.suggestedPrice,
            obj.priceType
        )}. Disponible: ${obj.capacityAvailable} ${obj.capacityUnit}.`,
    };
};

const attachSeatComputedFields = (offer) => {
    const obj = typeof offer.toObject === "function" ? offer.toObject() : offer;

    return {
        ...obj,
        priceLabel: `${money(obj.suggestedPrice)} por ${obj.seatUnit || "cupo"}`,
        availableLabel: `${obj.seatsAvailable} ${obj.seatUnit || "cupos"} disponibles`,
        offerInstruction: `Oferta por cantidad de ${obj.seatUnit || "cupos"}. Precio publicado: ${money(
            obj.suggestedPrice
        )} por ${obj.seatUnit || "cupo"}. Disponible: ${obj.seatsAvailable} ${
            obj.seatUnit || "cupos"
        }.`,
    };
};

const getBidListingFilter = (bid) => {
    if (bid.listingType === "goods") return { _id: bid.goodsOffer };
    if (bid.listingType === "space") return { _id: bid.spaceOffer };
    if (bid.listingType === "seat") return { _id: bid.seatOffer };
    return null;
};

const markOtherPendingBidsAsRejectedIfEmpty = async (bid, session) => {
    const filter = {
        _id: { $ne: bid._id },
        status: "pending",
        listingType: bid.listingType,
    };

    if (bid.listingType === "goods") filter.goodsOffer = bid.goodsOffer;
    if (bid.listingType === "space") filter.spaceOffer = bid.spaceOffer;
    if (bid.listingType === "seat") filter.seatOffer = bid.seatOffer;

    await OfferBid.updateMany(
        filter,
        {
            $set: {
                status: "rejected",
                counterMessage:
                    "La publicación ya no tiene disponibilidad suficiente.",
            },
        },
        { session }
    );
};

const discountListingAvailability = async ({ bid, session }) => {
    const ListingModel = getListingModelByType(bid.listingType);
    if (!ListingModel) {
        throw new Error("Tipo de publicación inválido.");
    }

    const listingFilter = getBidListingFilter(bid);
    if (!listingFilter) {
        throw new Error("No se pudo identificar la publicación.");
    }

    const listing = await ListingModel.findOne(listingFilter).session(session);

    if (!listing) {
        throw new Error("La publicación ya no existe.");
    }

    if (listing.status !== "active") {
        throw new Error("La publicación no está activa.");
    }

    const quantityInfo = getListingQuantityInfo(bid.listingType, listing);

    if (!quantityInfo) {
        throw new Error("No se pudo validar la disponibilidad.");
    }

    const requestedQuantity = normalizeNumber(bid.requestedQuantity);

    if (requestedQuantity <= 0) {
        throw new Error("La cantidad solicitada debe ser mayor a cero.");
    }

    if (quantityInfo.unit !== bid.requestedUnit) {
        throw new Error(
            `La unidad de la propuesta (${bid.requestedUnit}) no coincide con la unidad disponible (${quantityInfo.unit}).`
        );
    }

    if (quantityInfo.available < requestedQuantity) {
        throw new Error(
            `No hay disponibilidad suficiente. Disponible: ${quantityInfo.available} ${quantityInfo.unit}. Solicitado: ${requestedQuantity} ${bid.requestedUnit}.`
        );
    }

    const newAvailable = quantityInfo.available - requestedQuantity;

    listing[quantityInfo.availableField] = newAvailable;

    if (newAvailable <= 0) {
        listing.status = quantityInfo.emptyStatus;
        await markOtherPendingBidsAsRejectedIfEmpty(bid, session);
    }

    await listing.save({ session });

    return listing;
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
            quantityAvailable: req.body.quantityAvailable,
            quantityUnit: req.body.quantityUnit,
            suggestedPrice: req.body.suggestedPrice,
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
            message: error?.message || "Error creating goods offer.",
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
            message: error?.message || "Error listing goods offers.",
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
            capacityAvailable: req.body.capacityAvailable,
            capacityUnit: req.body.capacityUnit,
            cargoType: req.body.cargoType || "",
            suggestedPrice: req.body.suggestedPrice,
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
            message: error?.message || "Error creating space offer.",
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
            message: error?.message || "Error listing space offers.",
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
            seatsAvailable: req.body.seatsAvailable,
            seatUnit: req.body.seatUnit || "cupos",
            suggestedPrice: req.body.suggestedPrice,
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
            message: error?.message || "Error creating seat offer.",
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
            message: error?.message || "Error listing seat offers.",
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

        if (requestedQty <= 0) {
            return res.status(400).json({
                message: "La cantidad solicitada debe ser mayor a cero.",
            });
        }

        let listing = null;

        const bidPayload = {
            listingType,
            customer: req.user._id,
            requestedQuantity: requestedQty,
            requestedUnit,
            offeredPrice,
            message: message || "",
        };

        if (listingType === "goods") {
            listing = await GoodsOffer.findById(listingId);
            if (!listing) {
                return res.status(404).json({ message: "Publicación de mercancía no encontrada." });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de mercancía no está activa.",
                });
            }

            if (requestedUnit !== listing.quantityUnit) {
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
                return res.status(404).json({ message: "Publicación de espacio no encontrada." });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de espacio no está activa.",
                });
            }

            if (requestedUnit !== listing.capacityUnit) {
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
                return res.status(404).json({ message: "Publicación de cupos no encontrada." });
            }

            if (listing.status !== "active") {
                return res.status(400).json({
                    message: "Esta publicación de cupos no está activa.",
                });
            }

            if (requestedUnit !== listing.seatUnit) {
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
            message: "Propuesta enviada correctamente.",
        });
    } catch (error) {
        console.error("Error creating bid:", error);
        return res.status(500).json({
            message: error?.message || "Error creating bid.",
        });
    }
};

module.exports.respondToBid = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            session.endSession();
            return res.status(400).json({ errors: errors.array() });
        }

        const { bidId, action, counterPrice, counterMessage } = req.body;

        let updatedBid = null;
        let updatedListing = null;

        await session.withTransaction(async () => {
            const bid = await OfferBid.findById(bidId).session(session);

            if (!bid) {
                throw new Error("Propuesta no encontrada.");
            }

            if (String(bid.driver) !== String(req.captain._id)) {
                const error = new Error("No tienes autorización para responder esta propuesta.");
                error.statusCode = 403;
                throw error;
            }

            if (!["pending", "countered"].includes(bid.status)) {
                const error = new Error("Esta propuesta ya fue respondida.");
                error.statusCode = 400;
                throw error;
            }

            if (action === "accepted") {
                updatedListing = await discountListingAvailability({ bid, session });
                bid.status = "accepted";
            } else if (action === "rejected") {
                bid.status = "rejected";
            } else if (action === "countered") {
                if (normalizeNumber(counterPrice) <= 0) {
                    const error = new Error("La contraoferta debe tener un precio mayor a cero.");
                    error.statusCode = 400;
                    throw error;
                }

                bid.status = "countered";
                bid.counterPrice = normalizeNumber(counterPrice);
                bid.counterMessage = counterMessage || "";
            }

            await bid.save({ session });
            updatedBid = bid;
        });

        session.endSession();

        const populatedBid = await OfferBid.findById(updatedBid._id)
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
                    ? "Propuesta aceptada. La disponibilidad fue descontada correctamente."
                    : action === "rejected"
                    ? "Propuesta rechazada correctamente."
                    : "Contraoferta enviada correctamente.",
        });
    } catch (error) {
        session.endSession();

        console.error("Error responding to bid:", error);

        return res.status(error.statusCode || 500).json({
            message: error?.message || "Error responding to bid.",
        });
    }
};

module.exports.customerRespondToBid = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            session.endSession();
            return res.status(400).json({ errors: errors.array() });
        }

        const { bidId, action } = req.body;

        let updatedBid = null;
        let updatedListing = null;

        await session.withTransaction(async () => {
            const bid = await OfferBid.findById(bidId).session(session);

            if (!bid) {
                throw new Error("Propuesta no encontrada.");
            }

            if (String(bid.customer) !== String(req.user._id)) {
                const error = new Error("No tienes autorización para responder esta contraoferta.");
                error.statusCode = 403;
                throw error;
            }

            if (bid.status !== "countered") {
                const error = new Error("Esta propuesta no tiene una contraoferta activa.");
                error.statusCode = 400;
                throw error;
            }

            if (action === "accepted") {
                updatedListing = await discountListingAvailability({ bid, session });
                bid.status = "accepted";
            } else if (action === "rejected") {
                bid.status = "rejected";
            }

            await bid.save({ session });
            updatedBid = bid;
        });

        session.endSession();

        const populatedBid = await OfferBid.findById(updatedBid._id)
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
        session.endSession();

        console.error("Error responding to counteroffer:", error);

        return res.status(error.statusCode || 500).json({
            message: error?.message || "Error responding to counteroffer.",
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
            message: error?.message || "Error fetching received bids.",
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
            message: error?.message || "Error fetching sent bids.",
        });
    }
};