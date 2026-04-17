const axios = require('axios');
const captainModel = require('../models/captain.model');

console.log('🇨🇴🇨🇴🇨🇴 MAPS SERVICE COLOMBIA ACTIVO 🇨🇴🇨🇴🇨🇴');

const DEFAULT_CO_BIAS = {
    location: '6.2442,-75.5812', // Medellín
    radius: 70000, // cubre Medellín + Valle de Aburrá aprox
};

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

function normalizeLooseText(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[#,.;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function serverMapsKey() {
    return process.env.GOOGLE_MAPS_SERVER_API || process.env.GOOGLE_MAPS_API;
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

function roughCoordsForColombia(address) {
    console.log('🇨🇴 COLOMBIA FALLBACK ACTIVO:', address);

    const s = normalizeAddressQuery(address).toLowerCase();

    if (/itag[uü]i/.test(s)) return { ltd: 6.1719, lng: -75.6114 };
    if (/sabaneta/.test(s)) return { ltd: 6.1515, lng: -75.6167 };
    if (/envigado/.test(s)) return { ltd: 6.17, lng: -75.5917 };
    if (/medell[ií]n/.test(s)) return { ltd: 6.2442, lng: -75.5812 };
    if (/bello/.test(s)) return { ltd: 6.3373, lng: -75.5579 };
    if (/copacabana/.test(s)) return { ltd: 6.3463, lng: -75.5089 };
    if (/la estrella/.test(s)) return { ltd: 6.1577, lng: -75.6432 };
    if (/caldas/.test(s) && /antioquia/.test(s)) return { ltd: 6.0911, lng: -75.6357 };
    if (/girardota/.test(s)) return { ltd: 6.3778, lng: -75.4488 };
    if (/barbosa/.test(s) && /antioquia/.test(s)) return { ltd: 6.4381, lng: -75.3311 };
    if (/antioquia/.test(s)) return { ltd: 6.2442, lng: -75.5812 };
    if (/bogot[aá]/.test(s)) return { ltd: 4.711, lng: -74.0721 };
    if (/cali/.test(s)) return { ltd: 3.4516, lng: -76.532 };
    if (/barranquilla/.test(s)) return { ltd: 10.9685, lng: -74.7813 };
    if (/cartagena/.test(s)) return { ltd: 10.391, lng: -75.4794 };
    if (/colombia/.test(s)) return { ltd: 4.5709, lng: -74.2973 };

    return null;
}

async function geocodeWithoutGoogle(address) {
    const colombiaHint = roughCoordsForColombia(address);
    if (colombiaHint) {
        return colombiaHint;
    }

    throw new Error(
        `Unable to resolve "${address}". Configure GOOGLE_MAPS_SERVER_API or use a more specific Colombia address.`
    );
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

function buildLocalSuggestion(description, placeId) {
    return {
        description,
        place_id: placeId,
        structured_formatting: null,
    };
}

function localSuggestionsForColombia(address) {
    const q = normalizeAddressQuery(address).toLowerCase();
    if (!q || q.length < 3) return [];

    const catalog = [
        'Itagüí, Antioquia, Colombia',
        'Sabaneta, Antioquia, Colombia',
        'Envigado, Antioquia, Colombia',
        'Medellín, Antioquia, Colombia',
        'Bello, Antioquia, Colombia',
        'Copacabana, Antioquia, Colombia',
        'La Estrella, Antioquia, Colombia',
        'Caldas, Antioquia, Colombia',
        'Girardota, Antioquia, Colombia',
        'Barbosa, Antioquia, Colombia',
        'Bogotá, Colombia',
        'Cali, Valle del Cauca, Colombia',
        'Barranquilla, Atlántico, Colombia',
        'Cartagena, Bolívar, Colombia',
        'El Poblado, Medellín, Antioquia, Colombia',
        'Laureles, Medellín, Antioquia, Colombia',
        'Belén, Medellín, Antioquia, Colombia',
        'Centro, Medellín, Antioquia, Colombia',
        'San Javier, Medellín, Antioquia, Colombia',
        'Robledo, Medellín, Antioquia, Colombia',
    ];

    const normalizedQuery = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const starts = [];
    const contains = [];

    for (const item of catalog) {
        const itemNorm = item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (itemNorm.startsWith(normalizedQuery)) {
            starts.push(buildLocalSuggestion(item, `local_${itemNorm.replace(/\s+/g, '_')}`));
        } else if (itemNorm.includes(normalizedQuery)) {
            contains.push(buildLocalSuggestion(item, `local_${itemNorm.replace(/\s+/g, '_')}`));
        }
    }

    const combined = [...starts, ...contains];
    if (combined.length > 0) return combined.slice(0, 8);

    return [];
}

function looksLikeStreetAddress(addr) {
    return (
        /\b(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\b/i.test(addr) ||
        /\d/.test(addr)
    );
}

function hasKnownLocationContext(addr) {
    const normalized = normalizeLooseText(addr);
    return (
        normalized.includes('colombia') ||
        normalized.includes('antioquia') ||
        normalized.includes('medellin') ||
        normalized.includes('itagui') ||
        normalized.includes('envigado') ||
        normalized.includes('sabaneta') ||
        normalized.includes('bello') ||
        normalized.includes('bogota') ||
        normalized.includes('cali') ||
        normalized.includes('barranquilla') ||
        normalized.includes('cartagena')
    );
}

function formatColombianStreetAddress(addr) {
    let s = normalizeAddressQuery(addr);

    s = s.replace(/\bcalle\s+(\d+)\s+([a-z])\b/gi, 'Calle $1$2');
    s = s.replace(/\bcarrera\s+(\d+)\s+([a-z])\b/gi, 'Carrera $1$2');
    s = s.replace(/\bcl\s+(\d+)\s+([a-z])\b/gi, 'Calle $1$2');
    s = s.replace(/\bcra\s+(\d+)\s+([a-z])\b/gi, 'Carrera $1$2');

    s = s.replace(
        /\b(calle|cl|carrera|cra|cr|avenida|av|transversal|tv|diagonal|dg)\s+(\d+[a-z]?)\s+(\d+[a-z]?)\s+(\d+[a-z]?)\b/gi,
        (_, tipo, a, b, c) => `${tipo} ${a} # ${b}-${c}`
    );

    s = s.replace(/\s+#\s+/g, ' # ');
    s = s.replace(/\s+-\s+/g, '-');
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

function buildAddressVariants(addr) {
    const base = normalizeAddressQuery(addr);
    const formatted = formatColombianStreetAddress(base);
    const hasContext = hasKnownLocationContext(base);
    const street = looksLikeStreetAddress(base);

    const variants = [base];

    if (formatted && formatted !== base) {
        variants.push(formatted);
    }

    if (!hasContext) {
        variants.push(`${base}, Colombia`);
        if (formatted && formatted !== base) {
            variants.push(`${formatted}, Colombia`);
        }
    }

    if (!hasContext && street) {
        const cities = [
            'Medellín, Antioquia, Colombia',
            'Itagüí, Antioquia, Colombia',
            'Envigado, Antioquia, Colombia',
            'Sabaneta, Antioquia, Colombia',
            'Bello, Antioquia, Colombia',
            'Bogotá, Colombia',
            'Cali, Colombia',
        ];

        for (const city of cities) {
            variants.push(`${base}, ${city}`);
            if (formatted && formatted !== base) {
                variants.push(`${formatted}, ${city}`);
            }
        }
    }

    return [...new Set(variants)];
}

function buildBiasForAddress(addr) {
    const s = normalizeLooseText(addr);

    if (s.includes('bogota')) return { location: '4.7110,-74.0721', radius: 70000 };
    if (s.includes('cali')) return { location: '3.4516,-76.5320', radius: 70000 };
    if (s.includes('barranquilla')) return { location: '10.9685,-74.7813', radius: 70000 };
    if (s.includes('cartagena')) return { location: '10.3910,-75.4794', radius: 70000 };
    if (s.includes('itagui')) return { location: '6.1719,-75.6114', radius: 20000 };
    if (s.includes('envigado')) return { location: '6.1700,-75.5917', radius: 20000 };
    if (s.includes('sabaneta')) return { location: '6.1515,-75.6167', radius: 20000 };
    if (s.includes('bello')) return { location: '6.3373,-75.5579', radius: 30000 };
    if (s.includes('medellin') || s.includes('antioquia')) return { location: '6.2442,-75.5812', radius: 70000 };

    return DEFAULT_CO_BIAS;
}

module.exports.getAddressCoordinates = async (address) => {
    const addrRaw = normalizeAddressQuery(address);
    if (!addrRaw) {
        throw new Error('Address is required');
    }

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
            if (roughCo) return roughCo;
            return await geocodeWithoutGoogle(addrRaw);
        }

        if (data.status === 'OK' && data.results?.length) {
            const loc = data.results[0]?.geometry?.location;
            const lat = toNumber(loc?.lat);
            const lng = toNumber(loc?.lng);

            if (isValidLatLng(lat, lng)) {
                return { ltd: lat, lng };
            }
        }

        if (roughCo) return roughCo;
        return await geocodeWithoutGoogle(addrRaw);
    } catch (error) {
        const status = error?.response?.status;

        if (status === 429 || status === 403) {
            if (roughCo) return roughCo;
            return await geocodeWithoutGoogle(addrRaw);
        }

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
                    console.warn('[maps] Distance Matrix rate limited — using Colombia estimate');
                } else {
                    const em = err?.response?.data?.error_message || err?.message;
                    console.warn('[maps] Distance Matrix request error:', em);
                }
            }
        } else {
            console.warn('[maps] No Google server key; using Colombia estimate');
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
    const results = [];
    const seen = new Set();

    const pushSuggestion = (item) => {
        const description = String(item?.description || '').trim();
        const placeId = String(item?.place_id || '').trim();

        if (!description) return;

        const dedupeKey = `${description.toLowerCase()}|${placeId}`;
        if (seen.has(dedupeKey)) return;

        seen.add(dedupeKey);
        results.push({
            description,
            place_id: placeId,
            structured_formatting: item?.structured_formatting || null,
        });
    };

    const variants = buildAddressVariants(addr);
    const bias = buildBiasForAddress(addr);

    if (key) {
        for (const variant of variants) {
            try {
                const { data } = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                    {
                        params: {
                            input: variant,
                            key,
                            components: 'country:co',
                            language: 'es',
                            location: bias.location,
                            radius: bias.radius,
                            strictbounds: false,
                            types: 'geocode',
                        },
                        timeout: 15000,
                    }
                );

                console.log('[maps] autocomplete geocode query:', variant);
                console.log('[maps] autocomplete geocode status:', data?.status);
                console.log('[maps] autocomplete geocode predictions:', data?.predictions?.length || 0);

                if (data?.status === 'OK' && Array.isArray(data.predictions)) {
                    for (const item of data.predictions) {
                        pushSuggestion({
                            description: item?.description || '',
                            place_id: item?.place_id || '',
                            structured_formatting: item?.structured_formatting || null,
                        });
                    }
                }
            } catch (error) {
                console.error('[maps] autocomplete geocode error:', variant, error.message);
            }
        }

        for (const variant of variants) {
            try {
                const { data } = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
                    {
                        params: {
                            input: variant,
                            key,
                            components: 'country:co',
                            language: 'es',
                            location: bias.location,
                            radius: bias.radius,
                            strictbounds: false,
                        },
                        timeout: 15000,
                    }
                );

                console.log('[maps] autocomplete broad query:', variant);
                console.log('[maps] autocomplete broad status:', data?.status);
                console.log('[maps] autocomplete broad predictions:', data?.predictions?.length || 0);

                if (data?.status === 'OK' && Array.isArray(data.predictions)) {
                    for (const item of data.predictions) {
                        pushSuggestion({
                            description: item?.description || '',
                            place_id: item?.place_id || '',
                            structured_formatting: item?.structured_formatting || null,
                        });
                    }
                }
            } catch (error) {
                console.error('[maps] autocomplete broad error:', variant, error.message);
            }
        }

        for (const variant of variants) {
            try {
                const { data } = await axios.get(
                    'https://maps.googleapis.com/maps/api/place/textsearch/json',
                    {
                        params: {
                            query: variant,
                            key,
                            language: 'es',
                            region: 'co',
                            location: bias.location,
                            radius: bias.radius,
                        },
                        timeout: 15000,
                    }
                );

                console.log('[maps] textsearch query:', variant);
                console.log('[maps] textsearch status:', data?.status);
                console.log('[maps] textsearch results:', data?.results?.length || 0);

                if (data?.status === 'OK' && Array.isArray(data.results)) {
                    for (const item of data.results.slice(0, 8)) {
                        pushSuggestion({
                            description:
                                item?.formatted_address ||
                                [item?.name, item?.vicinity].filter(Boolean).join(', ') ||
                                item?.name ||
                                '',
                            place_id: item?.place_id || '',
                            structured_formatting: item?.name
                                ? {
                                      main_text: item.name,
                                      secondary_text: item.formatted_address || item.vicinity || '',
                                  }
                                : null,
                        });
                    }
                }
            } catch (error) {
                console.error('[maps] textsearch error:', variant, error.message);
            }
        }

        if (results.length === 0) {
            for (const variant of variants) {
                try {
                    const geoData = await googleMapsFormPost('geocode/json', {
                        address: variant,
                        components: 'country:CO',
                    });

                    console.log('[maps] geocode fallback query:', variant);
                    console.log('[maps] geocode fallback status:', geoData?.status);
                    console.log('[maps] geocode fallback results:', geoData?.results?.length || 0);

                    if (geoData?.status === 'OK' && Array.isArray(geoData.results)) {
                        for (const item of geoData.results.slice(0, 8)) {
                            pushSuggestion({
                                description: item?.formatted_address || '',
                                place_id: item?.place_id || '',
                                structured_formatting: null,
                            });
                        }
                    }
                } catch (error) {
                    console.error('[maps] geocode fallback suggestions error:', variant, error.message);
                }
            }
        }
    } else {
        console.warn('[maps] getSuggestions without Google key — usando fallback local');
    }

    if (results.length > 0) {
        console.log('[maps] final suggestions:', results.length);
        return results.slice(0, 8);
    }

    const fallback = localSuggestionsForColombia(addr);
    console.log('[maps] local fallback suggestions:', fallback.length);
    return fallback;
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

    console.log('[maps] searching captains in radius:', {
        pickupLtd,
        pickupLng,
        radiusKm: radiusKmSafe,
    });

    const captains = await captainModel.find({
        status: 'active',
        socketId: { $exists: true, $ne: null },
        'location.ltd': { $exists: true, $ne: null },
        'location.lng': { $exists: true, $ne: null },
    });

    console.log('[maps] active captains with socket and location:', captains.length);

    const nearbyCaptains = captains.filter((c) => {
        const captainLtd = toNumber(c.location?.ltd);
        const captainLng = toNumber(c.location?.lng);

        if (!isValidLatLng(captainLtd, captainLng)) {
            console.warn('[maps] skipping captain with invalid coordinates:', {
                captainId: String(c._id),
                socketId: c.socketId || null,
                captainLtd: c.location?.ltd,
                captainLng: c.location?.lng,
            });
            return false;
        }

        if (!isColombiaCoordinate(captainLtd, captainLng)) {
            console.warn('[maps] skipping captain outside Colombia bounds:', {
                captainId: String(c._id),
                socketId: c.socketId || null,
                captainLtd,
                captainLng,
            });
            return false;
        }

        const dist = haversineMeters(pickupLtd, pickupLng, captainLtd, captainLng);
        const isInside = Number.isFinite(dist) && dist <= radiusM;

        console.log('[maps] captain distance check:', {
            captainId: String(c._id),
            socketId: c.socketId || null,
            captainLtd,
            captainLng,
            distanceMeters: Number.isFinite(dist) ? Math.round(dist) : null,
            insideRadius: isInside,
        });

        return isInside;
    });

    console.log('[maps] nearby captains found:', nearbyCaptains.length);

    return nearbyCaptains;
};