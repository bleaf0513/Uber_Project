const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

function buildMongoUri() {
    const single = process.env.MONGO_URI && String(process.env.MONGO_URI).trim();
    if (single) {
        return single;
    }

    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASS;
    const host = process.env.MONGO_CONTEXT_URL;

    if (user && pass && host) {
        const encUser = encodeURIComponent(user);
        const encPass = encodeURIComponent(pass);
        return `mongodb+srv://${encUser}:${encPass}@${host}`;
    }

    return null;
}

/**
 * Connect to MongoDB. Resolves when ready (so server.js can await before listen).
 * Render / Atlas: prefer one var — MONGO_URI=mongodb+srv://...
 * Legacy: MONGO_USER + MONGO_PASS + MONGO_CONTEXT_URL (host like cluster0.xxxxx.mongodb.net)
 */
function connectToDb() {
    const uri = buildMongoUri();
    if (!uri) {
        return Promise.reject(
            new Error(
                'Database not configured: set MONGO_URI (recommended), or MONGO_USER + MONGO_PASS + MONGO_CONTEXT_URL on the server.'
            )
        );
    }

    return mongoose.connect(uri).then(() => {
        console.log('Connected to MongoDB');
    });
}

module.exports = connectToDb;
