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
        /* ignore */
    }
    t = t.replace(/\bKitashinagawa\b/gi, 'Kita-Shinagawa');
    t = t.replace(/\bMinamishinagawa\b/gi, 'Minami-Shinagawa');
    return t.trim();
}

/** POI + structured address — geocoders work better from the street / chome segment onward. */
function stripLeadingVenueBeforeChome(s) {
    const t = String(s).trim();
    if (!t) return t;
    const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return t;

    const chomeIdx = parts.findIndex(
        (p) => /\d+\s*Chome\b/i.test(p) || (/Chome\b/i.test(p) && /\d/.test(p))
    );
    if (chomeIdx > 0) return parts.slice(chomeIdx).join(', ');

    // International: first part that looks like a numbered street/building line (skip venue name).
    const streetLine = (p) =>
        /^\d+[a-z]?\s+/i.test(p) ||
        /^(\d+\s*-\s*)+\d+/i.test(p) ||
        /\b(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Close|Court|Ct\.?|Place|Pl\.?|Crescent|Terrace|Alley|Route|Rte\.?|Highway|Hwy\.?)\b/i.test(
            p
        );
    const streetIdx = parts.findIndex(streetLine);
    if (streetIdx > 0) return parts.slice(streetIdx).join(', ');

    return t;
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
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function nominatimGeocode(address) {
    try {
        const ua =
            process.env.NOMINATIM_USER_AGENT ||
            'UberClone/1.0 (ride demo; contact: https://github.com/K-Daksh/UberClone)';
        const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
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

/** ASCII-ish form for geocoders that choke on rare Unicode normalization (e.g. ō, ligatures). */
function stripCombiningMarks(s) {
    try {
        return String(s).normalize('NFD').replace(/\p{M}/gu, '');
    } catch {
        return String(s);
    }
}

/** Photon (Komoot) — OSM-based forward geocoding; works worldwide for streets without an API key. */
async function photonGeocode(address) {
    const raw = String(address).trim();
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    const attempts = [];
    const push = (s) => {
        const t = String(s).trim();
        if (t.length < 3) return;
        const clipped = t.length > 400 ? t.slice(0, 400).trim() : t;
        if (clipped.length >= 3) attempts.push(clipped);
    };
    push(raw);
    const asciiLoose = stripCombiningMarks(raw);
    if (asciiLoose !== raw) push(asciiLoose);
    if (parts.length >= 2) push(parts.slice(-4).join(', '));
    if (parts.length >= 2) push(parts.slice(-3).join(', '));
    if (parts.length >= 2) push(parts.slice(-2).join(', '));
    if (parts.length >= 2) {
        const tail3 = stripCombiningMarks(parts.slice(-3).join(', '));
        if (tail3 !== parts.slice(-3).join(', ')) push(tail3);
    }
    const noCjk = stripCombiningMarks(raw)
        .replace(/[\u3040-\u30ff\u3400-\u9fff]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (noCjk.length >= 8 && noCjk !== raw) push(noCjk);
    if (parts.length >= 2) {
        const tailNoCjk = parts
            .slice(-3)
            .join(', ')
            .replace(/[\u3040-\u30ff\u3400-\u9fff]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (tailNoCjk.length >= 8) push(tailNoCjk);
    }

    // Photon only accepts default | de | en | fr (not ja); en works fine for worldwide OSM data.
    const lang = 'en';
    const ua =
        process.env.NOMINATIM_USER_AGENT ||
        'UberClone/1.0 (ride demo; contact: https://github.com/K-Daksh/UberClone)';
    const seen = new Set();
    let lastErr;
    for (const q of attempts) {
        if (seen.has(q)) continue;
        seen.add(q);
        try {
            const { data } = await axios.get('https://photon.komoot.io/api/', {
                params: { q, lang, limit: 5 },
                timeout: 20000,
                headers: { 'User-Agent': ua },
                maxContentLength: 10 * 1024 * 1024,
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
            const st = e?.response?.status;
            lastErr = e;
            if (st === 400 || st === 414 || st === 413) {
                console.warn('[maps] Photon retry (bad query length?):', q.slice(0, 72));
                continue;
            }
            if (st === 429) {
                throw e;
            }
            throw e;
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('PHOTON_NO_RESULTS');
}

const LAST_SEGMENT_COUNTRY_ISO2 = new Map(
    Object.entries({
        japan: 'JP',
        '日本': 'JP',
        china: 'CN',
        '中国': 'CN',
        'united states': 'US',
        usa: 'US',
        'united kingdom': 'GB',
        uk: 'GB',
        england: 'GB',
        scotland: 'GB',
        wales: 'GB',
        france: 'FR',
        germany: 'DE',
        deutschland: 'DE',
        spain: 'ES',
        españa: 'ES',
        italy: 'IT',
        italia: 'IT',
        brazil: 'BR',
        brasil: 'BR',
        mexico: 'MX',
        méxico: 'MX',
        canada: 'CA',
        australia: 'AU',
        india: 'IN',
        'south korea': 'KR',
        korea: 'KR',
        netherlands: 'NL',
        belgium: 'BE',
        switzerland: 'CH',
        austria: 'AT',
        österreich: 'AT',
        poland: 'PL',
        polska: 'PL',
        portugal: 'PT',
        sweden: 'SE',
        norway: 'NO',
        denmark: 'DK',
        finland: 'FI',
        ireland: 'IE',
        'new zealand': 'NZ',
        singapore: 'SG',
        thailand: 'TH',
        vietnam: 'VN',
        indonesia: 'ID',
        philippines: 'PH',
        malaysia: 'MY',
        argentina: 'AR',
        chile: 'CL',
        colombia: 'CO',
        turkey: 'TR',
        'türkiye': 'TR',
        russia: 'RU',
        ukraine: 'UA',
        israel: 'IL',
        'south africa': 'ZA',
        egypt: 'EG',
        nigeria: 'NG',
        kenya: 'KE',
        'saudi arabia': 'SA',
        'united arab emirates': 'AE',
        uae: 'AE',
        pakistan: 'PK',
        bangladesh: 'BD',
    }).map(([k, v]) => [k.toLowerCase(), v])
);

function inferCountryCodeForOpenMeteo(addr) {
    const s = String(addr);
    if (/\bJapan\b|\bTokyo\b|日本|東京|東京都|大阪|京都|北海道|沖縄|名古屋|福岡|Shinagawa|品川/i.test(s))
        return 'JP';
    if (/\bChina\b|中国/i.test(s)) return 'CN';
    if (/\bUSA\b|\bUS\b|, [A-Z]{2}\s*\d{5}|United States/i.test(s)) return 'US';
    if (/\bUK\b|United Kingdom|England|Scotland|Wales/i.test(s)) return 'GB';

    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    const last = (parts[parts.length - 1] || '').toLowerCase();
    if (last && LAST_SEGMENT_COUNTRY_ISO2.has(last)) {
        return LAST_SEGMENT_COUNTRY_ISO2.get(last);
    }
    return undefined;
}

/** Bare country names break Open-Meteo when combined with the same countryCode filter (no "Japan" city inside JP). */
function countryOrRegionCentroid(addr) {
    const t = String(addr).trim();
    const key = t.toLowerCase();
    const table = [
        [/^japan$|^日本$/i, 36.2048, 138.2529],
        [/^china$|^中国$/i, 35.8617, 104.1954],
        [/^usa$|^united states$|^u\.s\.a\.?$/i, 39.8283, -98.5795],
        [/^uk$|^united kingdom$|^britain$/i, 55.3781, -3.436],
        [/^france$/i, 46.2276, 2.2137],
        [/^germany$|^deutschland$/i, 51.1657, 10.4515],
        [/^india$/i, 20.5937, 78.9629],
        [/^brazil$/i, -14.235, -51.9253],
        [/^australia$/i, -25.2744, 133.7751],
        [/^canada$/i, 56.1304, -106.3468],
        [/^mexico$/i, 23.6345, -102.5528],
        [/^korea$|^south korea$/i, 35.9078, 127.7669],
    ];
    for (const [re, ltd, lng] of table) {
        if (re.test(t) || re.test(key)) {
            return { ltd, lng };
        }
    }
    return null;
}

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
        try {
            const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
                params,
                timeout: 15000,
            });
            return data || {};
        } catch (e) {
            const st = e?.response?.status;
            if (st === 400 || st === 404 || st === 422) {
                console.warn('[maps] Open-Meteo query skipped:', q.slice(0, 90), st);
                return {};
            }
            throw e;
        }
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

    // Country-only queries (e.g. "Japan") return nothing if name is filtered by the same countryCode — search globally first.
    const looksLikeCountryOnly =
        /^[a-z]{2,20}$/i.test(full.trim()) || /^[\u4e00-\u9fff]{1,4}$/.test(full.trim());
    let results =
        countryCode && looksLikeCountryOnly && full.length <= 24
            ? await collectResults(false)
            : await collectResults(true);
    if (!results.length && countryCode) {
        results = await collectResults(false);
    }
    if (!results.length && countryCode === 'JP' && !/\bJapan\b|日本/i.test(full)) {
        const bumped = `${full}, Japan`;
        let data = await search(bumped, true);
        results = Array.isArray(data?.results) ? data.results : [];
        if (!results.length) {
            data = await search(bumped, false);
            results = Array.isArray(data?.results) ? data.results : [];
        }
    }

    if (!results.length) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }

    let r = results[0];
    const hint = full.toLowerCase();
    if (
        /shinagawa|kita-shinagawa|kitashinagawa|minami-shinagawa|hiromachi|北品川|南品川|品川|広町/i.test(
            hint
        )
    ) {
        const hit = results.find((x) =>
            /shinagawa|品川|hiromachi|広町|kitashinagawa/i.test(
                `${x.name || ''} ${x.admin1 || ''} ${x.admin2 || ''} ${x.admin3 || ''} ${x.admin4 || ''}`
            )
        );
        if (hit) r = hit;
    }

    if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) {
        throw new Error('Unable to resolve address (Open-Meteo)');
    }
    if (
        r.country_code === 'JP' &&
        /tokyo|東京|shinagawa|品川|140-0001|140-0002|kita-shinagawa|hiromachi/i.test(hint)
    ) {
        const lat = r.latitude;
        const lng = r.longitude;
        const inKanto = lat >= 35.05 && lat <= 35.95 && lng >= 139.35 && lng <= 140.2;
        if (!inKanto) {
            const fix = roughCoordsForDenseAreaHints(full);
            if (fix) {
                console.warn('[maps] Open-Meteo matched wrong region; using Tokyo-area estimate');
                return fix;
            }
        }
    }
    return { ltd: r.latitude, lng: r.longitude };
}

/**
 * When Open-Meteo returns the wrong global "Shinagawa" or empty, use a ward-level point for Tokyo 品川 area demos.
 */
function roughCoordsForDenseAreaHints(addr) {
    const s = String(addr);
    const lower = s.toLowerCase();
    const jpHint =
        /tokyo|東京|japan|日本|shinagawa|品川|setagaya|世田谷|kasuya|粕谷|kita-shinagawa|minami-shinagawa|kitashinagawa|hiromachi|大井|大崎|戸越|chome|丁目|140-0001|140-0002|140-0003|140-0004|154-?00/i.test(
            s
        );
    if (!jpHint) return null;
    if (/setagaya|世田谷|kasuya|粕谷/i.test(s)) {
        return { ltd: 35.6464, lng: 139.6532 };
    }
    if (/shinagawa|品川|kita-shinagawa|minami-shinagawa|kitashinagawa|140-0001|140-0002|140-0003|140-0004|hiromachi|大井|大崎|nishi|西大井|ōi|doi[0-9]/i.test(s)) {
        return { ltd: 35.6057, lng: 139.7276 };
    }
    if (/tokyo|東京|chome|丁目|\bjapan\b|日本/.test(lower)) {
        return { ltd: 35.6812, lng: 139.7671 };
    }
    return null;
}

/** Last resort: any Tokyo metro–looking free text (school names, odd romaji) still gets a usable point. */
function roughTokyoMetroFallback(addr) {
    const s = String(addr);
    if (!/tokyo|東京|japan|日本|setagaya|世田谷|shinagawa|品川|多摩|調布|chome|丁目|ku|区|154|141|140-?/i.test(s)) {
        return null;
    }
    if (/setagaya|世田谷|kasuya|粕谷|上野毛|二子玉川/i.test(s)) {
        return { ltd: 35.6464, lng: 139.6532 };
    }
    if (/shinagawa|品川|大井|大崎|五反田|田町|高輪|港南|oimachi|大井町/i.test(s)) {
        return { ltd: 35.6057, lng: 139.7276 };
    }
    return { ltd: 35.6762, lng: 139.6503 };
}

/** Open-Meteo + optional Nominatim only — never calls Google (avoids recursion with getAddressCoordinates). */
async function geocodeWithoutGoogle(address) {
    const centroid = countryOrRegionCentroid(address);
    if (centroid) {
        return centroid;
    }
    try {
        return await openMeteoGeocode(address);
    } catch (err) {
        console.warn('[maps] Open-Meteo failed:', err.message);
    }
    try {
        return await photonGeocode(address);
    } catch (err) {
        console.warn('[maps] Photon failed:', err.message);
    }
    if (process.env.MAPS_ENABLE_NOMINATIM === '1') {
        try {
            return await nominatimGeocode(address);
        } catch (err) {
            console.warn('[maps] Nominatim failed:', err.message);
        }
    }
    const lastChance = roughCoordsForDenseAreaHints(address);
    if (lastChance) return lastChance;
    const metro = roughTokyoMetroFallback(address);
    if (metro) {
        console.warn('[maps] Using Tokyo-metro coarse coordinates (geocoding APIs unavailable or rate-limited)');
        return metro;
    }
    throw new Error(
        `Unable to resolve "${address}". Try a more specific place (city + country), or set GOOGLE_MAPS_SERVER_API on the server.`
    );
}

function approxDistanceElement(straightLineMeters) {
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

module.exports.getAddressCoordinates = async (address) => {
    const addr = stripLeadingVenueBeforeChome(normalizeAddressQuery(address));
    if (!addr) {
        throw new Error('Address is required');
    }
    const key = serverMapsKey();
    if (!key) {
        return geocodeWithoutGoogle(addr);
    }
    try {
        const data = await googleMapsFormPost('geocode/json', { address: addr });

        if (isGoogleHardFail(data)) {
            console.warn('[maps] Geocoding status', data.status, '— Open-Meteo fallback');
            return geocodeWithoutGoogle(addr);
        }
        if (data.status === 'OK' && data.results?.length) {
            const loc = data.results[0]?.geometry?.location;
            const lat = loc?.lat;
            const lng = loc?.lng;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { ltd: lat, lng };
            }
        }
        return geocodeWithoutGoogle(addr);
    } catch (error) {
        const status = error?.response?.status;
        if (status === 429 || status === 403) {
            console.warn('[maps] Geocoding HTTP', status, '— Open-Meteo fallback');
            return geocodeWithoutGoogle(addr);
        }
        if (error instanceof Error && !error.response) {
            if (error.name === 'TypeError' || error.name === 'ReferenceError') {
                console.error('[maps] geocode unexpected:', error);
                return geocodeWithoutGoogle(addr);
            }
            const m = error.message || '';
            const isAxiosFail =
                error.code === 'ECONNABORTED' ||
                error.code === 'ENOTFOUND' ||
                error.code === 'ECONNRESET' ||
                /timeout|Request failed with status code|Network Error/i.test(m);
            if (isAxiosFail) {
                console.warn('[maps] geocode network — Open-Meteo fallback');
                return geocodeWithoutGoogle(addr);
            }
        }
        console.warn('[maps] geocode — Open-Meteo fallback:', error?.message);
        return geocodeWithoutGoogle(addr);
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
            console.warn('[maps] No Google server key; estimating distance via fallbacks');
        }

        const from = await module.exports.getAddressCoordinates(o);
        const to = await module.exports.getAddressCoordinates(d);
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
    const key = serverMapsKey();
    if (!key) {
        return [];
    }
    try {
        const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input: addr,
                key,
            },
            timeout: 15000,
        });

        if (data.status === 'OK' && data.predictions) {
            return data.predictions;
        }
        return [];
    } catch (error) {
        console.error('[maps] suggestions:', error.message);
        return [];
    }
};

module.exports.getCaptainsInTheRadius = async (ltd, lng, radiusKm) => {
    const radiusM = radiusKm * 1000;
    const captains = await captainModel.find({
        status: 'active',
        'location.ltd': { $exists: true, $ne: null },
        'location.lng': { $exists: true, $ne: null },
    });

    return captains.filter((c) => {
        const dist = haversineMeters(ltd, lng, c.location.ltd, c.location.lng);
        return dist <= radiusM;
    });
};
