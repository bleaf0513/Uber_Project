require('dotenv').config();
const http = require('http');
const connectToDb = require('./db/db');
const { initializeSocket } = require('./socket');

const port = process.env.PORT || 4000;

async function main() {
    await connectToDb();

    const app = require('./app');
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
