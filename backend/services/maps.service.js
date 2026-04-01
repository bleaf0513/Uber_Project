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
    return t;
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
    const ua =
        process.env.NOMINATIM_USER_AGENT ||
        'UberClone/1.0 (ride demo; contact: https://github.com)';
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: address, format: 'json', limit: 1 },
        headers: {
            'User-Agent': ua,
        },
        timeout: 20000,
    });

    if (!Array.isArray(data) || !data.length) {
        throw new Error('Unable to resolve address (OpenStreetMap)');
    }
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('Invalid coordinates from OpenStreetMap');
    }
    return { ltd: lat, lng: lon };
}

/** Third fallback: works from most cloud hosts when Nominatim blocks datacenter IPs. */
async function openMeteoGeocode(address) {
    const q = address.length > 256 ? address.slice(0, 256) : address;
    const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: {
            name: q,
            count: 1,
            language: 'en',
            format: 'json',
        },
        timeout: 15000,
    });

    const r = data?.results?.[0];
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
    try {
        return await nominatimGeocode(address);
    } catch (err) {
        console.warn('[maps] Nominatim failed:', err.message);
    }
    try {
        return await openMeteoGeocode(address);
    } catch (err) {
        console.warn('[maps] Open-Meteo failed:', err.message);
        throw new Error(
            `Unable to resolve "${address}". Try a more specific place (city + country), or set GOOGLE_MAPS_SERVER_API on the server.`
        );
    }
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
    const addr = normalizeAddressQuery(address);
    if (!addr) {
        throw new Error('Address is required');
    }
    try {
        const key = serverMapsKey();
        if (!key) {
            throw new Error('Google Maps API key is not configured');
        }
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: addr,
                key,
            },
        });

        if (response.data.status === 'OK' && response.data.results?.length) {
            const location = response.data.results[0].geometry.location;
            return {
                ltd: location.lat,
                lng: location.lng,
            };
        }
        throw new Error(response.data.error_message || 'Unable to fetch coordinates');
    } catch (error) {
        console.error(error);
        throw error;
    }
};

module.exports.getDistance = async (origin, destination) => {
    const o = normalizeAddressQuery(origin);
    const d = normalizeAddressQuery(destination);
    if (!o || !d) {
        throw new Error('Origin and destination are required');
    }
    try {
        const key = serverMapsKey();
        if (key) {
            try {
                const response = await axios.get(
                    'https://maps.googleapis.com/maps/api/distancematrix/json',
                    {
                        params: {
                            origins: o,
                            destinations: d,
                            key,
                        },
                    }
                );

                if (response.data.status === 'OK') {
                    const element = response.data.rows?.[0]?.elements?.[0];
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
                        response.data.status,
                        response.data.error_message || ''
                    );
                }
            } catch (err) {
                console.warn('[maps] Distance Matrix request error:', err.message);
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
        console.error(error);
        throw error;
    }
};

module.exports.getSuggestions = async (address) => {
    const addr = normalizeAddressQuery(address);
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