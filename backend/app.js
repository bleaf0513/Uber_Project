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

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.use('/users', userRoutes);
app.use('/captain', captainRoutes);
app.use('/maps', mapRoutes);
app.use('/rides', rideRoutes);
app.use('/offers', offerRoutes);
app.use('/enterprise', enterpriseRoutes);
app.use('/enterprise-drivers', enterpriseDriverRoutes);
app.use('/enterprise-deliveries', enterpriseDeliveryRoutes);
app.use('/enterprise-clients', enterpriseClientRoutes);
app.use('/', enterpriseChatRoutes);

module.exports = app;
