const axios = require('axios');
const captainModel = require('../models/captain.model');

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
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: address, format: 'json', limit: 1 },
        headers: {
            'User-Agent': 'UberCloneLocalDev/1.0 (local development; contact: dev@localhost)',
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

async function geocodeForFallback(address) {
    try {
        return await module.exports.getAddressCoordinates(address);
    } catch (err) {
        console.warn('[maps] Google Geocoding failed, trying Nominatim:', err.message);
        return await nominatimGeocode(address);
    }
}

/** Rough road-ish distance/duration when Distance Matrix has no driving route (e.g. separated by water). */
function approxDistanceElement(straightLineMeters) {
    const roadMeters = Math.round(straightLineMeters * 1.25);
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
    try {
        const key = serverMapsKey();
        if (!key) {
            throw new Error('Google Maps API key is not configured');
        }
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key,
            },
        });

        if (response.data.status === 'OK') {
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
    try {
        const key = serverMapsKey();
        if (key) {
            try {
                const response = await axios.get(
                    'https://maps.googleapis.com/maps/api/distancematrix/json',
                    {
                        params: {
                            origins: origin,
                            destinations: destination,
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
        const from = await geocodeForFallback(origin);
        const to = await geocodeForFallback(destination);
        const meters = haversineMeters(from.ltd, from.lng, to.ltd, to.lng);
        if (!Number.isFinite(meters) || meters <= 0) {
            throw new Error('Could not compute distance between locations');
        }
        return approxDistanceElement(meters);
    } catch (error) {
        console.error(error);
        throw error;
    }
};

module.exports.getSuggestions = async (address) => {
    try {
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input: address,
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

module.exports.getCaptainsInTheRadius = async (ltd, lng, radius) => {

    // radius in km


    const captains = await captainModel.find({
        location: {
            $geoWithin: {
                $centerSphere: [[ltd, lng], radius / 6371]
            }
        }
    });

    return captains;


}