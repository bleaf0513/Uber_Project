const axios = require('axios');
const captainModel = require('../models/captain.model');

console.log('🇨🇴 MAPS SERVICE COLOMBIA FILTRADO ACTIVO 🇨🇴');

function normalizeAddressQuery(value) {
    if (value == null) return '';
    let text = String(value)
        .replace(/\0/g, ' ')
        .replace(/\+/g, ' ')
        .trim();

    try {
        text = text.normalize('NFKC');
    } catch {
        // ignore
    }

    text = text
        .replace(/\u2212/g, '-')
        .replace(/\uFF0D/g, '-')
        .replace(/\u2010/g, '-')
        .replace(/\u2011/g, '-')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '-')
        .replace(/\uFE63/g, '-')
        .replace(/\uFF70/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    if (text.length > 500) text = text.slice(0, 500).trim();
    return text;
}

function normalizeLooseText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[#,.;/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function serverMapsKey() {
    return process.env.GOOGLE_MAPS_SERVER_API || process.env.GOOGLE_MAPS_API || '';
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function isValidLatitude(lat) {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
    return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function isValidLatLng(lat, lng) {
    return isValidLatitude(lat) && isValidLongitude(lng);
}

function isColombiaCoordinate(lat, lng) {
    return isValidLatLng(lat, lng) && lat >= -4.5 && lat <= 16.5 && lng >= -81.9 && lng <= -66.0;
}

async function googleGet(apiPath, params = {}, timeout = 20000) {
    const key = serverMapsKey();
    if (!key) {
        throw new Error('Google Maps API key is not configured');
    }

    const { data } = await axios.get(`https://maps.googleapis.com/maps/api/${apiPath}`, {
        params: { ...params, key },
        timeout,
    });

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

function approxDistanceElement(straightLineMeters) {
    const straight = Math.max(Number(straightLineMeters) || 0, 75);
    const roadMeters = Math.max(Math.round(straight * 1.25), 100);
    const avgSpeedKmh = 38;
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

function roughCoordsForColombia(address) {
    const s = normalizeLooseText(address);

    if (/ditaires/.test(s)) return { ltd: 6.1687, lng: -75.6203 };
    if (/itagui/.test(s)) return { ltd: 6.1719, lng: -75.6114 };
    if (/sabaneta/.test(s)) return { ltd: 6.1515, lng: -75.6167 };
    if (/envigado/.test(s)) return { ltd: 6.17, lng: -75.5917 };
    if (/medellin/.test(s)) return { ltd: 6.2442, lng: -75.5812 };
    if (/bello/.test(s)) return { ltd: 6.3373, lng: -75.5579 };
    if (/copacabana/.test(s)) return { ltd: 6.3463, lng: -75.5089 };
    if (/la estrella/.test(s)) return { ltd: 6.1577, lng: -75.6432 };
    if (/girardota/.test(s)) return { ltd: 6.3778, lng: -75.4488 };
    if (/barbosa/.test(s) && /antioquia/.test(s)) return { ltd: 6.4381, lng: -75.3311 };
    if (/bogota/.test(s)) return { ltd: 4.711, lng: -74.0721 };
    if (/cali/.test(s)) return { ltd: 3.4516, lng: -76.532 };
    if (/barranquilla/.test(s)) return { ltd: 10.9685, lng: -74.7813 };
    if (/cartagena/.test(s)) return { ltd: 10.391, lng: -75.4794 };
    if (/colombia/.test(s)) return { ltd: 4.5709, lng: -74.2973 };

    return null;
}

async function geocodeWithoutGoogle(address) {
    const hint = roughCoordsForColombia(address);
    if (hint) return hint;

    throw new Error(
        `Unable to resolve "${address}". Configure GOOGLE_MAPS_SERVER_API or use a more specific Colombia address.`
    );
}

function buildLocalSuggestion(description, placeId) {
    return {
        description,
        place_id: placeId,
        structured_formatting: null,
        source: 'local',
    };
}

function getLocalCatalog() {
    return [
        'Itagüí, Antioquia, Colombia',
        'Ditaires, Itagüí, Antioquia, Colombia',
        'Centro de la Moda, Itagüí, Antioquia, Colombia',
        'Santa María, Itagüí, Antioquia, Colombia',
        'San Pío, Itagüí, Antioquia, Colombia',
        'Suramérica, Itagüí, Antioquia, Colombia',
        'Calatrava, Itagüí, Antioquia, Colombia',
        'Samaria, Itagüí, Antioquia, Colombia',
        'Sabaneta, Antioquia, Colombia',
        'Envigado, Antioquia, Colombia',
        'Medellín, Antioquia, Colombia',
        'Bello, Antioquia, Colombia',
        'Copacabana, Antioquia, Colombia',
        'La Estrella, Antioquia, Colombia',
        'Caldas, Antioquia, Colombia',
        'Girardota, Antioquia, Colombia',
        'Barbosa, Antioquia, Colombia',
        'El Poblado, Medellín, Antioquia, Colombia',
        'Laureles, Medellín, Antioquia, Colombia',
        'Belén, Medellín, Antioquia, Colombia',
        'Centro, Medellín, Antioquia, Colombia',
        'San Javier, Medellín, Antioquia, Colombia',
        'Robledo, Medellín, Antioquia, Colombia',
        'Castilla, Medellín, Antioquia, Colombia',
        'Buenos Aires, Medellín, Antioquia, Colombia',
        'Aranjuez, Medellín, Antioquia, Colombia',
        'Manrique, Medellín, Antioquia, Colombia',
        'Bogotá, Colombia',
        'Cali, Valle del Cauca, Colombia',
        'Barranquilla, Atlántico, Colombia',
        'Cartagena, Bolívar, Colombia',
    ];
}

function localSuggestionsForColombia(address) {
    const q = normalizeLooseText(address);
    if (!q || q.length < 2) return [];

    const catalog = getLocalCatalog();
    const queryParts = q.split(' ').filter(Boolean);

    const rows = catalog.map((item) => {
        const itemNorm = normalizeLooseText(item);

        let score = 0;
        if (itemNorm === q) score += 300;
        if (itemNorm.startsWith(q)) score += 180;
        if (itemNorm.includes(q)) score += 120;

        let matched = 0;
        for (const part of queryParts) {
            if (itemNorm.includes(part)) {
                matched += 1;
                score += part.length >= 4 ? 20 : 8;
            }
        }

        if (queryParts.length) {
            score += (matched / queryParts.length) * 100;
        }

        if (/ditaires/.test(itemNorm)) score += 25;
        if (/itagui/.test(itemNorm) && /itagui/.test(q)) score += 25;

        return { item, score };
    });

    const ranked = rows
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((r) =>
            buildLocalSuggestion(
                r.item,
                `local_${normalizeLooseText(r.item).replace(/\s+/g, '_')}`
            )
        );

    if (ranked.length > 0) return ranked;

    if (q.includes('ditaires')) {
        return [
            buildLocalSuggestion(
                'Ditaires, Itagüí, Antioquia, Colombia',
                'local_ditaires_itagui_antioquia_colombia'
            ),
        ];
    }

    if (q.includes('itagui')) {
        return [
            buildLocalSuggestion(
                'Itagüí, Antioquia, Colombia',
                'local_itagui_antioquia_colombia'
            ),
        ];
    }

    if (q.includes('medellin')) {
        return [
            buildLocalSuggestion(
                'Medellín, Antioquia, Colombia',
                'local_medellin_antioquia_colombia'
            ),
        ];
    }

    return [];
}

function looksLikeStreetAddress(text) {
    return (
        /\b(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\b/i.test(text) ||
        /\d/.test(text)
    );
}

function hasCountryContext(text) {
    return normalizeLooseText(text).includes('colombia');
}

function extractStreetType(text) {
    const s = normalizeLooseText(text);
    const m = s.match(/\b(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\b/);
    return m ? m[1] : '';
}

function extractNumbers(text) {
    return (String(text || '').match(/\d+/g) || []).map((n) => String(n));
}

function expandColombianStreetFormats(input) {
    const raw = normalizeAddressQuery(input);
    if (!raw) return [];

    const set = new Set([raw]);
    const t = raw.replace(/\s+/g, ' ').trim();

    let m = t.match(
        /^(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\s+(\d+)\s*([a-zA-Z])?\s+(\d+)\s+(\d+)\s*$/i
    );
    if (m) {
        const via = m[1];
        const n1 = m[2];
        const letra = (m[3] || '').toUpperCase();
        const n2 = m[4];
        const n3 = m[5];

        set.add(`${via} ${n1}${letra} # ${n2}-${n3}`);
        set.add(`${via} ${n1}${letra} #${n2}-${n3}`);
        set.add(`${via} ${n1}${letra} ${n2} ${n3}`);
    }

    m = t.match(
        /^(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\s+(\d+)\s*([a-zA-Z])?\s*#?\s*(\d+)\s*-?\s*(\d+)\s*$/i
    );
    if (m) {
        const via = m[1];
        const n1 = m[2];
        const letra = (m[3] || '').toUpperCase();
        const n2 = m[4];
        const n3 = m[5];

        set.add(`${via} ${n1}${letra} # ${n2}-${n3}`);
        set.add(`${via} ${n1}${letra} #${n2}-${n3}`);
        set.add(`${via} ${n1}${letra} ${n2} ${n3}`);
    }

    return [...set];
}

function buildSuggestionVariants(address) {
    const clean = normalizeAddressQuery(address);
    if (!clean) return [];

    const set = new Set();
    const streetVariants = expandColombianStreetFormats(clean);

    for (const item of streetVariants) {
        set.add(item);
    }

    if (!hasCountryContext(clean)) {
        for (const item of streetVariants) {
            set.add(`${item}, Colombia`);
        }
    }

    return [...set].slice(0, 6);
}

function buildCoordinateVariants(address) {
    const clean = normalizeAddressQuery(address);
    if (!clean) return [];

    const set = new Set();
    const streetVariants = expandColombianStreetFormats(clean);
    const streetLike = looksLikeStreetAddress(clean);
    const normalized = normalizeLooseText(clean);

    for (const item of streetVariants) {
        set.add(item);
    }

    if (!hasCountryContext(clean)) {
        for (const item of streetVariants) {
            set.add(`${item}, Colombia`);
        }
    }

    if (
        streetLike &&
        !/medellin|itagui|envigado|sabaneta|bello|bogota|cali|barranquilla|cartagena/.test(normalized)
    ) {
        const cities = [
            'Medellín, Antioquia, Colombia',
            'Itagüí, Antioquia, Colombia',
            'Envigado, Antioquia, Colombia',
            'Sabaneta, Antioquia, Colombia',
            'Bello, Antioquia, Colombia',
            'Bogotá, Colombia',
            'Cali, Colombia',
        ];

        for (const item of streetVariants) {
            for (const city of cities) {
                set.add(`${item}, ${city}`);
            }
        }
    }

    return [...set].slice(0, 20);
}

function pushUniqueSuggestion(results, seen, item) {
    const description = String(item?.description || '').trim();
    const placeId = String(item?.place_id || '').trim() || `synthetic:${description.toLowerCase()}`;

    if (!description) return;

    const key = `${description.toLowerCase()}|${placeId}`;
    if (seen.has(key)) return;

    seen.add(key);
    results.push({
        description,
        place_id: placeId,
        structured_formatting: item?.structured_formatting || null,
        source: item?.source || 'google',
    });
}

function isRelevantSuggestion(row, originalQuery) {
    const query = normalizeLooseText(originalQuery);
    const text = normalizeLooseText(row?.description || '');

    if (!query || !text) return false;

    const queryParts = query.split(' ').filter(Boolean);
    const streetQuery = looksLikeStreetAddress(originalQuery);
    const queryStreetType = extractStreetType(originalQuery);
    const queryNumbers = extractNumbers(originalQuery);

    let matchedParts = 0;
    for (const part of queryParts) {
        if (text.includes(part)) matchedParts += 1;
    }

    if (streetQuery) {
        if (queryStreetType && !text.includes(queryStreetType)) {
            return false;
        }

        if (queryNumbers.length > 0) {
            const textNumbers = extractNumbers(text);
            const sharedNumbers = queryNumbers.filter((n) => textNumbers.includes(n));

            if (sharedNumbers.length === 0) {
                return false;
            }
        }

        return matchedParts >= 1;
    }

    return matchedParts >= 1 || text.includes(query);
}

function filterRelevantSuggestions(rows, originalQuery) {
    return (Array.isArray(rows) ? rows : []).filter((row) =>
        isRelevantSuggestion(row, originalQuery)
    );
}

function rankSuggestions(rows, originalQuery) {
    const nq = normalizeLooseText(originalQuery);
    const parts = nq.split(' ').filter(Boolean);

    const score = (row) => {
        const text = normalizeLooseText(row?.description || '');
        let value = 0;

        if (text === nq) value += 200;
        if (text.startsWith(nq)) value += 120;
        if (text.includes(nq)) value += 80;

        let matched = 0;
        for (const part of parts) {
            if (text.includes(part)) {
                matched += 1;
                value += part.length >= 4 ? 18 : 8;
            }
        }

        if (parts.length) {
            value += (matched / parts.length) * 100;
        }

        if (looksLikeStreetAddress(originalQuery) && /\d/.test(text)) {
            value += 50;
        }

        if (row?.source === 'geocode') value += 20;
        if (row?.source === 'findplace') value += 15;
        if (row?.source === 'local') value -= 20;

        return value;
    };

    return [...rows].sort((a, b) => score(b) - score(a));
}

async function autocompleteSearch(variant) {
    const data = await googleGet('place/autocomplete/json', {
        input: variant,
        components: 'country:co',
        language: 'es',
        region: 'co',
    });

    console.log('[maps][autocomplete]', {
        variant,
        status: data?.status,
        error_message: data?.error_message || '',
        count: Array.isArray(data?.predictions) ? data.predictions.length : 0,
    });

    if (!Array.isArray(data?.predictions)) return [];

    return data.predictions.map((item) => ({
        description: item?.description || '',
        place_id: item?.place_id || '',
        structured_formatting: item?.structured_formatting || null,
        source: 'autocomplete',
    }));
}

async function geocodeSearch(variant) {
    const data = await googleGet('geocode/json', {
        address: variant,
        components: 'country:CO',
        language: 'es',
        region: 'co',
    });

    console.log('[maps][geocode]', {
        variant,
        status: data?.status,
        error_message: data?.error_message || '',
        count: Array.isArray(data?.results) ? data.results.length : 0,
    });

    if (!Array.isArray(data?.results)) return [];

    return data.results.slice(0, 8).map((item) => ({
        description: item?.formatted_address || '',
        place_id: item?.place_id || '',
        structured_formatting: item?.formatted_address
            ? { main_text: item.formatted_address, secondary_text: '' }
            : null,
        source: 'geocode',
    }));
}

async function findPlaceSearch(variant) {
    const data = await googleGet('place/findplacefromtext/json', {
        input: variant,
        inputtype: 'textquery',
        fields: 'place_id,formatted_address,name',
        language: 'es',
    });

    console.log('[maps][findplace]', {
        variant,
        status: data?.status,
        error_message: data?.error_message || '',
        count: Array.isArray(data?.candidates) ? data.candidates.length : 0,
    });

    if (!Array.isArray(data?.candidates)) return [];

    return data.candidates.slice(0, 8).map((item) => ({
        description: item?.formatted_address || item?.name || '',
        place_id: item?.place_id || '',
        structured_formatting: item?.name
            ? {
                  main_text: item.name,
                  secondary_text: item.formatted_address || '',
              }
            : null,
        source: 'findplace',
    }));
}

module.exports.getAddressCoordinates = async (address) => {
    const addrRaw = normalizeAddressQuery(address);
    if (!addrRaw) {
        throw new Error('Address is required');
    }

    const key = serverMapsKey();
    const variants = buildCoordinateVariants(addrRaw);
    const rough = roughCoordsForColombia(addrRaw);

    if (!key) {
        if (rough) return rough;
        return geocodeWithoutGoogle(addrRaw);
    }

    for (const variant of variants) {
        try {
            const results = await geocodeSearch(variant);
            const first = results[0];
            if (first?.description) {
                const geoData = await googleGet('geocode/json', {
                    address: first.description,
                    components: 'country:CO',
                    language: 'es',
                    region: 'co',
                });

                const loc = geoData?.results?.[0]?.geometry?.location;
                const lat = toNumber(loc?.lat);
                const lng = toNumber(loc?.lng);

                if (isValidLatLng(lat, lng)) {
                    return { ltd: lat, lng };
                }
            }
        } catch (error) {
            console.warn('[maps] getAddressCoordinates variant failed:', variant, error.message);
        }
    }

    if (rough) return rough;
    return geocodeWithoutGoogle(addrRaw);
};

module.exports.getDistance = async (origin, destination) => {
    const o = normalizeAddressQuery(origin);
    const d = normalizeAddressQuery(destination);

    if (!o || !d) {
        throw new Error('Origin and destination are required');
    }

    const key = serverMapsKey();

    if (key) {
        try {
            const data = await googleGet('distancematrix/json', {
                origins: o,
                destinations: d,
                language: 'es',
                region: 'co',
            });

            const element = data?.rows?.[0]?.elements?.[0];
            if (
                data?.status === 'OK' &&
                element?.status === 'OK' &&
                element?.distance?.value != null &&
                element?.duration?.value != null
            ) {
                return element;
            }
        } catch (error) {
            console.warn('[maps] distancematrix failed:', error.message);
        }
    }

    const from = await module.exports.getAddressCoordinates(origin);
    const to = await module.exports.getAddressCoordinates(destination);

    const meters = haversineMeters(from.ltd, from.lng, to.ltd, to.lng);
    if (!Number.isFinite(meters)) {
        throw new Error('Could not compute distance between locations');
    }

    return approxDistanceElement(meters);
};

module.exports.getSuggestions = async (address) => {
    const addr = normalizeAddressQuery(address);
    if (!addr || addr.length < 3) return [];

    const key = serverMapsKey();
    const results = [];
    const seen = new Set();
    const variants = buildSuggestionVariants(addr);

    console.log('[maps] getSuggestions variants:', variants);

    if (key) {
        for (const variant of variants) {
            try {
                const rows = await autocompleteSearch(variant);
                for (const row of rows) {
                    pushUniqueSuggestion(results, seen, row);
                }
            } catch (error) {
                console.warn('[maps] autocomplete failed:', variant, error.message);
            }
        }

        for (const variant of variants) {
            try {
                const rows = await findPlaceSearch(variant);
                for (const row of rows) {
                    pushUniqueSuggestion(results, seen, row);
                }
            } catch (error) {
                console.warn('[maps] findplace failed:', variant, error.message);
            }
        }

        for (const variant of variants) {
            try {
                const rows = await geocodeSearch(variant);
                for (const row of rows) {
                    pushUniqueSuggestion(results, seen, row);
                }
            } catch (error) {
                console.warn('[maps] geocode search failed:', variant, error.message);
            }
        }
    } else {
        console.warn('[maps] getSuggestions without Google key');
    }

    let filtered = filterRelevantSuggestions(results, addr);

    if (filtered.length === 0) {
        const fallback = localSuggestionsForColombia(addr);
        filtered = filterRelevantSuggestions(fallback, addr);
    }

    const ranked = rankSuggestions(filtered, addr).slice(0, 8);
    console.log('[maps] getSuggestions final count:', ranked.length);

    return ranked;
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radiusKm) => {
    const pickupLtd = toNumber(ltd);
    const pickupLng = toNumber(lng);
    const radiusKmSafe = Math.max(toNumber(radiusKm) || 0, 0);
    const radiusM = radiusKmSafe * 1000;

    if (!isValidLatLng(pickupLtd, pickupLng)) {
        console.warn('[maps] invalid pickup coordinates for radius search:', {
            pickupLtd,
            pickupLng,
            radiusKm,
        });
        return [];
    }

    if (!isColombiaCoordinate(pickupLtd, pickupLng)) {
        console.warn('[maps] pickup coordinate outside Colombia:', {
            pickupLtd,
            pickupLng,
            radiusKm,
        });
        return [];
    }

    const captains = await captainModel.find({
        status: 'active',
        socketId: { $exists: true, $ne: null },
        'location.ltd': { $exists: true, $ne: null },
        'location.lng': { $exists: true, $ne: null },
    });

    const nearbyCaptains = captains.filter((c) => {
        const captainLtd = toNumber(c.location?.ltd);
        const captainLng = toNumber(c.location?.lng);

        if (!isValidLatLng(captainLtd, captainLng)) return false;
        if (!isColombiaCoordinate(captainLtd, captainLng)) return false;

        const dist = haversineMeters(pickupLtd, pickupLng, captainLtd, captainLng);
        return Number.isFinite(dist) && dist <= radiusM;
    });

    return nearbyCaptains;
};