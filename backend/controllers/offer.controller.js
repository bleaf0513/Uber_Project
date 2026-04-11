const { validationResult } = require('express-validator');
const GoodsOffer = require('../models/goodsOffer.model');
const SpaceOffer = require('../models/spaceOffer.model');
const SeatOffer = require('../models/seatOffer.model');
const OfferBid = require('../models/offerBid.model');

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
            description: req.body.description || '',
            notes: req.body.notes || '',
            isNegotiable:
                typeof req.body.isNegotiable === 'boolean'
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json(offer);
    } catch (error) {
        console.error('Error creating goods offer:', error);
        return res.status(500).json({ message: 'Error creating goods offer.' });
    }
};

module.exports.listGoodsOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: 'i' };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: 'i' };
        }

        filter.status = req.query.status || 'active';

        const offers = await GoodsOffer.find(filter)
            .populate('driver', 'fullname vehicle')
            .sort({ createdAt: -1 });

        return res.status(200).json({ offers });
    } catch (error) {
        console.error('Error listing goods offers:', error);
        return res.status(500).json({ message: 'Error listing goods offers.' });
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
            cargoType: req.body.cargoType || '',
            suggestedPrice: req.body.suggestedPrice,
            priceType: req.body.priceType,
            origin: req.body.origin,
            destination: req.body.destination,
            departureTime: req.body.departureTime || null,
            vehicleType: req.body.vehicleType || null,
            description: req.body.description || '',
            notes: req.body.notes || '',
            isNegotiable:
                typeof req.body.isNegotiable === 'boolean'
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json(offer);
    } catch (error) {
        console.error('Error creating space offer:', error);
        return res.status(500).json({ message: 'Error creating space offer.' });
    }
};

module.exports.listSpaceOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: 'i' };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: 'i' };
        }

        filter.status = req.query.status || 'active';

        const offers = await SpaceOffer.find(filter)
            .populate('driver', 'fullname vehicle')
            .sort({ createdAt: -1 });

        return res.status(200).json({ offers });
    } catch (error) {
        console.error('Error listing space offers:', error);
        return res.status(500).json({ message: 'Error listing space offers.' });
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
            seatUnit: req.body.seatUnit || 'cupos',
            suggestedPrice: req.body.suggestedPrice,
            origin: req.body.origin,
            stops: Array.isArray(req.body.stops) ? req.body.stops : [],
            destination: req.body.destination,
            departureTime: req.body.departureTime || null,
            vehicleType: req.body.vehicleType || null,
            description: req.body.description || '',
            notes: req.body.notes || '',
            isNegotiable:
                typeof req.body.isNegotiable === 'boolean'
                    ? req.body.isNegotiable
                    : true,
        });

        return res.status(201).json(offer);
    } catch (error) {
        console.error('Error creating seat offer:', error);
        return res.status(500).json({ message: 'Error creating seat offer.' });
    }
};

module.exports.listSeatOffers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.origin) {
            filter.origin = { $regex: req.query.origin, $options: 'i' };
        }

        if (req.query.destination) {
            filter.destination = { $regex: req.query.destination, $options: 'i' };
        }

        filter.status = req.query.status || 'active';

        const offers = await SeatOffer.find(filter)
            .populate('driver', 'fullname vehicle')
            .sort({ createdAt: -1 });

        return res.status(200).json({ offers });
    } catch (error) {
        console.error('Error listing seat offers:', error);
        return res.status(500).json({ message: 'Error listing seat offers.' });
    }
};

module.exports.createBid = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { listingType, listingId, requestedQuantity, requestedUnit, offeredPrice, message } = req.body;

        let listing = null;
        let bidPayload = {
            listingType,
            customer: req.user._id,
            requestedQuantity,
            requestedUnit,
            offeredPrice,
            message: message || '',
        };

        if (listingType === 'goods') {
            listing = await GoodsOffer.findById(listingId);
            if (!listing) {
                return res.status(404).json({ message: 'Goods offer not found.' });
            }
            bidPayload.goodsOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        if (listingType === 'space') {
            listing = await SpaceOffer.findById(listingId);
            if (!listing) {
                return res.status(404).json({ message: 'Space offer not found.' });
            }
            bidPayload.spaceOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        if (listingType === 'seat') {
            listing = await SeatOffer.findById(listingId);
            if (!listing) {
                return res.status(404).json({ message: 'Seat offer not found.' });
            }
            bidPayload.seatOffer = listing._id;
            bidPayload.driver = listing.driver;
        }

        const bid = await OfferBid.create(bidPayload);

        return res.status(201).json(bid);
    } catch (error) {
        console.error('Error creating bid:', error);
        return res.status(500).json({ message: 'Error creating bid.' });
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
            return res.status(404).json({ message: 'Bid not found.' });
        }

        if (String(bid.driver) !== String(req.captain._id)) {
            return res.status(403).json({ message: 'Not authorized to respond to this bid.' });
        }

        if (action === 'accepted') {
            bid.status = 'accepted';
        } else if (action === 'rejected') {
            bid.status = 'rejected';
        } else if (action === 'countered') {
            bid.status = 'countered';
            bid.counterPrice = counterPrice ?? null;
            bid.counterMessage = counterMessage || '';
        }

        await bid.save();

        return res.status(200).json(bid);
    } catch (error) {
        console.error('Error responding to bid:', error);
        return res.status(500).json({ message: 'Error responding to bid.' });
    }
};

module.exports.getMyReceivedBids = async (req, res) => {
    try {
        const bids = await OfferBid.find({ driver: req.captain._id })
            .populate('customer', 'fullname email')
            .populate('goodsOffer')
            .populate('spaceOffer')
            .populate('seatOffer')
            .sort({ createdAt: -1 });

        return res.status(200).json({ bids });
    } catch (error) {
        console.error('Error fetching received bids:', error);
        return res.status(500).json({ message: 'Error fetching received bids.' });
    }
};

module.exports.getMySentBids = async (req, res) => {
    try {
        const bids = await OfferBid.find({ customer: req.user._id })
            .populate('driver', 'fullname vehicle')
            .populate('goodsOffer')
            .populate('spaceOffer')
            .populate('seatOffer')
            .sort({ createdAt: -1 });

        return res.status(200).json({ bids });
    } catch (error) {
        console.error('Error fetching sent bids:', error);
        return res.status(500).json({ message: 'Error fetching sent bids.' });
    }
};
