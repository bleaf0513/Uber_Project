require('dotenv').config();
const http = require('http');
const connectToDb = require('./db/db');
const { initializeSocket } = require('./socket');

const port = process.env.PORT || 4000;

function deployProbePayload() {
    const commit =
        process.env.RENDER_GIT_COMMIT ||
        process.env.GIT_COMMIT ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        null;
    return {
        ok: true,
        service: 'uberclone-backend',
        node: process.version,
        endpoints: ['/version', '/healthz'],
        maps: {
            readOnlyRoutesPublic: true,
        },
        git: {
            commit: commit,
            branch: process.env.RENDER_GIT_BRANCH || process.env.GIT_BRANCH || null,
        },
        render: {
            serviceId: process.env.RENDER_SERVICE_ID || null,
            externalUrl: process.env.RENDER_EXTERNAL_URL || null,
        },
        time: new Date().toISOString(),
    };
}

async function main() {
    await connectToDb();

    const app = require('./app');
    // Register after app loads so deploy always picks up server.js changes (single entrypoint).
    app.get('/version', (req, res) => {
        res.json(deployProbePayload());
    });
    app.get('/healthz', (req, res) => {
        res.json(deployProbePayload());
    });

    const server = http.createServer(app);

    initializeSocket(server);

    server.listen(port, () => {
        const commit =
            process.env.RENDER_GIT_COMMIT ||
            process.env.GIT_COMMIT ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            '(not set)';
        console.log(`Server running on port ${port}`);
        console.log(
            `[boot] Deploy probe: GET /version and /healthz | RENDER_GIT_COMMIT|GIT_COMMIT=${commit}`
        );
    });
}

main().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
