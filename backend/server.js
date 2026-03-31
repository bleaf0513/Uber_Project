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
        console.log(`Server running on port ${port}`);
        if (!process.env.GOOGLE_MAPS_SERVER_API && !process.env.GOOGLE_MAPS_API) {
            console.warn(
                '[warn] Set GOOGLE_MAPS_API or GOOGLE_MAPS_SERVER_API — backend map calls need a key (see .env.example).'
            );
        } else if (!process.env.GOOGLE_MAPS_SERVER_API && process.env.GOOGLE_MAPS_API) {
            console.warn(
                '[hint] If Geocoding/Places return REQUEST_DENIED, create GOOGLE_MAPS_SERVER_API — HTTP-referrer keys do not work from Node.'
            );
        }
    });
}

main().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
