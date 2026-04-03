/** Maps/geocoding failures → 4xx; only clear infra faults → 500. */
function mapsErrorStatus(message) {
    const msg = String(message || '');
    if (/MongoServerError|mongoose|ECONNREFUSED|PrismaClient|Sequelize/i.test(msg)) {
        return 500;
    }
    if (/rate limit|429|OVER_QUERY_LIMIT|quota|RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg)) {
        return 429;
    }
    return 400;
}

module.exports = { mapsErrorStatus };
