const mongoose = require('mongoose');
require('dotenv').config();

let memoryMongo = null;

async function connectToDb() {
    let uri = process.env.MONGO_URI;

    if (process.env.USE_IN_MEMORY_MONGO === 'true') {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryMongo = await MongoMemoryServer.create();
        uri = memoryMongo.getUri();
        console.log('[dev] Using in-memory MongoDB (no Atlas or local install needed)');
    }

    if (!uri) {
        throw new Error(
            'Missing MONGO_URI. Options: (1) npm run dev:memory  (2) Set MONGO_URI in backend/.env — see .env.example'
        );
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
}

module.exports = connectToDb;
