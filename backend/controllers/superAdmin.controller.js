const SuperAdmin = require('../models/superAdmin.model');

const User = require('../models/user.model');
const Captain = require('../models/captain.model');
const Ride = require('../models/ride.model');

const Enterprise = require('../models/enterprise.model');
const EnterpriseDriver = require('../models/enterpriseDriver.model');
const EnterpriseDelivery = require('../models/enterpriseDelivery.model');

const DriverApplication = require('../models/driverApplication.model');
const WalletTransaction = require('../models/walletTransaction.model');

const {
    sendDriverApplicationApprovedEmail,
    sendDriverApplicationRejectedEmail,
} = require('../services/email.service');

const MIN_CAPTAIN_BALANCE_TO_WORK = 5000;

function getTodayRange() {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

function getCommissionPercent() {
    const raw = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10);

    if (!Number.isFinite(raw) || raw < 0) {
        return 10;
    }

    return raw;
}

function calculateCommission(value) {
    const numericValue = Number(value || 0);
    const percent = getCommissionPercent();

    return Math.round((numericValue * percent) / 100);
}

function addOneMonth(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + 1);

    return nextDate;
}

function getDaysBetween(startDate, endDate = new Date()) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getApplicationFullName(application) {
    return `${application?.fullname?.firstname || ''} ${application?.fullname?.lastname || ''}`.trim();
}

function buildCaptainResponse(captainDoc) {
    if (!captainDoc) return null;

    const captain = captainDoc.toObject ? captainDoc.toObject() : captainDoc;

    return {
        _id: captain._id,
        id: captain._id,
        fullname: captain.fullname,
        email: captain.email,
        status: captain.status,
        vehicle: captain.vehicle,
        profileImage: captain.profileImage || '',
        rating: captain.rating || 5,
        createdAt: captain.createdAt,
        updatedAt: captain.updatedAt,
    };
}

function buildCaptainWalletResponse(captainDoc) {
    if (!captainDoc) return null;

    const captain = captainDoc.toObject ? captainDoc.toObject() : captainDoc;
    const balance = Number(captain?.wallet?.balance || 0);

    return {
        _id: captain._id,
        id: captain._id,
        fullname: captain.fullname,
        email: captain.email,
        status: captain.status,
        vehicle: captain.vehicle,
        profileImage: captain.profileImage || '',
        rating: captain.rating || 5,
        wallet: {
            balance,
            currency: captain?.wallet?.currency || 'COP',
            lastMovementAt: captain?.wallet?.lastMovementAt || null,
            minBalanceToWork: MIN_CAPTAIN_BALANCE_TO_WORK,
            canWork: balance >= MIN_CAPTAIN_BALANCE_TO_WORK,
            missingToWork: Math.max(0, MIN_CAPTAIN_BALANCE_TO_WORK - balance),
        },
        createdAt: captain.createdAt,
        updatedAt: captain.updatedAt,
    };
}

function buildApplicationResponse(applicationDoc) {
    if (!applicationDoc) return null;

    const app = applicationDoc.toObject ? applicationDoc.toObject() : applicationDoc;

    return {
        _id: app._id,
        id: app._id,
        fullname: app.fullname,
        email: app.email,
        vehicle: app.vehicle,
        documents: app.documents,
        status: app.status,
        rejectionReason: app.rejectionReason || '',
        reviewedAt: app.reviewedAt || null,
        reviewedBy: app.reviewedBy || null,
        approvedCaptainId: app.approvedCaptainId || null,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
    };
}

async function ensureDefaultSuperAdminIfNeeded() {
    const count = await SuperAdmin.countDocuments();

    if (count > 0) return null;

    const defaultEmail = process.env.SUPER_ADMIN_EMAIL;
    const defaultPassword = process.env.SUPER_ADMIN_PASSWORD;
    const defaultName = process.env.SUPER_ADMIN_NAME || 'Central Go Super Admin';

    if (!defaultEmail || !defaultPassword) {
        return null;
    }

    const hashedPassword = await SuperAdmin.hashPassword(defaultPassword);

    const admin = await SuperAdmin.create({
        name: defaultName,
        email: String(defaultEmail).trim().toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        active: true,
    });

    console.log('[SUPER ADMIN] Primer Super Admin creado:', {
        email: admin.email,
    });

    return admin;
}

module.exports.login = async (req, res) => {
    try {
        await ensureDefaultSuperAdminIfNeeded();

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son obligatorios.',
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'JWT_SECRET no está configurado en el backend.',
            });
        }

        const admin = await SuperAdmin.findOne({
            email: String(email).trim().toLowerCase(),
            active: true,
        }).select('+password');

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas.',
            });
        }

        const isPasswordValid = await admin.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales incorrectas.',
            });
        }

        admin.lastLoginAt = new Date();
        await admin.save();

        const token = admin.generateAuthToken();

        res.cookie('superAdminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: 'Ingreso correcto.',
            token,
            admin: {
                _id: admin._id,
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                lastLoginAt: admin.lastLoginAt,
            },
        });
    } catch (error) {
        console.error('Error en superAdmin.login:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo iniciar sesión.',
        });
    }
};

module.exports.me = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            admin: {
                _id: req.superAdmin._id,
                id: req.superAdmin._id,
                name: req.superAdmin.name,
                email: req.superAdmin.email,
                role: req.superAdmin.role,
                lastLoginAt: req.superAdmin.lastLoginAt,
            },
        });
    } catch (error) {
        console.error('Error en superAdmin.me:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo obtener la sesión.',
        });
    }
};

module.exports.logout = async (req, res) => {
    try {
        res.clearCookie('superAdminToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente.',
        });
    } catch (error) {
        console.error('Error en superAdmin.logout:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo cerrar sesión.',
        });
    }
};

module.exports.dashboard = async (req, res) => {
    try {
        const { start, end } = getTodayRange();

        const [
            totalUsers,

            totalCaptains,
            activeCaptains,
            onlineCaptains,

            totalRides,
            ridesToday,
            completedRides,
            completedRidesToday,
            cancelledRides,
            pendingRides,
            negotiatingRides,
            acceptedRides,
            ongoingRides,

            totalEnterprises,
            activeEnterprises,

            totalEnterpriseDrivers,
            activeEnterpriseDrivers,
            enterpriseDriversInRoute,
            enterpriseDriversAvailable,

            totalEnterpriseDeliveries,
            enterpriseDeliveriesToday,
            enterpriseDeliveriesPending,
            enterpriseDeliveriesInProgress,
            enterpriseDeliveriesFinished,
            enterpriseDeliveriesFinishedToday,

            totalDriverApplications,
            pendingDriverApplications,
            approvedDriverApplications,
            rejectedDriverApplications,
        ] = await Promise.all([
            User.countDocuments(),

            Captain.countDocuments(),
            Captain.countDocuments({ status: 'active' }),
            Captain.countDocuments({ 'onlineSession.isOnline': true }),

            Ride.countDocuments(),
            Ride.countDocuments({ createdAt: { $gte: start, $lte: end } }),
            Ride.countDocuments({ status: 'completed' }),
            Ride.countDocuments({
                status: 'completed',
                updatedAt: { $gte: start, $lte: end },
            }),
            Ride.countDocuments({ status: 'cancelled' }),
            Ride.countDocuments({ status: 'pending' }),
            Ride.countDocuments({ status: 'negotiating' }),
            Ride.countDocuments({ status: 'accepted' }),
            Ride.countDocuments({ status: 'ongoing' }),

            Enterprise.countDocuments(),
            Enterprise.countDocuments({ active: true }),

            EnterpriseDriver.countDocuments(),
            EnterpriseDriver.countDocuments({ active: true }),
            EnterpriseDriver.countDocuments({ active: true, status: 'En ruta' }),
            EnterpriseDriver.countDocuments({ active: true, status: 'Disponible' }),

            EnterpriseDelivery.countDocuments(),
            EnterpriseDelivery.countDocuments({
                createdAt: { $gte: start, $lte: end },
            }),
            EnterpriseDelivery.countDocuments({ status: 'Pendiente' }),
            EnterpriseDelivery.countDocuments({ status: 'En curso' }),
            EnterpriseDelivery.countDocuments({ status: 'Finalizada' }),
            EnterpriseDelivery.countDocuments({
                status: 'Finalizada',
                finishedAt: { $gte: start, $lte: end },
            }),

            DriverApplication.countDocuments(),
            DriverApplication.countDocuments({ status: 'pending' }),
            DriverApplication.countDocuments({ status: 'approved' }),
            DriverApplication.countDocuments({ status: 'rejected' }),
        ]);

        const completedRideRevenueAgg = await Ride.aggregate([
            {
                $match: {
                    status: 'completed',
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$fare' },
                },
            },
        ]);

        const completedRideTodayRevenueAgg = await Ride.aggregate([
            {
                $match: {
                    status: 'completed',
                    updatedAt: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$fare' },
                },
            },
        ]);

        const enterpriseDeliveryRevenueAgg = await EnterpriseDelivery.aggregate([
            {
                $match: {
                    status: 'Finalizada',
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$invoiceValue' },
                },
            },
        ]);

        const enterpriseDeliveryTodayRevenueAgg = await EnterpriseDelivery.aggregate([
            {
                $match: {
                    status: 'Finalizada',
                    finishedAt: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$invoiceValue' },
                },
            },
        ]);

        const ridesRevenue = Number(completedRideRevenueAgg?.[0]?.total || 0);
        const ridesRevenueToday = Number(completedRideTodayRevenueAgg?.[0]?.total || 0);

        const enterpriseRevenue = Number(enterpriseDeliveryRevenueAgg?.[0]?.total || 0);
        const enterpriseRevenueToday = Number(
            enterpriseDeliveryTodayRevenueAgg?.[0]?.total || 0
        );

        const latestRides = await Ride.find()
            .sort({ createdAt: -1 })
            .limit(8)
            .populate('user', 'fullname email')
            .populate('captain', 'fullname email vehicle')
            .lean();

        const latestEnterpriseDeliveries = await EnterpriseDelivery.find()
            .sort({ createdAt: -1 })
            .limit(8)
            .populate('enterprise', 'companyName nit email')
            .populate('assignedDriverId', 'name cedula vehicle plate status currentLocation')
            .lean();

        const latestEnterpriseDrivers = await EnterpriseDriver.find({
            active: true,
        })
            .sort({ 'currentLocation.updatedAt': -1, updatedAt: -1 })
            .limit(10)
            .populate('enterprise', 'companyName nit email')
            .lean();

        const latestDriverApplications = await DriverApplication.find()
            .sort({ createdAt: -1 })
            .limit(8)
            .lean();

        return res.status(200).json({
            success: true,
            generatedAt: new Date().toISOString(),
            commissionPercent: getCommissionPercent(),

            modules: {
                users: {
                    totalUsers,
                },

                rides: {
                    totalRides,
                    ridesToday,
                    completedRides,
                    completedRidesToday,
                    cancelledRides,
                    pendingRides,
                    negotiatingRides,
                    acceptedRides,
                    ongoingRides,
                    totalCaptains,
                    activeCaptains,
                    onlineCaptains,
                    revenue: ridesRevenue,
                    revenueToday: ridesRevenueToday,
                    estimatedCommission: calculateCommission(ridesRevenue),
                    estimatedCommissionToday: calculateCommission(ridesRevenueToday),
                },

                driverApplications: {
                    totalDriverApplications,
                    pendingDriverApplications,
                    approvedDriverApplications,
                    rejectedDriverApplications,
                },

                enterprise: {
                    totalEnterprises,
                    activeEnterprises,
                    totalEnterpriseDrivers,
                    activeEnterpriseDrivers,
                    enterpriseDriversInRoute,
                    enterpriseDriversAvailable,
                    totalEnterpriseDeliveries,
                    enterpriseDeliveriesToday,
                    enterpriseDeliveriesPending,
                    enterpriseDeliveriesInProgress,
                    enterpriseDeliveriesFinished,
                    enterpriseDeliveriesFinishedToday,
                    revenue: enterpriseRevenue,
                    revenueToday: enterpriseRevenueToday,
                    estimatedCommission: calculateCommission(enterpriseRevenue),
                    estimatedCommissionToday: calculateCommission(enterpriseRevenueToday),
                },

                marketplace: {
                    status: 'pending_backend_connection',
                    totalListings: 0,
                    activeNegotiations: 0,
                    completedDeals: 0,
                    revenue: 0,
                    estimatedCommission: 0,
                    note: 'Marketplace visible en frontend. Falta conectar modelos backend específicos.',
                },

                totals: {
                    grossRevenue: ridesRevenue + enterpriseRevenue,
                    grossRevenueToday: ridesRevenueToday + enterpriseRevenueToday,
                    estimatedCommission:
                        calculateCommission(ridesRevenue) +
                        calculateCommission(enterpriseRevenue),
                    estimatedCommissionToday:
                        calculateCommission(ridesRevenueToday) +
                        calculateCommission(enterpriseRevenueToday),
                },
            },

            latest: {
                rides: latestRides,
                enterpriseDeliveries: latestEnterpriseDeliveries,
                enterpriseDrivers: latestEnterpriseDrivers,
                driverApplications: latestDriverApplications,
            },
        });
    } catch (error) {
        console.error('Error en superAdmin.dashboard:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo cargar el dashboard Super Admin.',
        });
    }
};

module.exports.getEnterprisesOverview = async (req, res) => {
    try {
        const enterprises = await Enterprise.find()
            .sort({ createdAt: -1 })
            .lean();

        const enterpriseIds = enterprises.map((enterprise) => enterprise._id);

        const [driversGrouped, deliveriesGrouped] = await Promise.all([
            EnterpriseDriver.aggregate([
                {
                    $match: {
                        enterprise: { $in: enterpriseIds },
                    },
                },
                {
                    $group: {
                        _id: '$enterprise',
                        totalDrivers: { $sum: 1 },
                        activeDrivers: {
                            $sum: {
                                $cond: [{ $eq: ['$active', true] }, 1, 0],
                            },
                        },
                        driversInRoute: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$active', true] },
                                            { $eq: ['$status', 'En ruta'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        driversAvailable: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$active', true] },
                                            { $eq: ['$status', 'Disponible'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        driversInactive: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$active', false] },
                                            { $eq: ['$status', 'Inactivo'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        lastDriverActivityAt: {
                            $max: '$currentLocation.updatedAt',
                        },
                    },
                },
            ]),

            EnterpriseDelivery.aggregate([
                {
                    $match: {
                        enterprise: { $in: enterpriseIds },
                    },
                },
                {
                    $group: {
                        _id: '$enterprise',
                        totalDeliveries: { $sum: 1 },
                        pendingDeliveries: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'Pendiente'] }, 1, 0],
                            },
                        },
                        inProgressDeliveries: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'En curso'] }, 1, 0],
                            },
                        },
                        finishedDeliveries: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'Finalizada'] }, 1, 0],
                            },
                        },
                        lastDeliveryAt: {
                            $max: '$createdAt',
                        },
                    },
                },
            ]),
        ]);

        const driversMap = new Map(
            driversGrouped.map((item) => [String(item._id), item])
        );

        const deliveriesMap = new Map(
            deliveriesGrouped.map((item) => [String(item._id), item])
        );

        const response = enterprises.map((enterprise) => {
            const key = String(enterprise._id);

            const driverStats = driversMap.get(key) || {};
            const deliveryStats = deliveriesMap.get(key) || {};

            const registeredAt = enterprise.createdAt || null;
            const nextBillingDate = registeredAt ? addOneMonth(registeredAt) : null;

            return {
                _id: enterprise._id,
                id: enterprise._id,
                companyName: enterprise.companyName || '',
                nit: enterprise.nit || '',
                email: enterprise.email || '',
                phone: enterprise.phone || '',
                active: enterprise.active,
                createdAt: enterprise.createdAt || null,
                updatedAt: enterprise.updatedAt || null,

                billingPeriod: {
                    registeredAt,
                    nextBillingDate,
                    daysSinceRegistration: registeredAt
                        ? getDaysBetween(registeredAt)
                        : 0,
                },

                stats: {
                    totalDrivers: Number(driverStats.totalDrivers || 0),
                    activeDrivers: Number(driverStats.activeDrivers || 0),
                    driversInRoute: Number(driverStats.driversInRoute || 0),
                    driversAvailable: Number(driverStats.driversAvailable || 0),
                    driversInactive: Number(driverStats.driversInactive || 0),

                    totalDeliveries: Number(deliveryStats.totalDeliveries || 0),
                    pendingDeliveries: Number(deliveryStats.pendingDeliveries || 0),
                    inProgressDeliveries: Number(deliveryStats.inProgressDeliveries || 0),
                    finishedDeliveries: Number(deliveryStats.finishedDeliveries || 0),

                    lastDriverActivityAt: driverStats.lastDriverActivityAt || null,
                    lastDeliveryAt: deliveryStats.lastDeliveryAt || null,
                },
            };
        });

        return res.status(200).json({
            success: true,
            enterprises: response,
        });
    } catch (error) {
        console.error('Error en getEnterprisesOverview:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo cargar el resumen de empresas.',
        });
    }
};

module.exports.getDriverApplications = async (req, res) => {
    try {
        const status = String(req.query.status || 'pending').trim();

        const allowedStatuses = ['pending', 'approved', 'rejected', 'all'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado de solicitud no válido.',
            });
        }

        const filter = status === 'all' ? {} : { status };

        const applications = await DriverApplication.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            applications: applications.map(buildApplicationResponse),
        });
    } catch (error) {
        console.error('Error en getDriverApplications:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudieron cargar las solicitudes de conductores.',
        });
    }
};

module.exports.approveDriverApplication = async (req, res) => {
    try {
        const { id } = req.params;

        const application = await DriverApplication.findById(id).select('+password');

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada.',
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Esta solicitud ya fue revisada.',
            });
        }

        const cleanEmail = String(application.email || '').trim().toLowerCase();
        const plate = String(application?.vehicle?.plate || '').trim().toUpperCase();

        const existingCaptain = await Captain.findOne({
            $or: [
                { email: cleanEmail },
                { 'vehicle.plate': plate },
            ],
        });

        if (existingCaptain) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un conductor registrado con ese correo o placa.',
            });
        }

        const captain = await Captain.create({
            fullname: {
                firstname: application.fullname.firstname,
                lastname: application.fullname.lastname || '',
            },
            email: cleanEmail,
            password: application.password,
            status: 'active',
            vehicle: {
                color: application.vehicle.color,
                plate,
                capacity: application.vehicle.capacity,
                vehicleType: application.vehicle.vehicleType,
            },
            profileImage: '',
            rating: 5,
            onlineSession: {
                isOnline: false,
                sessionStartedAt: null,
                lastSeenAt: null,
            },
            stats: {
                hoursOnline: 0,
                totalDistanceKm: 0,
                totalEarning: 0,
                cashCollected: 0,
                transferCollected: 0,
                totalTrips: 0,
                pendingToSettle: 0,
            },
            wallet: {
                balance: 0,
                currency: 'COP',
                lastMovementAt: null,
            },
        });

        application.status = 'approved';
        application.reviewedAt = new Date();
        application.reviewedBy = req.superAdmin?._id || null;
        application.approvedCaptainId = captain._id;
        application.rejectionReason = '';

        await application.save();

        const emailResult = await sendDriverApplicationApprovedEmail({
            to: application.email,
            name: getApplicationFullName(application),
        });

        return res.status(200).json({
            success: true,
            message: emailResult.sent
                ? 'Solicitud aprobada. El conductor ya puede iniciar sesión y fue notificado por correo.'
                : 'Solicitud aprobada. El conductor ya puede iniciar sesión, pero no se pudo enviar el correo.',
            email: emailResult,
            application: buildApplicationResponse(application),
            captain: buildCaptainResponse(captain),
        });
    } catch (error) {
        console.error('Error en approveDriverApplication:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo aprobar la solicitud.',
        });
    }
};

module.exports.rejectDriverApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const cleanReason = String(reason || '').trim();

        if (!cleanReason || cleanReason.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Debes escribir un motivo de rechazo válido.',
            });
        }

        const application = await DriverApplication.findById(id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada.',
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Esta solicitud ya fue revisada.',
            });
        }

        application.status = 'rejected';
        application.rejectionReason = cleanReason;
        application.reviewedAt = new Date();
        application.reviewedBy = req.superAdmin?._id || null;

        await application.save();

        const emailResult = await sendDriverApplicationRejectedEmail({
            to: application.email,
            name: getApplicationFullName(application),
            reason: cleanReason,
        });

        return res.status(200).json({
            success: true,
            message: emailResult.sent
                ? 'Solicitud rechazada correctamente. El conductor fue notificado por correo.'
                : 'Solicitud rechazada correctamente, pero no se pudo enviar el correo.',
            email: emailResult,
            application: buildApplicationResponse(application),
        });
    } catch (error) {
        console.error('Error en rejectDriverApplication:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo rechazar la solicitud.',
        });
    }
};

module.exports.getCaptainWallets = async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const limitRaw = Number(req.query.limit || 50);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, 1), 100)
            : 50;

        const filter = {};

        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safeSearch, 'i');

            filter.$or = [
                { email: regex },
                { 'fullname.firstname': regex },
                { 'fullname.lastname': regex },
                { 'vehicle.plate': regex },
                { 'vehicle.vehicleType': regex },
            ];
        }

        const captains = await Captain.find(filter)
            .sort({ 'wallet.balance': 1, createdAt: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            minBalanceToWork: MIN_CAPTAIN_BALANCE_TO_WORK,
            captains: captains.map(buildCaptainWalletResponse),
        });
    } catch (error) {
        console.error('Error en getCaptainWallets:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudieron cargar los saldos de conductores.',
        });
    }
};

module.exports.topupCaptainWallet = async (req, res) => {
    try {
        const { captainId } = req.params;
        const amount = Number(req.body.amount || 0);
        const description = String(req.body.description || req.body.note || '').trim();
        const reference = String(req.body.reference || '').trim();

        if (!captainId) {
            return res.status(400).json({
                success: false,
                message: 'Conductor inválido.',
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El valor de la recarga debe ser mayor que 0.',
            });
        }

        if (amount < 1000) {
            return res.status(400).json({
                success: false,
                message: 'La recarga mínima administrativa es de $1.000 COP.',
            });
        }

        const captain = await Captain.findById(captainId);

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        const balanceBefore = Number(captain?.wallet?.balance || 0);
        const balanceAfter = balanceBefore + amount;

        captain.wallet = captain.wallet || {};
        captain.wallet.balance = balanceAfter;
        captain.wallet.currency = 'COP';
        captain.wallet.lastMovementAt = new Date();

        await captain.save();

        const movement = await WalletTransaction.create({
            captain: captain._id,
            type: 'manual_credit',
            amount,
            currency: 'COP',
            balanceBefore,
            balanceAfter,
            description:
                description ||
                `Recarga manual realizada desde Super Admin por ${req.superAdmin?.email || 'administrador'}.`,
            reference:
                reference ||
                `SUPERADMIN-${Date.now()}-${String(captain._id).slice(-6)}`,
            metadata: {
                source: 'super_admin',
                action: 'captain_wallet_topup',
                adminId: req.superAdmin?._id || null,
                adminEmail: req.superAdmin?.email || '',
                adminName: req.superAdmin?.name || '',
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Saldo recargado correctamente.',
            minBalanceToWork: MIN_CAPTAIN_BALANCE_TO_WORK,
            captain: buildCaptainWalletResponse(captain),
            transaction: movement,
        });
    } catch (error) {
        console.error('Error en topupCaptainWallet:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo recargar el saldo del conductor.',
        });
    }
};

module.exports.getCaptainWalletTransactions = async (req, res) => {
    try {
        const { captainId } = req.params;
        const limitRaw = Number(req.query.limit || 20);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, 1), 100)
            : 20;

        const captain = await Captain.findById(captainId).lean();

        if (!captain) {
            return res.status(404).json({
                success: false,
                message: 'Conductor no encontrado.',
            });
        }

        const transactions = await WalletTransaction.find({
            captain: captainId,
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            captain: buildCaptainWalletResponse(captain),
            transactions,
        });
    } catch (error) {
        console.error('Error en getCaptainWalletTransactions:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'No se pudo cargar el historial de saldo.',
        });
    }
};