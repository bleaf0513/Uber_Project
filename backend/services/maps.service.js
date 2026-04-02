const axios = require('axios');
const captainModel = require('../models/captain.model');

/**
 * Normalize free-text addresses (esp. Japanese) for geocoding APIs:
 * Unicode minus/dashes, length cap, control chars.
 */
function normalizeAddressQuery(s) {
    if (s == null || s === undefined) return '';
    let t = String(s).trim();
    if (t.length > 2000) t = t.slice(0, 2000);
    t = t.replace(/\0/g, '');
    t = t
        .replace(/\u2212/g, '-')
        .replace(/\uFF0D/g, '-')
        .replace(/\u2010/g, '-')
        .replace(/\u2011/g, '-')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '-')
        .replace(/\uFE63/g, '-')
        .replace(/\uFF70/g, '-');
    t = t.replace(/\s+/g, ' ').trim();
    try {
        t = t.normalize('NFKC');
    } catch {
        /* older Node / invalid sequence */
    }
    return t.trim();
}

/**
 * Places Autocomplete often returns "POI Name, 4 Chome-…, City, Tokyo, Japan".
 * Geocoders fail on the long POI prefix; the street block after the first comma is usually enough.
 */
function stripLeadingVenueBeforeChome(s) {
    const t = String(s).trim();
    if (!t) return t;
    const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => /\d+\s*Chome\b/i.test(p));
    if (idx > 0) {
        return parts.slice(idx).join(', ');
    }
    return t;
}

/** POST avoids proxy URL-length limits on long Japanese addresses (Geocoding / Distance Matrix). */
async function googleMapsFormPost(apiPath, fields) {
    const key = serverMapsKey();
    if (!key) {
        throw new Error('Google Maps API key is not configured');
    }
    const body = new URLSearchParams({ ...fields, key });
    const { data } = await axios.post(
        `https://maps.googleapis.com/maps/api/${apiPath}`,
        body.toString(),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 25000,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024,
        }
    );
    return data;
}

/** Server-side Maps calls (Geocoding, Distance Matrix, Places) must use a key without HTTP-referrer restrictions. */
function serverMapsKey() {
    return process.env.GOOGLE_MAPS_SERVER_API || process.env.GOOGLE_MAPS_API;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** When Google Geocoding fails from the server (API disabled, wrong key type), resolve coordinates via OpenStreetMap Nominatim. */
async function nominatimGeocode(address) {
    try {
        const ua =
            process.env.NOMINATIM_USER_AGENT ||
            'UberClone/1.0 (ride demo; contact: https://github.com/K-Daksh/UberClone)';
        const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
            headers: {
                'User-Agent': ua,
            },
            timeout: 20000,
        });

        if (!Array.isArray(data) || !data.length) {
            throw new Error('NOMINATIM_EMPTY');
        }
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw new Error('NOMINATIM_BAD_COORDS');
        }
        return { ltd: lat, lng: lon };
    } catch (e) {
        console.warn('[maps] Nominatim:', e?.message || e);
        throw new Error('Nominatim geocoding did not return a match');
    }
}

function inferCountryCodeForOpenMeteo(addr) {
    const s = String(addr);
    if (/\bJapan\b|日本|東京|東京都|大阪|京都|北海道|沖縄|名古屋|福岡|Japan,/i.test(s)) return 'JP';
    if (/\bUSA\b|\bUS\b|, [A-Z]{2}\s*\d{5}|United States/i.test(s)) return 'US';
    if (/\bUK\b|United Kingdom|England|Scotland|Wales/i.test(s)) return 'GB';
    return undefined;
}

/** Third fallback: works from most cloud hosts when Nominatim blocks datacenter IPs. */
async function openMeteoGeocode(address) {
    const maxLen = 512;
    const stripped = stripLeadingVenueBeforeChome(address);
    const base = stripped.length >= 4 ? stripped : address;
    const full = base.length > maxLen ? base.slice(0, maxLen) : base;
    const language = /[\u3040-\u30ff\u3400-\u9fff]/.test(full) ? 'ja' : 'en';
    const countryCode = inferCountryCodeForOpenMeteo(full);

    async function search(name, useCountryFilter) {
        const q = name.length > maxLen ? name.slice(0, maxLen) : name;
        if (q.length < 2) return { results: [] };
        const params = {
            name: q,
            count: 10,
            language,
            format: 'json',
        };
        if (useCountryFilter && countryCode) params.countryCode = countryCode;
        const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
            params,
            timeout: 15000,
        });
        return data || {};
    }

    const partsAll = full.split(',').map((p) => p.trim()).filter(Boolean);
    const fallbacksList = [];
    if (partsAll.length > 1) fallbacksList.push(partsAll.slice(1).join(', '));
    if (partsAll.length > 2) fallbacksList.push(partsAll.slice(-3).join(', '));
    if (partsAll.length > 1) {
        fallbacksList.push(`${partsAll[partsAll.length - 2]}, ${partsAll[partsAll.length - 1]}`);
    }

    async function collectResults(useCountryFilter) {
        let data = await search(full, useCountryFilter);
        let results = data?.results;
        if (!Array.isArray(results) || !results.length) {
            for (const fb of fallbacksList) {
                if (!fb || fb.length < 4 || fb === full) continue;
                data = await search(fb, useCountryFilter);
                results = data?.results;
                if (Array.isArray(results) && results.length) break;
            }
        }
        return Array.isArray(results) ? results : [];
    }

    let results = await collectResults(true);
    if (!results.length && countryCode) {
        results = await collectResults(false);
    }

    if (!results.length) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }

    let r = results[0];
    const hint = full.toLowerCase();
    if (/shinagawa|kita-shinagawa|minami-shinagawa|北品川|南品川|品川|hiromachi|広町/i.test(hint)) {
        const hit = results.find((x) =>
            /shinagawa|品川|hiromachi|広町/i.test(
                `${x.name || ''} ${x.admin1 || ''} ${x.admin2 || ''} ${x.admin3 || ''} ${x.admin4 || ''}`
            )
        );
        if (hit) r = hit;
    }

    if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }
    return { ltd: r.latitude, lng: r.longitude };
}

async function geocodeForFallback(address) {
    try {
        return await module.exports.getAddressCoordinates(address);
    } catch (err) {
        console.warn('[maps] Google Geocoding failed:', err.message);
    }
    // Open-Meteo before Nominatim: datacenter IPs are often blocked or rate-limited on OSM Nominatim.
    try {
        return await openMeteoGeocode(address);
    } catch (err) {
        console.warn('[maps] Open-Meteo failed:', err.message);
    }
    // Nominatim is opt-in — from Render/AWS/etc. it usually returns empty or HTTP errors and confuses clients.
    if (process.env.MAPS_ENABLE_NOMINATIM === '1') {
        try {
            return await nominatimGeocode(address);
        } catch (err) {
            console.warn('[maps] Nominatim failed:', err.message);
        }
    }
    throw new Error(
        `Unable to resolve "${address}". Try a more specific place (city + country), or set GOOGLE_MAPS_SERVER_API on the server.`
    );
}

/** Rough road-ish distance/duration when Distance Matrix has no driving route (e.g. separated by water). */
function approxDistanceElement(straightLineMeters) {
    // Same block / duplicate geocode → 0 m; still need a non-zero estimate for fares.
    const straight = Math.max(Number(straightLineMeters) || 0, 75);
    const roadMeters = Math.max(Math.round(straight * 1.25), 100);
    const avgSpeedKmh = 55;
    const durationSeconds = Math.round((roadMeters / 1000 / avgSpeedKmh) * 3600);
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.round((durationSeconds % 3600) / 60);
    const durationText =
        h <= 0 ? `${m} mins` : `${h} hour${h !== 1 ? 's' : ''} ${m} mins`;
    return {
        status: 'OK',
        distance: {
            value: roadMeters,
            text: `${(roadMeters / 1000).toFixed(1)} km (est.)`,
        },
        duration: {
            value: durationSeconds,
            text: durationText,
        },
    };
}

module.exports.getAddressCoordinates = async (address) => {
    const addr = stripLeadingVenueBeforeChome(normalizeAddressQuery(address));
    if (!addr) {
        throw new Error('Address is required');
    }
    try {
        const data = await googleMapsFormPost('geocode/json', { address: addr });

        if (data.status === 'OK' && data.results?.length) {
            const loc = data.results[0]?.geometry?.location;
            const lat = loc?.lat;
            const lng = loc?.lng;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { ltd: lat, lng };
            }
        }
        throw new Error(data.error_message || 'Unable to fetch coordinates');
    } catch (error) {
        const resData = error?.response?.data;
        const googleMsg =
            typeof resData === 'object' && resData != null && typeof resData.error_message === 'string'
                ? resData.error_message
                : null;
        if (googleMsg) {
            throw new Error(googleMsg);
        }

        if (error instanceof Error && !error.response) {
            if (error.name === 'TypeError' || error.name === 'ReferenceError') {
                console.error('[maps] geocode unexpected:', error);
                throw new Error('Unable to fetch coordinates');
            }
            const m = error.message || '';
            const isAxiosNetwork =
                error.code === 'ECONNABORTED' ||
                error.code === 'ENOTFOUND' ||
                error.code === 'ECONNRESET' ||
                /timeout|Request failed with status code|Network Error/i.test(m);
            if (isAxiosNetwork) {
                console.error('[maps] geocode:', m);
                throw new Error('Unable to fetch coordinates');
            }
            throw error;
        }

        console.error('[maps] geocode:', error?.message || error);
        throw new Error('Unable to fetch coordinates');
    }
};

module.exports.getDistance = async (origin, destination) => {
    const o = stripLeadingVenueBeforeChome(normalizeAddressQuery(origin));
    const d = stripLeadingVenueBeforeChome(normalizeAddressQuery(destination));
    if (!o || !d) {
        throw new Error('Origin and destination are required');
    }
    try {
        const key = serverMapsKey();
        if (key) {
            try {
                const data = await googleMapsFormPost('distancematrix/json', {
                    origins: o,
                    destinations: d,
                });

                if (data.status === 'OK') {
                    const element = data.rows?.[0]?.elements?.[0];
                    if (
                        element?.status === 'OK' &&
                        element.distance?.value != null &&
                        element.duration?.value != null
                    ) {
                        return element;
                    }
                } else {
                    console.warn(
                        '[maps] Distance Matrix:',
                        data.status,
                        data.error_message || ''
                    );
                }
            } catch (err) {
                const em = err?.response?.data?.error_message || err?.message;
                console.warn('[maps] Distance Matrix request error:', em);
            }
        } else {
            console.warn('[maps] No Google server key; estimating distance via geocoding fallback');
        }

        // Referrer-only keys, ZERO_RESULTS, ocean gaps, etc. — estimate from coordinates
        const from = await geocodeForFallback(o);
        const to = await geocodeForFallback(d);
        const metersRaw = haversineMeters(from.ltd, from.lng, to.ltd, to.lng);
        if (!Number.isFinite(metersRaw)) {
            throw new Error('Could not compute distance between locations');
        }
        return approxDistanceElement(metersRaw);
    } catch (error) {
        const msg = error?.message || String(error);
        console.error('[maps] getDistance:', msg);
        if (typeof msg === 'string' && msg.length > 0) {
            throw error instanceof Error ? error : new Error(msg);
        }
        throw new Error('Could not compute distance between locations');
    }
};

module.exports.getSuggestions = async (address) => {
    const addr = stripLeadingVenueBeforeChome(normalizeAddressQuery(address));
    if (!addr) {
        return [];
    }
    try {
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input: addr,
                key: serverMapsKey()
            }
        });

        if (data.status === 'OK' && data.predictions) {
            return data.predictions;
        } else {
            // console.warn(`Google Places API returned status: ${data.status} ${data.error_message || ''}`);
            return [];
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Find captains within radiusKm of (ltd, lng).
 * Uses haversine on { location.ltd, location.lng } — the old $geoWithin query required GeoJSON + 2dsphere index and matched nobody.
 */
module.exports.getCaptainsInTheRadius = async (ltd, lng, radiusKm) => {
    const radiusM = radiusKm * 1000;
    const captains = await captainModel.find({
        status: 'active',
        'location.ltd': { $exists: true, $ne: null },
        'location.lng': { $exists: true, $ne: null },
    });

    return captains.filter((c) => {
        const d = haversineMeters(ltd, lng, c.location.ltd, c.location.lng);
        return d <= radiusM;
    });
};