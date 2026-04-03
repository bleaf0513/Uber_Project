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
    });
}

main().catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
