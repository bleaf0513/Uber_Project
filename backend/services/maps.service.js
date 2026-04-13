const axios = require('axios');
const captainModel = require('../models/captain.model');

function normalizeAddressQuery(s) {
    if (s == null || s === undefined) return '';
    let t = String(s).trim();
    if (t.length > 2000) t = t.slice(0, 2000);
    t = t.replace(/\0/g, '');
    t = t.replace(/\+/g, ' ');
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
        // ignore
    }
    return t.trim();
}

function serverMapsKey() {
    return process.env.GOOGLE_MAPS_SERVER_API || process.env.GOOGLE_MAPS_API;
}

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

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function isGoogleHardFail(data) {
    if (!data || typeof data !== 'object') return true;
    const st = data.status;
    return (
        st === 'OVER_QUERY_LIMIT' ||
        st === 'REQUEST_DENIED' ||
        st === 'INVALID_REQUEST' ||
        (typeof st === 'string' && /denied|limit|quota/i.test(st))
    );
}

/**
 * Fallback manual para Colombia / Antioquia / Valle de Aburrá
 * Esto evita que cuando falle Google te mande Itagüí a otro lado.
 */
function roughCoordsForColombia(address) {
    const s = normalizeAddressQuery(address).toLowerCase();

    // Municipios del Valle de Aburrá
    if (/itag[uü]i/.test(s)) return { ltd: 6.1719, lng: -75.6114 };
    if (/sabaneta/.test(s)) return { ltd: 6.1515, lng: -75.6167 };
    if (/envigado/.test(s)) return { ltd: 6.1700, lng: -75.5917 };
    if (/medell[ií]n/.test(s)) return { ltd: 6.2442, lng: -75.5812 };
    if (/bello/.test(s)) return { ltd: 6.3373, lng: -75.5579 };
    if (/copacabana/.test(s)) return { ltd: 6.3463, lng: -75.5089 };
    if (/la estrella/.test(s)) return { ltd: 6.1577, lng: -75.6432 };
    if (/caldas/.test(s) && /antioquia/.test(s)) return { ltd: 6.0911, lng: -75.6357 };
    if (/girardota/.test(s)) return { ltd: 6.3778, lng: -75.4488 };
    if (/barbosa/.test(s) && /antioquia/.test(s)) return { ltd: 6.4381, lng: -75.3311 };

    // Antioquia general
    if (/antioquia/.test(s)) return { ltd: 6.2442, lng: -75.5812 };

    // Otras ciudades Colombia
    if (/bogot[aá]/.test(s)) return { ltd: 4.7110, lng: -74.0721 };
    if (/cali/.test(s)) return { ltd: 3.4516, lng: -76.5320 };
    if (/barranquilla/.test(s)) return { ltd: 10.9685, lng: -74.7813 };
    if (/cartagena/.test(s)) return { ltd: 10.3910, lng: -75.4794 };
    if (/bucaramanga/.test(s)) return { ltd: 7.1193, lng: -73.1227 };
    if (/pereira/.test(s)) return { ltd: 4.8087, lng: -75.6906 };
    if (/manizales/.test(s)) return { ltd: 5.0703, lng: -75.5138 };
    if (/armenia/.test(s) && /colombia/.test(s)) return { ltd: 4.5339, lng: -75.6811 };
    if (/santa marta/.test(s)) return { ltd: 11.2408, lng: -74.1990 };
    if (/monტერ[ií]a|monter[ií]a/.test(s)) return { ltd: 8.7500, lng: -75.8814 };
    if (/villavicencio/.test(s)) return { ltd: 4.1420, lng: -73.6266 };
    if (/c[oó]cuta|cucuta/.test(s)) return { ltd: 7.8939, lng: -72.5078 };
    if (/ibagu[eé]/.test(s)) return { ltd: 4.4389, lng: -75.2322 };
    if (/pasto/.test(s)) return { ltd: 1.2136, lng: -77.2811 };

    if (/colombia/.test(s)) return { ltd: 4.5709, lng: -74.2973 };

    return null;
}

async function nominatimGeocode(address) {
    try {
        const ua =
            process.env.NOMINATIM_USER_AGENT ||
            'CentralGo/1.0 (Colombia geocoding)';
        const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                limit: 1,
                countrycodes: 'co',
            },
            headers: { 'User-Agent': ua },
            timeout: 20000,
        });

        if (!Array.isArray(data) || !data.length) {
            throw new Error('NOMINATIM_EMPTY');
        }

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw new Error('NOMINATIM_BAD');
        }

        return { ltd: lat, lng: lon };
    } catch (e) {
        console.warn('[maps] Nominatim:', e?.message || e);
        throw new Error('Nominatim geocoding did not return a match');
    }
}

async function photonGeocode(address) {
    const raw = String(address).trim();
    const ua =
        process.env.NOMINATIM_USER_AGENT ||
        'CentralGo/1.0 (Colombia geocoding)';

    const attempts = [];
    const push = (s) => {
        const t = String(s).trim();
        if (t.length >= 3) attempts.push(t);
    };

    push(raw);

    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) push(parts.slice(-3).join(', '));
    if (parts.length >= 2) push(parts.slice(-2).join(', '));

    let lastErr;

    for (const q of attempts) {
        try {
            const { data } = await axios.get('https://photon.komoot.io/api/', {
                params: {
                    q,
                    lang: 'en',
                    limit: 5,
                },
                timeout: 20000,
                headers: { 'User-Agent': ua },
            });

            const features = data?.features;
            if (!Array.isArray(features) || !features.length) {
                lastErr = new Error('PHOTON_NO_RESULTS');
                continue;
            }

            for (const f of features) {
                const coords = f?.geometry?.coordinates;
                if (!Array.isArray(coords) || coords.length < 2) continue;

                const lng = Number(coords[0]);
                const lat = Number(coords[1]);

                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    return { ltd: lat, lng };
                }
            }

            lastErr = new Error('PHOTON_BAD_COORDINATES');
        } catch (e) {
            lastErr = e;
        }
    }

    throw lastErr instanceof Error ? lastErr : new Error('PHOTON_NO_RESULTS');
}

async function openMeteoGeocode(address) {
    const full = String(address).trim();

    const attempts = [];
    const push = (s) => {
        const t = String(s).trim();
        if (t.length >= 2) attempts.push(t);
    };

    push(full);

    const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) push(parts.slice(-3).join(', '));
    if (parts.length >= 2) push(parts.slice(-2).join(', '));

    let allResults = [];

    for (const q of attempts) {
        try {
            const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
                params: {
                    name: q,
                    count: 10,
                    language: 'es',
                    format: 'json',
                    countryCode: 'CO',
                },
                timeout: 15000,
            });

            const results = Array.isArray(data?.results) ? data.results : [];
            if (results.length) {
                allResults = results;
                break;
            }
        } catch (e) {
            const st = e?.response?.status;
            console.warn('[maps] Open-Meteo query skipped:', q, st || e?.message);
        }
    }

    if (!allResults.length) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }

    // Priorizar coincidencias con Antioquia / Colombia
    const lower = full.toLowerCase();

    const preferred =
        allResults.find((r) => {
            const hay = `${r.name || ''} ${r.admin1 || ''} ${r.admin2 || ''} ${r.country || ''}`.toLowerCase();

            if (/itag[uü]i/.test(lower) && /itag/i.test(hay)) return true;
            if (/sabaneta/.test(lower) && /sabaneta/.test(hay)) return true;
            if (/envigado/.test(lower) && /envigado/.test(hay)) return true;
            if (/medell[ií]n/.test(lower) && /medell/i.test(hay)) return true;
            if (/antioquia/.test(lower) && /antioquia/.test(hay)) return true;
            if (/colombia/.test(lower) && /colombia/.test(hay)) return true;

            return false;
        }) || allResults[0];

    if (
        !preferred ||
        !Number.isFinite(preferred.latitude) ||
        !Number.isFinite(preferred.longitude)
    ) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }

    return { ltd: preferred.latitude, lng: preferred.longitude };
}

async function geocodeWithoutGoogle(address) {
    // 1. Prioridad total a Colombia manual
    const colombiaHint = roughCoordsForColombia(address);
    if (colombiaHint) {
        console.warn('[maps] Using Colombia fallback coordinates for:', address);
        return colombiaHint;
    }

    // 2. Open-Meteo
    try {
        return await openMeteoGeocode(address);
    } catch (err) {
        console.warn('[maps] Open-Meteo failed:', err.message);
    }

    // 3. Photon
    try {
        return await photonGeocode(address);
    } catch (err) {
        console.warn('[maps] Photon failed:', err.message);
    }

    // 4. Nominatim opcional
    if (process.env.MAPS_ENABLE_NOMINATIM === '1') {
        try {
            return await nominatimGeocode(address);
        } catch (err) {
            console.warn('[maps] Nominatim failed:', err.message);
        }
    }

    throw new Error(
        `Unable to resolve "${address}". Try a more specific place in Colombia, or configure GOOGLE_MAPS_SERVER_API correctly.`
    );
}

function approxDistanceElement(straightLineMeters) {
    const straight = Math.max(Number(straightLineMeters) || 0, 75);
    const roadMeters = Math.max(Math.round(straight * 1.25), 100);
    const avgSpeedKmh = 38; // mejor aproximación urbana Colombia
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
    const addrRaw = normalizeAddressQuery(address);
    if (!addrRaw) {
        throw new Error('Address is required');
    }

    // Si es Colombia / Antioquia / Valle de Aburrá, prioriza fallback colombiano
    const roughCo = roughCoordsForColombia(addrRaw);

    const key = serverMapsKey();

    if (!key) {
        if (roughCo) return roughCo;
        return await geocodeWithoutGoogle(addrRaw);
    }

    try {
        const data = await googleMapsFormPost('geocode/json', {
            address: addrRaw,
            components: 'country:CO',
        });

        if (isGoogleHardFail(data)) {
            console.warn('[maps] Geocoding status', data.status, '— Colombia/Open-Meteo fallback');
            if (roughCo) return roughCo;
            return await geocodeWithoutGoogle(addrRaw);
        }

        if (data.status === 'OK' && data.results?.length) {
            const loc = data.results[0]?.geometry?.location;
            const lat = loc?.lat;
            const lng = loc?.lng;

            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { ltd: lat, lng };
            }
        }

        if (roughCo) return roughCo;
        return await geocodeWithoutGoogle(addrRaw);
    } catch (error) {
        const status = error?.response?.status;

        if (status === 429 || status === 403) {
            console.warn('[maps] Geocoding HTTP', status, '— Colombia/Open-Meteo fallback');
            if (roughCo) return roughCo;
            return await geocodeWithoutGoogle(addrRaw);
        }

        console.warn('[maps] geocode fallback:', error?.message);
        if (roughCo) return roughCo;
        return await geocodeWithoutGoogle(addrRaw);
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
                const data = await googleMapsFormPost('distancematrix/json', {
                    origins: o,
                    destinations: d,
                });

                if (isGoogleHardFail(data)) {
                    console.warn('[maps] Distance Matrix:', data.status, data.error_message || '');
                } else if (data.status === 'OK') {
                    const element = data.rows?.[0]?.elements?.[0];

                    if (
                        element?.status === 'OK' &&
                        element.distance?.value != null &&
                        element.duration?.value != null
                    ) {
                        return element;
                    }
                }
            } catch (err) {
                const st = err?.response?.status;
                if (st === 429 || st === 403) {
                    console.warn('[maps] Distance Matrix rate limited — using coordinate estimate');
                } else {
                    const em = err?.response?.data?.error_message || err?.message;
                    console.warn('[maps] Distance Matrix request error:', em);
                }
            }
        } else {
            console.warn('[maps] No Google server key; estimating distance via Colombia fallback');
        }

        const from = await module.exports.getAddressCoordinates(origin);
        const to = await module.exports.getAddressCoordinates(destination);

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
    const addr = normalizeAddressQuery(address);
    if (!addr) return [];

    const key = serverMapsKey();

    if (key) {
        try {
            const { data } = await axios.get(
                'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                {
                    params: {
                        input: addr,
                        key,
                        components: 'country:co',
                    },
                    timeout: 15000,
                }
            );

            if (data.status === 'OK' && data.predictions?.length) {
                return data.predictions;
            }

            console.warn(
                '[maps] Google Place Autocomplete:',
                data?.status,
                data?.error_message || ''
            );
        } catch (error) {
            console.error('[maps] suggestions Google:', error.message);
        }
    }

    try {
        return await photonAutocompleteSuggestions(`${addr}, Colombia`);
    } catch (error) {
        console.warn('[maps] Photon suggestions:', error.message);
        return [];
    }
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radiusKm) => {
    const radiusM = radiusKm * 1000;

    console.log('[maps] searching captains in radius:', {
        pickupLtd: ltd,
        pickupLng: lng,
        radiusKm,
    });

    const captains = await captainModel.find({
        status: 'active',
        'location.ltd': { $exists: true, $ne: null },
        'location.lng': { $exists: true, $ne: null },
    });

    console.log('[maps] active captains with location:', captains.length);

    const nearbyCaptains = captains.filter((c) => {
        const dist = haversineMeters(ltd, lng, c.location.ltd, c.location.lng);
        const isInside = dist <= radiusM;

        console.log('[maps] captain distance check:', {
            captainId: String(c._id),
            socketId: c.socketId || null,
            captainLtd: c.location?.ltd,
            captainLng: c.location?.lng,
            distanceMeters: Math.round(dist),
            insideRadius: isInside,
        });

        return isInside;
    });

    console.log('[maps] nearby captains found:', nearbyCaptains.length);

    return nearbyCaptains;
};
