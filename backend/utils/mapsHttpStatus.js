/** Maps/geocoding failures → 400; only clear infra faults → 500. */
function mapsErrorStatus(message) {
    const msg = String(message || '');
    if (/MongoServerError|mongoose|ECONNREFUSED|PrismaClient|Sequelize/i.test(msg)) {
        return 500;
    }
    return 400;
}

module.exports = { mapsErrorStatus };
