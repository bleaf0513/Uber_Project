const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const json = require('body-parser').json;
const urlencoded = require('body-parser').urlencoded;
const cookieParser = require('cookie-parser');

const app = express();

// Behind Render / other reverse proxies — needed for correct client IPs and some proxy behaviors.
app.set('trust proxy', 1);

const userRoutes = require('./routes/user.routes');
const captainRoutes = require('./routes/captain.routes');
const mapRoutes = require('./routes/maps.routes');
const rideRoutes = require('./routes/ride.routes');
const offerRoutes = require('./routes/offer.routes');

const enterpriseRoutes = require('./routes/enterprise.routes');
const enterpriseDriverRoutes = require('./routes/enterpriseDriver.routes');
const enterpriseDeliveryRoutes = require('./routes/enterpriseDelivery.routes');
const enterpriseChatRoutes = require('./routes/enterpriseChat.routes');
const enterpriseClientRoutes = require('./routes/enterpriseClient.routes');

const superAdminRoutes = require('./routes/superAdmin.routes');

/**
 * IMPORTS DIRECTOS PARA RUTAS INTELIGENTES
 * Esto funciona como respaldo por si el router enterpriseDelivery.routes
 * no queda tomando estas rutas en producción.
 */
const authEnterprise = require('./middlewares/authEnterprise');

const {
    getPendingRouteDeliveries,
    optimizeEnterpriseRoutes,
    assignOptimizedRoute,
} = require('./controllers/enterpriseDelivery.controller');

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.use('/users', userRoutes);

// Deja ambas para compatibilidad
app.use('/captain', captainRoutes);
app.use('/captains', captainRoutes);

app.use('/maps', mapRoutes);
app.use('/rides', rideRoutes);
app.use('/offers', offerRoutes);

app.use('/enterprise', enterpriseRoutes);
app.use('/enterprise-drivers', enterpriseDriverRoutes);
app.use('/enterprise-deliveries', enterpriseDeliveryRoutes);

/**
 * RUTAS INTELIGENTES — REGISTRO DIRECTO DE RESPALDO
 *
 * Estas rutas son las que necesita el frontend:
 * GET  /enterprise-deliveries/pending-routes
 * POST /enterprise-deliveries/optimize-routes
 * POST /enterprise-deliveries/assign-route
 *
 * Si el router ya las tiene, no daña nada.
 * Si el router no las está exponiendo en Render, estas las dejan activas.
 */
app.get(
    '/enterprise-deliveries/pending-routes',
    authEnterprise,
    getPendingRouteDeliveries
);

app.post(
    '/enterprise-deliveries/optimize-routes',
    authEnterprise,
    optimizeEnterpriseRoutes
);

app.post(
    '/enterprise-deliveries/assign-route',
    authEnterprise,
    assignOptimizedRoute
);

app.use('/enterprise-clients', enterpriseClientRoutes);
app.use('/', enterpriseChatRoutes);

// Super Admin maestro de Central Go
app.use('/super-admin', superAdminRoutes);

module.exports = app;