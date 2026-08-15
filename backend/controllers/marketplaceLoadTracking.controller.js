const mongoose = require("mongoose");

const MarketplaceLoadTracking = require(
    "../models/marketplaceLoadTracking.model"
);

const MarketplaceLoadRoutePoint = require(
    "../models/marketplaceLoadRoutePoint.model"
);

const SpaceOffer = require(
    "../models/spaceOffer.model"
);

const OfferBid = require(
    "../models/offerBid.model"
);

/*
 * =========================================================
 * CONFIGURACIÓN
 * =========================================================
 */

const MIN_DISTANCE_METERS = 30;

const ALLOWED_CAPTAIN_STATUSES = [
    "confirmed",
    "driver_heading_to_pickup",
    "picked_up",
    "in_transit",
    "delivered",
];

const TERMINAL_STATUSES = [
    "completed",
    "cancelled",
];

const CAPTAIN_STATUS_FLOW = [
    "confirmed",
    "driver_heading_to_pickup",
    "picked_up",
    "in_transit",
    "delivered",
];

const getNextCaptainStatus = (currentStatus) => {
    if (
        currentStatus === "pending_confirmation" ||
        currentStatus === "awaiting_reservation"
    ) {
        return "confirmed";
    }

    const legacyStatusMap = {
        arrived_at_pickup: "picked_up",
        loading: "picked_up",
        near_destination: "delivered",
        arrived_at_destination: "delivered",
        unloading: "delivered",
    };

    if (legacyStatusMap[currentStatus]) {
        return legacyStatusMap[currentStatus];
    }

    const currentIndex =
        CAPTAIN_STATUS_FLOW.indexOf(
            currentStatus
        );

    if (
        currentIndex < 0 ||
        currentIndex >=
            CAPTAIN_STATUS_FLOW.length - 1
    ) {
        return null;
    }

    return CAPTAIN_STATUS_FLOW[
        currentIndex + 1
    ];
};

const STATUS_DATE_FIELDS = {
    confirmed: "confirmedAt",

    driver_heading_to_pickup:
        "driverStartedHeadingAt",

    arrived_at_pickup:
        "arrivedAtPickupAt",

    loading:
        "loadingStartedAt",

    picked_up:
        "pickedUpAt",

    in_transit:
        "inTransitAt",

    near_destination:
        "nearDestinationAt",

    arrived_at_destination:
        "arrivedAtDestinationAt",

    unloading:
        "unloadingStartedAt",

    delivered:
        "deliveredAt",

    completed:
        "completedAt",

    cancelled:
        "cancelledAt",
};

/*
 * =========================================================
 * UTILIDADES
 * =========================================================
 */

const normalizeNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
};

const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(
        String(value || "")
    );
};

const isValidCoordinate = (lat, lng) => {
    const numericLat = normalizeNumber(lat);
    const numericLng = normalizeNumber(lng);

    if (
        numericLat === null ||
        numericLng === null
    ) {
        return false;
    }

    return (
        numericLat >= -90 &&
        numericLat <= 90 &&
        numericLng >= -180 &&
        numericLng <= 180
    );
};

const toRadians = (degrees) => {
    return (
        Number(degrees) *
        Math.PI /
        180
    );
};

const haversineDistanceMeters = (
    first,
    second
) => {
    if (
        !first ||
        !second ||
        !isValidCoordinate(
            first.lat,
            first.lng
        ) ||
        !isValidCoordinate(
            second.lat,
            second.lng
        )
    ) {
        return 0;
    }

    const earthRadiusMeters = 6371000;

    const firstLat =
        toRadians(first.lat);

    const secondLat =
        toRadians(second.lat);

    const deltaLat =
        toRadians(
            Number(second.lat) -
            Number(first.lat)
        );

    const deltaLng =
        toRadians(
            Number(second.lng) -
            Number(first.lng)
        );

    const value =
        Math.sin(deltaLat / 2) *
            Math.sin(deltaLat / 2) +
        Math.cos(firstLat) *
            Math.cos(secondLat) *
            Math.sin(deltaLng / 2) *
            Math.sin(deltaLng / 2);

    const angle =
        2 *
        Math.atan2(
            Math.sqrt(value),
            Math.sqrt(1 - value)
        );

    return earthRadiusMeters * angle;
};

const buildCaptainName = (captain) => {
    const firstName =
        captain?.fullname?.firstname || "";

    const lastName =
        captain?.fullname?.lastname || "";

    const fullName =
        `${firstName} ${lastName}`.trim();

    return fullName || "Transportador";
};

const buildCustomerName = (user) => {
    const firstName =
        user?.fullname?.firstname || "";

    const lastName =
        user?.fullname?.lastname || "";

    const fullName =
        `${firstName} ${lastName}`.trim();

    return (
        fullName ||
        user?.email ||
        "Cliente"
    );
};

const sanitizeTrackingForCustomer = (
    tracking
) => {
    if (!tracking) {
        return null;
    }

    const object =
        typeof tracking.toObject ===
        "function"
            ? tracking.toObject()
            : { ...tracking };

    delete object.pickupCode;
    delete object.deliveryCode;

    return object;
};

const getChangedByInformation = (
    req
) => {
    if (req.captain?._id) {
        return {
            changedByType: "captain",
            changedBy:
                req.captain._id,
        };
    }

    if (req.user?._id) {
        return {
            changedByType: "customer",
            changedBy:
                req.user._id,
        };
    }

    return {
        changedByType: "system",
        changedBy: null,
    };
};

const createStatusHistoryItem = ({
    status,
    changedByType,
    changedBy,
    note = "",
    location = null,
}) => {
    return {
        status,

        changedByType:
            changedByType ||
            "system",

        changedBy:
            changedBy || null,

        note:
            String(note || "")
                .trim()
                .slice(0, 500),

        location: {
            lat:
                isValidCoordinate(
                    location?.lat,
                    location?.lng
                )
                    ? Number(
                          Number(
                              location.lat
                          ).toFixed(6)
                      )
                    : null,

            lng:
                isValidCoordinate(
                    location?.lat,
                    location?.lng
                )
                    ? Number(
                          Number(
                              location.lng
                          ).toFixed(6)
                      )
                    : null,
        },

        createdAt:
            new Date(),
    };
};

/*
 * =========================================================
 * CREAR SEGUIMIENTO DESDE PROPUESTA ACEPTADA
 * =========================================================
 *
 * Esta función puede llamarse desde offer.controller.js.
 *
 * No crea duplicados porque spaceOffer y acceptedBid
 * son únicos en el modelo.
 */

const createTrackingFromAcceptedBid =
async ({
    bidId,
    trackingPlan = "basic",
}) => {
    if (!isValidObjectId(bidId)) {
        throw new Error(
            "El identificador de la propuesta no es válido."
        );
    }

    const bid =
        await OfferBid.findById(
            bidId
        );

    if (!bid) {
        throw new Error(
            "La propuesta aceptada no existe."
        );
    }

    if (
        bid.listingType !== "space"
    ) {
        throw new Error(
            "La propuesta no corresponde a una carga."
        );
    }

    if (
        bid.status !== "accepted"
    ) {
        throw new Error(
            "La propuesta todavía no está aceptada."
        );
    }

    const listing =
        await SpaceOffer.findById(
            bid.spaceOffer
        );

    if (!listing) {
        throw new Error(
            "La carga asociada ya no existe."
        );
    }

    if (
        String(listing.selectedBid || "") !==
        String(bid._id)
    ) {
        throw new Error(
            "La propuesta no es la seleccionada para esta carga."
        );
    }

    const existingTracking =
        await MarketplaceLoadTracking.findOne({
            $or: [
                {
                    spaceOffer:
                        listing._id,
                },
                {
                    acceptedBid:
                        bid._id,
                },
            ],
        });

    if (existingTracking) {
        return existingTracking;
    }

    const serviceValue =
        Number(bid.offeredPrice || 0);

    if (
        !Number.isFinite(serviceValue) ||
        serviceValue <= 0
    ) {
        throw new Error(
            "La propuesta aceptada no tiene un valor válido."
        );
    }

    const selectedPlan =
        trackingPlan === "professional"
            ? "professional"
            : "basic";

    const trackingEnabled =
        selectedPlan === "professional";

    const tracking =
        await MarketplaceLoadTracking.create({
            spaceOffer:
                listing._id,

            acceptedBid:
                bid._id,

            customer:
                bid.customer,

            captain:
                bid.driver,

            trackingPlan:
                selectedPlan,

            trackingEnabled,

            liveLocationEnabled:
                trackingEnabled,

            trackingActivatedAt:
                trackingEnabled
                    ? new Date()
                    : null,

            status:
                "pending_confirmation",

            statusUpdatedAt:
                new Date(),

            serviceValue,

            origin: {
                address:
                    listing.origin || "",

                city:
                    listing.originCity || "",

                department:
                    listing.originDepartment ||
                    "",

                lat:
                    normalizeNumber(
                        listing?.originLocation
                            ?.lat
                    ),

                lng:
                    normalizeNumber(
                        listing?.originLocation
                            ?.lng
                    ),

                placeId:
                    listing?.originLocation
                        ?.placeId ||
                    "",
            },

            destination: {
                address:
                    listing.destination || "",

                city:
                    listing.destinationCity ||
                    "",

                department:
                    listing
                        .destinationDepartment ||
                    "",

                lat:
                    normalizeNumber(
                        listing
                            ?.destinationLocation
                            ?.lat
                    ),

                lng:
                    normalizeNumber(
                        listing
                            ?.destinationLocation
                            ?.lng
                    ),

                placeId:
                    listing
                        ?.destinationLocation
                        ?.placeId ||
                    "",
            },

            vehicle: {
                type:
                    bid.proposedVehicleType ||
                    "",

                brand:
                    bid.proposedVehicleBrand ||
                    "",

                reference:
                    bid
                        .proposedVehicleReference ||
                    "",

                model:
                    bid.proposedVehicleModel ||
                    "",

                plate:
                    bid.proposedVehiclePlate ||
                    "",

                bodyType:
                    bid.proposedBodyType ||
                    "",

                capacity:
                    bid
                        .proposedVehicleCapacity ??
                    null,

                capacityUnit:
                    bid
                        .proposedVehicleCapacityUnit ||
                    "",
            },
        });

    return tracking;
};

module.exports.createTrackingFromAcceptedBid =
    createTrackingFromAcceptedBid;


/*
 * =========================================================
 * ASEGURAR SEGUIMIENTO PARA UNA CARGA YA ASIGNADA
 * =========================================================
 *
 * Permite recuperar cargas aceptadas antes de que existiera
 * la creación automática del seguimiento.
 *
 * Solo el dueño de la carga puede ejecutar esta acción.
 * No crea duplicados.
 */

module.exports.ensureTrackingForAssignedLoad =
async (req, res) => {
    try {
        const { spaceOfferId } =
            req.params;

        if (
            !isValidObjectId(
                spaceOfferId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de carga inválido.",
            });
        }

        const listing =
            await SpaceOffer.findById(
                spaceOfferId
            );

        if (!listing) {
            return res.status(404).json({
                message:
                    "Carga no encontrada.",
            });
        }

        if (
            String(listing.customer) !==
            String(req.user._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para crear el seguimiento de esta carga.",
            });
        }

        if (
            !listing.selectedBid ||
            !listing.selectedDriver
        ) {
            return res.status(400).json({
                message:
                    "La carga todavía no tiene un transportador seleccionado.",
            });
        }

        const bid =
            await OfferBid.findOne({
                _id:
                    listing.selectedBid,

                listingType:
                    "space",

                spaceOffer:
                    listing._id,

                customer:
                    req.user._id,

                driver:
                    listing.selectedDriver,

                status:
                    "accepted",
            });

        if (!bid) {
            return res.status(404).json({
                message:
                    "No se encontró la propuesta aceptada de esta carga.",
            });
        }

        const existingTracking =
            await MarketplaceLoadTracking.findOne({
                $or: [
                    {
                        spaceOffer:
                            listing._id,
                    },
                    {
                        acceptedBid:
                            bid._id,
                    },
                ],
            });

        if (existingTracking) {
            return res.status(200).json({
                tracking:
                    sanitizeTrackingForCustomer(
                        existingTracking
                    ),

                created: false,

                message:
                    "El seguimiento de esta carga ya existe.",
            });
        }

        const tracking =
            await createTrackingFromAcceptedBid({
                bidId:
                    bid._id,

                trackingPlan:
                    "basic",
            });

        return res.status(201).json({
            tracking:
                sanitizeTrackingForCustomer(
                    tracking
                ),

            created: true,

            message:
                "Seguimiento básico creado correctamente.",
        });
    } catch (error) {
        console.error(
            "ensureTrackingForAssignedLoad:",
            error
        );

        if (
            error?.code === 11000
        ) {
            const tracking =
                await MarketplaceLoadTracking.findOne({
                    spaceOffer:
                        req.params.spaceOfferId,
                });

            return res.status(200).json({
                tracking:
                    sanitizeTrackingForCustomer(
                        tracking
                    ),

                created: false,

                message:
                    "El seguimiento ya había sido creado.",
            });
        }

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo asegurar el seguimiento de la carga.",
        });
    }
};

/*
 * =========================================================
 * ACTIVAR SEGUIMIENTO PROFESIONAL
 * =========================================================
 */

module.exports.activateProfessionalTracking =
async (req, res) => {
    try {
        const { trackingId } =
            req.params;

        if (
            !isValidObjectId(
                trackingId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de seguimiento inválido.",
            });
        }

        const tracking =
            await MarketplaceLoadTracking.findById(
                trackingId
            );

        if (!tracking) {
            return res.status(404).json({
                message:
                    "Seguimiento no encontrado.",
            });
        }

        if (
            String(tracking.customer) !==
            String(req.user._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para activar este seguimiento.",
            });
        }

        if (
            TERMINAL_STATUSES.includes(
                tracking.status
            )
        ) {
            return res.status(400).json({
                message:
                    "No se puede activar el seguimiento para un servicio finalizado o cancelado.",
            });
        }

        tracking.trackingPlan =
            "professional";

        tracking.trackingEnabled =
            true;

        tracking.liveLocationEnabled =
            true;

        tracking.trackingActivatedAt =
            tracking.trackingActivatedAt ||
            new Date();

        tracking.trackingDeactivatedAt =
            null;

        await tracking.save();

        return res.status(200).json({
            tracking:
                sanitizeTrackingForCustomer(
                    tracking
                ),

            message:
                "Seguimiento profesional activado correctamente.",
        });
    } catch (error) {
        console.error(
            "activateProfessionalTracking:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo activar el seguimiento profesional.",
        });
    }
};

/*
 * =========================================================
 * ACTUALIZAR UBICACIÓN DEL CONDUCTOR
 * =========================================================
 */

module.exports.updateMarketplaceLocation =
async (req, res) => {
    try {
        const { trackingId } =
            req.params;

        if (
            !isValidObjectId(
                trackingId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de seguimiento inválido.",
            });
        }

        const {
            lat,
            lng,
            accuracy,
            heading,
            speed,
            source,
            platform,
            deviceTimestamp,
        } = req.body;

        if (
            !isValidCoordinate(
                lat,
                lng
            )
        ) {
            return res.status(400).json({
                message:
                    "Latitud y longitud válidas son obligatorias.",
            });
        }

        const tracking =
            await MarketplaceLoadTracking.findById(
                trackingId
            );

        if (!tracking) {
            return res.status(404).json({
                message:
                    "Seguimiento no encontrado.",
            });
        }

        if (
            String(tracking.captain) !==
            String(req.captain._id)
        ) {
            return res.status(403).json({
                message:
                    "No puedes actualizar la ubicación de otro conductor.",
            });
        }

        if (
            !tracking.trackingEnabled ||
            !tracking.liveLocationEnabled
        ) {
            return res.status(400).json({
                message:
                    "El seguimiento GPS todavía no está activo para este servicio.",
            });
        }

        if (
            TERMINAL_STATUSES.includes(
                tracking.status
            )
        ) {
            return res.status(400).json({
                message:
                    "El servicio ya está finalizado o cancelado.",
            });
        }

        const numericLat =
            Number(lat);

        const numericLng =
            Number(lng);

        const now =
            new Date();

        const normalizedSource = [
            "gps",
            "foreground_gps",
            "background_gps",
            "manual",
            "unknown",
        ].includes(source)
            ? source
            : "background_gps";

        const normalizedPlatform = [
            "web",
            "android",
            "ios",
            "unknown",
        ].includes(platform)
            ? platform
            : "unknown";

        const previousPoint =
            await MarketplaceLoadRoutePoint.findOne({
                tracking:
                    tracking._id,

                valid: true,
            }).sort({
                recordedAt: -1,
            });

        const distanceFromPreviousMeters =
            previousPoint
                ? haversineDistanceMeters(
                      {
                          lat:
                              previousPoint.lat,

                          lng:
                              previousPoint.lng,
                      },
                      {
                          lat:
                              numericLat,

                          lng:
                              numericLng,
                      }
                  )
                : 0;

        const shouldSavePoint =
            !previousPoint ||
            distanceFromPreviousMeters >=
                MIN_DISTANCE_METERS;

        const previousAccumulatedDistanceKm =
            Number(
                previousPoint
                    ?.accumulatedDistanceKm ||
                0
            );

        const accumulatedDistanceKm =
            previousAccumulatedDistanceKm +
            distanceFromPreviousMeters /
                1000;

        let routePoint = null;

        if (shouldSavePoint) {
            routePoint =
                await MarketplaceLoadRoutePoint.create({
                    tracking:
                        tracking._id,

                    spaceOffer:
                        tracking.spaceOffer,

                    acceptedBid:
                        tracking.acceptedBid,

                    customer:
                        tracking.customer,

                    captain:
                        tracking.captain,

                    lat:
                        numericLat,

                    lng:
                        numericLng,

                    accuracy:
                        normalizeNumber(
                            accuracy
                        ),

                    heading:
                        normalizeNumber(
                            heading
                        ),

                    speed:
                        normalizeNumber(
                            speed
                        ),

                    recordedAt:
                        now,

                    deviceTimestamp:
                        deviceTimestamp
                            ? new Date(
                                  deviceTimestamp
                              )
                            : null,

                    source:
                        normalizedSource,

                    platform:
                        normalizedPlatform,

                    distanceFromPreviousMeters:
                        Number(
                            distanceFromPreviousMeters.toFixed(
                                2
                            )
                        ),

                    accumulatedDistanceKm:
                        Number(
                            accumulatedDistanceKm.toFixed(
                                4
                            )
                        ),

                    valid: true,
                });
        }

        tracking.currentLocation = {
            lat:
                Number(
                    numericLat.toFixed(6)
                ),

            lng:
                Number(
                    numericLng.toFixed(6)
                ),

            accuracy:
                normalizeNumber(
                    accuracy
                ),

            heading:
                normalizeNumber(
                    heading
                ),

            speed:
                normalizeNumber(
                    speed
                ),

            source:
                normalizedSource,

            updatedAt:
                now,
        };

        tracking.lastLocationReceivedAt =
            now;

        await tracking.save();

        return res.status(200).json({
            success: true,

            message:
                "Ubicación actualizada correctamente.",

            trackingId:
                tracking._id,

            currentLocation:
                tracking.currentLocation,

            pointSaved:
                Boolean(routePoint),

            routePoint,

            accumulatedDistanceKm:
                shouldSavePoint
                    ? Number(
                          accumulatedDistanceKm.toFixed(
                              4
                          )
                      )
                    : previousAccumulatedDistanceKm,
        });
    } catch (error) {
        console.error(
            "updateMarketplaceLocation:",
            error
        );

        if (
            error?.code === 11000
        ) {
            return res.status(200).json({
                success: true,

                message:
                    "La ubicación ya había sido registrada.",

                pointSaved:
                    false,
            });
        }

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo actualizar la ubicación.",
        });
    }
};

/*
 * =========================================================
 * ACTUALIZAR ESTADO DEL SERVICIO
 * =========================================================
 */

module.exports.updateTrackingStatus =
async (req, res) => {
    try {
        const { trackingId } =
            req.params;

        const {
            status,
            note,
            lat,
            lng,
        } = req.body;

        if (
            !isValidObjectId(
                trackingId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de seguimiento inválido.",
            });
        }

        if (
            !ALLOWED_CAPTAIN_STATUSES.includes(
                status
            )
        ) {
            return res.status(400).json({
                message:
                    "Estado de servicio no válido.",
            });
        }

        const tracking =
            await MarketplaceLoadTracking.findById(
                trackingId
            );

        if (!tracking) {
            return res.status(404).json({
                message:
                    "Seguimiento no encontrado.",
            });
        }

        if (
            String(tracking.captain) !==
            String(req.captain._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para actualizar este servicio.",
            });
        }

        if (
            TERMINAL_STATUSES.includes(
                tracking.status
            )
        ) {
            return res.status(400).json({
                message:
                    "El servicio ya fue finalizado o cancelado.",
            });
        }

        const nextAllowedStatus =
            getNextCaptainStatus(
                tracking.status
            );

        if (!nextAllowedStatus) {
            return res.status(400).json({
                message:
                    "Este servicio no tiene un siguiente estado disponible.",
            });
        }

        if (status !== nextAllowedStatus) {
            return res.status(400).json({
                message:
                    `El siguiente estado permitido es: ${nextAllowedStatus}.`,
                currentStatus:
                    tracking.status,
                nextAllowedStatus,
            });
        }

        const changedBy =
            getChangedByInformation(
                req
            );

        tracking.status =
            status;

        tracking.statusUpdatedAt =
            new Date();

        const dateField =
            STATUS_DATE_FIELDS[status];

        if (
            dateField &&
            !tracking[dateField]
        ) {
            tracking[dateField] =
                new Date();
        }

        tracking.statusHistory.push(
            createStatusHistoryItem({
                status,

                changedByType:
                    changedBy.changedByType,

                changedBy:
                    changedBy.changedBy,

                note,

                location: {
                    lat,
                    lng,
                },
            })
        );

        await tracking.save();

        return res.status(200).json({
            tracking:
                sanitizeTrackingForCustomer(
                    tracking
                ),

            message:
                "Estado actualizado correctamente.",
        });
    } catch (error) {
        console.error(
            "updateTrackingStatus:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo actualizar el estado del servicio.",
        });
    }
};

/*
 * =========================================================
 * OBTENER SEGUIMIENTO PARA EL CLIENTE
 * =========================================================
 */

module.exports.getCustomerTracking =
async (req, res) => {
    try {
        const { trackingId } =
            req.params;

        if (
            !isValidObjectId(
                trackingId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de seguimiento inválido.",
            });
        }

        const tracking =
            await MarketplaceLoadTracking.findById(
                trackingId
            )
                .populate(
                    "spaceOffer"
                )
                .populate(
                    "acceptedBid"
                )
                .populate(
                    "customer",
                    "fullname email profileImage"
                )
                .populate(
                    "captain",
                    "fullname vehicle profileImage rating"
                );

        if (!tracking) {
            return res.status(404).json({
                message:
                    "Seguimiento no encontrado.",
            });
        }

        if (
            String(
                tracking.customer?._id ||
                tracking.customer
            ) !==
            String(req.user._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para consultar este seguimiento.",
            });
        }

        const routePoints =
            tracking.trackingEnabled
                ? await MarketplaceLoadRoutePoint.find({
                      tracking:
                          tracking._id,

                      valid: true,
                  })
                      .sort({
                          recordedAt: 1,
                      })
                      .limit(5000)
                : [];

        const lastPoint =
            routePoints.length > 0
                ? routePoints[
                      routePoints.length - 1
                  ]
                : null;

        return res.status(200).json({
            tracking:
                sanitizeTrackingForCustomer(
                    tracking
                ),

            routePoints,

            summary: {
                customerName:
                    buildCustomerName(
                        tracking.customer
                    ),

                captainName:
                    buildCaptainName(
                        tracking.captain
                    ),

                totalPoints:
                    routePoints.length,

                totalDistanceKm:
                    Number(
                        lastPoint
                            ?.accumulatedDistanceKm ||
                        0
                    ),

                lastLocationAt:
                    tracking
                        .lastLocationReceivedAt ||
                    null,
            },
        });
    } catch (error) {
        console.error(
            "getCustomerTracking:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo consultar el seguimiento.",
        });
    }
};

/*
 * =========================================================
 * OBTENER SEGUIMIENTO PARA EL CONDUCTOR
 * =========================================================
 */

module.exports.getCaptainTracking =
async (req, res) => {
    try {
        const { trackingId } =
            req.params;

        if (
            !isValidObjectId(
                trackingId
            )
        ) {
            return res.status(400).json({
                message:
                    "Identificador de seguimiento inválido.",
            });
        }

        const tracking =
            await MarketplaceLoadTracking.findById(
                trackingId
            )
                .populate(
                    "spaceOffer"
                )
                .populate(
                    "acceptedBid"
                )
                .populate(
                    "customer",
                    "fullname email profileImage"
                )
                .populate(
                    "captain",
                    "fullname vehicle profileImage rating"
                );

        if (!tracking) {
            return res.status(404).json({
                message:
                    "Seguimiento no encontrado.",
            });
        }

        if (
            String(
                tracking.captain?._id ||
                tracking.captain
            ) !==
            String(req.captain._id)
        ) {
            return res.status(403).json({
                message:
                    "No tienes autorización para consultar este seguimiento.",
            });
        }

        return res.status(200).json({
            tracking:
                sanitizeTrackingForCustomer(
                    tracking
                ),
        });
    } catch (error) {
        console.error(
            "getCaptainTracking:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudo consultar el seguimiento.",
        });
    }
};

/*
 * =========================================================
 * LISTAR SEGUIMIENTOS DEL CLIENTE
 * =========================================================
 */

module.exports.getMyCustomerTrackings =
async (req, res) => {
    try {
        const trackings =
            await MarketplaceLoadTracking.find({
                customer:
                    req.user._id,

                active: true,
            })
                .populate(
                    "spaceOffer"
                )
                .populate(
                    "acceptedBid"
                )
                .populate(
                    "captain",
                    "fullname vehicle profileImage rating"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            trackings:
                trackings.map(
                    sanitizeTrackingForCustomer
                ),
        });
    } catch (error) {
        console.error(
            "getMyCustomerTrackings:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudieron consultar tus seguimientos.",
        });
    }
};

/*
 * =========================================================
 * LISTAR SEGUIMIENTOS DEL CONDUCTOR
 * =========================================================
 */

module.exports.getMyCaptainTrackings =
async (req, res) => {
    try {
        const trackings =
            await MarketplaceLoadTracking.find({
                captain:
                    req.captain._id,

                active: true,
            })
                .populate(
                    "spaceOffer"
                )
                .populate(
                    "acceptedBid"
                )
                .populate(
                    "customer",
                    "fullname email profileImage"
                )
                .sort({
                    createdAt: -1,
                });

        return res.status(200).json({
            trackings:
                trackings.map(
                    sanitizeTrackingForCustomer
                ),
        });
    } catch (error) {
        console.error(
            "getMyCaptainTrackings:",
            error
        );

        return res.status(500).json({
            message:
                error?.message ||
                "No se pudieron consultar tus servicios asignados.",
        });
    }
};