const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const json = require('body-parser').json;
const urlencoded = require('body-parser').urlencoded;
const app = express();

// Behind Render / other reverse proxies — needed for correct client IPs and some proxy behaviors.
app.set('trust proxy', 1);

const userRoutes = require('./routes/user.routes');
const captainRoutes = require('./routes/captain.routes');
const cookieParser = require('cookie-parser');
const mapRoutes = require('./routes/maps.routes');
const rideRoutes = require('./routes/ride.routes');

app.use(
    cors({
        origin: true,
        credentials: true
    })
);
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello World');
});

/**
 * Deploy / build probe — use after Render redeploy to confirm this instance runs new code.
 * Open: GET https://<your-host>/version (no auth)
 * Compare `git.commit` to your GitHub commit SHA after each deploy.
 */
app.get('/version', (req, res) => {
    const commit =
        process.env.RENDER_GIT_COMMIT ||
        process.env.GIT_COMMIT ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        null;
    res.json({
        ok: true,
        service: 'uberclone-backend',
        node: process.version,
        maps: {
            /** Matches routes/maps.routes.js: read-only GETs have no JWT middleware. */
            readOnlyRoutesPublic: true,
        },
        git: {
            commit: commit,
            branch: process.env.RENDER_GIT_BRANCH || process.env.GIT_BRANCH || null,
        },
        render: {
            serviceId: process.env.RENDER_SERVICE_ID || null,
            /** e.g. uber-project-psfi.onrender.com */
            externalUrl: process.env.RENDER_EXTERNAL_URL || null,
        },
        time: new Date().toISOString(),
    });
});

app.use('/users', userRoutes);
app.use('/captain', captainRoutes);
app.use('/maps', mapRoutes);
app.use('/rides', rideRoutes);

module.exports = app;