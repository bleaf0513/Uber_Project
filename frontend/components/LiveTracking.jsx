import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GoogleMap,
  Marker,
  Circle,
  OverlayView,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useGoogleMapsScript } from "../src/context/GoogleMapsLoadContext";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const DEFAULT_CENTER = {
  lat: 6.2442,
  lng: -75.5812,
};

const CENTRAL_GO_PURPLE = "#7c1fd1";
const CENTRAL_GO_DARK = "#2a064f";
const CENTRAL_GO_LIGHT = "#a855f7";

const mapStyles = [
  {
    featureType: "poi",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
];

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const roundCoord = (value, digits = 5) => {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(digits)) : null;
};

const normalizeLatLngFromDriver = (driver) => {
  const lat =
    toFiniteNumber(driver?.lat) ??
    toFiniteNumber(driver?.location?.lat) ??
    toFiniteNumber(driver?.location?.ltd) ??
    toFiniteNumber(driver?.coordinates?.lat) ??
    toFiniteNumber(driver?.coords?.lat) ??
    toFiniteNumber(driver?.coords?.ltd);

  const lng =
    toFiniteNumber(driver?.lng) ??
    toFiniteNumber(driver?.location?.lng) ??
    toFiniteNumber(driver?.coordinates?.lng) ??
    toFiniteNumber(driver?.coords?.lng);

  if (lat == null || lng == null) return null;

  return { lat, lng };
};

const LiveTracking = ({
  pickup = "",
  destination = "",
  routeStops = [],
  nearbyDrivers = [],
  showPickupRadar = true,
  zoom = 15,
  autoFetchNearbyDrivers = true,
  nearbyDriversRefreshMs = 8000,
  selectedCaptainId = null,
  showRouteToPickup = false,
  onEtaUpdate = null,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const [currentPosition, setCurrentPosition] = useState(null);
  const [pickupPosition, setPickupPosition] = useState(null);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [stopPositions, setStopPositions] = useState([]);

  const [fetchedDrivers, setFetchedDrivers] = useState([]);
  const [error, setError] = useState(null);
  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [map, setMap] = useState(null);

  const [pulseRadiusA, setPulseRadiusA] = useState(140);
  const [pulseRadiusB, setPulseRadiusB] = useState(260);

  const [directions, setDirections] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [distanceText, setDistanceText] = useState("");

  const watchIdRef = useRef(null);
  const driversIntervalRef = useRef(null);
  const geocoderRequestIdRef = useRef(0);
  const directionsRequestIdRef = useRef(0);

  const hasAutoFittedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef(null);
  const lastFocusKeyRef = useRef("");

  const apiBase = getApiBaseUrl();

  const safeRouteStops = useMemo(() => {
    return (Array.isArray(routeStops) ? routeStops : [])
      .map((stop) => String(stop || "").trim())
      .filter(Boolean);
  }, [routeStops]);

  const hasUserRoute = Boolean(
    pickup &&
      String(pickup).trim().length >= 3 &&
      destination &&
      String(destination).trim().length >= 3
  );

  const mapOptions = useMemo(
    () => ({
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      rotateControl: false,
      clickableIcons: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID",
      styles: mapStyles,
      gestureHandling: "greedy",
    }),
    []
  );

  const mergedNearbyDrivers = useMemo(() => {
    if (Array.isArray(nearbyDrivers) && nearbyDrivers.length > 0) {
      return nearbyDrivers;
    }

    return fetchedDrivers;
  }, [nearbyDrivers, fetchedDrivers]);

  const safeNearbyDrivers = useMemo(() => {
    return (Array.isArray(mergedNearbyDrivers) ? mergedNearbyDrivers : [])
      .map((driver, index) => {
        const coords = normalizeLatLngFromDriver(driver);
        if (!coords) return null;

        const id =
          driver?._id ||
          driver?.captainId ||
          driver?.id ||
          `driver-${index}`;

        const rawName = driver?.name || driver?.fullname || driver?.fullName;

        const name =
          typeof rawName === "string"
            ? rawName
            : rawName?.firstname || rawName?.lastname
            ? [rawName?.firstname, rawName?.lastname].filter(Boolean).join(" ")
            : "Conductor activo";

        return {
          id: String(id),
          lat: coords.lat,
          lng: coords.lng,
          rotation:
            toFiniteNumber(driver?.heading) ??
            toFiniteNumber(driver?.rotation) ??
            0,
          name,
          vehicleType:
            driver?.vehicleType ||
            driver?.vehicle?.vehicleType ||
            driver?.vehicle ||
            "car",
        };
      })
      .filter(Boolean);
  }, [mergedNearbyDrivers]);

  const selectedDriver = useMemo(() => {
    if (!selectedCaptainId) return safeNearbyDrivers[0] || null;

    return (
      safeNearbyDrivers.find((d) => String(d.id) === String(selectedCaptainId)) ||
      null
    );
  }, [safeNearbyDrivers, selectedCaptainId]);

  const routeOrigin = useMemo(() => {
    if (selectedDriver) {
      return {
        lat: selectedDriver.lat,
        lng: selectedDriver.lng,
        id: selectedDriver.id,
        name: selectedDriver.name,
        rotation: selectedDriver.rotation,
        isDriver: true,
      };
    }

    if (showRouteToPickup && currentPosition) {
      return {
        lat: currentPosition.lat,
        lng: currentPosition.lng,
        id: "current-driver-position",
        name: "Mi ubicación",
        rotation: 0,
        isDriver: false,
      };
    }

    return null;
  }, [selectedDriver, currentPosition, showRouteToPickup]);

  const stableMapFocusKey = useMemo(() => {
    return JSON.stringify({
      pickup: pickupPosition
        ? {
            lat: roundCoord(pickupPosition.lat),
            lng: roundCoord(pickupPosition.lng),
          }
        : null,
      destination: destinationPosition
        ? {
            lat: roundCoord(destinationPosition.lat),
            lng: roundCoord(destinationPosition.lng),
          }
        : null,
      stops: stopPositions.map((stop) => ({
        lat: roundCoord(stop.lat),
        lng: roundCoord(stop.lng),
      })),
      routeOrigin: routeOrigin
        ? {
            lat: roundCoord(routeOrigin.lat),
            lng: roundCoord(routeOrigin.lng),
          }
        : null,
      routeToPickup: Boolean(showRouteToPickup),
      selectedCaptainId: selectedCaptainId ? String(selectedCaptainId) : null,
      selectedDriverId: selectedDriver?.id || null,
      mode: showRouteToPickup
        ? "route-to-pickup"
        : hasUserRoute
        ? "user-route"
        : showPickupRadar
        ? "searching-driver"
        : "normal",
    });
  }, [
    pickupPosition,
    destinationPosition,
    stopPositions,
    routeOrigin,
    selectedCaptainId,
    selectedDriver?.id,
    showRouteToPickup,
    showPickupRadar,
    hasUserRoute,
  ]);

  const markUserInteraction = () => {
    isUserInteractingRef.current = true;

    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 4000);
  };

  const handleMapLoad = (mapInstance) => {
    setMap(mapInstance);

    if (currentPosition) {
      mapInstance.setCenter(currentPosition);
      mapInstance.setZoom(zoom);
    } else {
      mapInstance.setCenter(DEFAULT_CENTER);
      mapInstance.setZoom(zoom);
    }
  };

  useEffect(() => {
    hasAutoFittedRef.current = false;
    lastFocusKeyRef.current = "";
  }, [stableMapFocusKey]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("La geolocalización no es compatible con este navegador.");
      setIsGeolocationAvailable(false);
      setIsLoading(false);
      return;
    }

    const handlePositionUpdate = (position) => {
      const { latitude, longitude } = position.coords;

      setCurrentPosition({
        lat: latitude,
        lng: longitude,
      });

      setIsLoading(false);
      setError(null);
    };

    const handleGeoError = (err) => {
      const code = err?.code;
      let customMessage = "No se pudo obtener la ubicación.";

      if (code === 1) {
        customMessage = "Permiso de ubicación denegado.";
      } else if (code === 2) {
        customMessage = "Ubicación no disponible.";
      } else if (code === 3) {
        customMessage = "La ubicación tardó demasiado en responder.";
      }

      setError(`${customMessage} (${err?.message || "sin detalle"})`);
      setIsLoading(false);
      console.error("Geolocation error:", err);
    };

    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      handleGeoError,
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 3000,
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeoError,
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 3000,
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const geocodeAddress = (geocoder, address) => {
    return new Promise((resolve) => {
      if (!address || String(address).trim().length < 3) {
        resolve(null);
        return;
      }

      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const location = results[0].geometry.location;

          resolve({
            lat: location.lat(),
            lng: location.lng(),
            address,
          });
        } else {
          console.warn("[LiveTracking] No se pudo geocodificar:", address, status);
          resolve(null);
        }
      });
    });
  };

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps) return;

    const currentRequestId = ++geocoderRequestIdRef.current;
    const geocoder = new window.google.maps.Geocoder();

    const run = async () => {
      const pickupResult = await geocodeAddress(geocoder, pickup);
      const destinationResult = await geocodeAddress(geocoder, destination);

      const stopsResult = await Promise.all(
        safeRouteStops.map((stop) => geocodeAddress(geocoder, stop))
      );

      if (currentRequestId !== geocoderRequestIdRef.current) return;

      setPickupPosition(pickupResult);
      setDestinationPosition(destinationResult);
      setStopPositions(stopsResult.filter(Boolean));
    };

    run();
  }, [pickup, destination, safeRouteStops, mapsApiLoaded]);

  useEffect(() => {
    if (!showPickupRadar) return;

    const interval = setInterval(() => {
      setPulseRadiusA((prev) => (prev >= 280 ? 140 : prev + 12));
      setPulseRadiusB((prev) => (prev >= 420 ? 220 : prev + 14));
    }, 120);

    return () => clearInterval(interval);
  }, [showPickupRadar]);

  useEffect(() => {
    if (!autoFetchNearbyDrivers) return;
    if (!currentPosition?.lat || !currentPosition?.lng) return;

    let cancelled = false;

    const fetchNearbyDrivers = async () => {
      try {
        const response = await axios.get(`${apiBase}/captains/nearby`, {
          params: {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
          },
        });

        if (cancelled) return;

        const drivers =
          response?.data?.captains ||
          response?.data?.drivers ||
          response?.data?.nearbyDrivers ||
          [];

        setFetchedDrivers(Array.isArray(drivers) ? drivers : []);
      } catch (err) {
        console.error("[LiveTracking] error consultando conductores cercanos:", err);
      }
    };

    fetchNearbyDrivers();

    driversIntervalRef.current = setInterval(() => {
      fetchNearbyDrivers();
    }, nearbyDriversRefreshMs);

    return () => {
      cancelled = true;

      if (driversIntervalRef.current) {
        clearInterval(driversIntervalRef.current);
        driversIntervalRef.current = null;
      }
    };
  }, [
    autoFetchNearbyDrivers,
    apiBase,
    currentPosition?.lat,
    currentPosition?.lng,
    nearbyDriversRefreshMs,
  ]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps) {
      setDirections(null);
      setEtaText("");
      setDistanceText("");

      if (typeof onEtaUpdate === "function") {
        onEtaUpdate({ etaText: "", distanceText: "" });
      }

      return;
    }

    const currentRequestId = ++directionsRequestIdRef.current;
    const directionsService = new window.google.maps.DirectionsService();

    if (showRouteToPickup) {
      if (!pickupPosition || !routeOrigin) {
        setDirections(null);
        setEtaText("");
        setDistanceText("");

        if (typeof onEtaUpdate === "function") {
          onEtaUpdate({ etaText: "", distanceText: "" });
        }

        return;
      }

      directionsService.route(
        {
          origin: { lat: routeOrigin.lat, lng: routeOrigin.lng },
          destination: pickupPosition,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (currentRequestId !== directionsRequestIdRef.current) return;

          if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
            const leg = result.routes[0].legs[0];

            setDirections(result);
            setEtaText(leg.duration?.text || "");
            setDistanceText(leg.distance?.text || "");

            if (typeof onEtaUpdate === "function") {
              onEtaUpdate({
                etaText: leg.duration?.text || "",
                distanceText: leg.distance?.text || "",
              });
            }
          } else {
            console.warn("[LiveTracking] Directions pickup error:", status);

            setDirections(null);
            setEtaText("");
            setDistanceText("");

            if (typeof onEtaUpdate === "function") {
              onEtaUpdate({ etaText: "", distanceText: "" });
            }
          }
        }
      );

      return;
    }

    if (!pickupPosition || !destinationPosition) {
      setDirections(null);
      setEtaText("");
      setDistanceText("");

      if (typeof onEtaUpdate === "function") {
        onEtaUpdate({ etaText: "", distanceText: "" });
      }

      return;
    }

    directionsService.route(
      {
        origin: pickupPosition,
        destination: destinationPosition,
        waypoints: stopPositions.map((stop) => ({
          location: {
            lat: stop.lat,
            lng: stop.lng,
          },
          stopover: true,
        })),
        optimizeWaypoints: false,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (currentRequestId !== directionsRequestIdRef.current) return;

        if (status === "OK" && result?.routes?.[0]) {
          const route = result.routes[0];
          const legs = Array.isArray(route.legs) ? route.legs : [];

          const totalSeconds = legs.reduce(
            (sum, leg) => sum + Number(leg?.duration?.value || 0),
            0
          );

          const totalMeters = legs.reduce(
            (sum, leg) => sum + Number(leg?.distance?.value || 0),
            0
          );

          const minutes = Math.max(1, Math.round(totalSeconds / 60));
          const km = totalMeters / 1000;

          const nextEtaText =
            minutes >= 60
              ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
              : `${minutes} min`;

          const nextDistanceText =
            km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;

          setDirections(result);
          setEtaText(nextEtaText);
          setDistanceText(nextDistanceText);

          if (typeof onEtaUpdate === "function") {
            onEtaUpdate({
              etaText: nextEtaText,
              distanceText: nextDistanceText,
            });
          }
        } else {
          console.warn("[LiveTracking] Directions route error:", status);

          setDirections(null);
          setEtaText("");
          setDistanceText("");

          if (typeof onEtaUpdate === "function") {
            onEtaUpdate({ etaText: "", distanceText: "" });
          }
        }
      }
    );
  }, [
    mapsApiLoaded,
    pickupPosition,
    destinationPosition,
    stopPositions,
    routeOrigin?.lat,
    routeOrigin?.lng,
    showRouteToPickup,
    onEtaUpdate,
  ]);

  useEffect(() => {
    if (!map || !mapsApiLoaded || !window.google?.maps) return;
    if (isUserInteractingRef.current) return;
    if (hasAutoFittedRef.current && lastFocusKeyRef.current === stableMapFocusKey) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    if (showRouteToPickup && routeOrigin && pickupPosition) {
      bounds.extend({ lat: routeOrigin.lat, lng: routeOrigin.lng });
      bounds.extend(pickupPosition);
      hasPoints = true;

      map.fitBounds(bounds, {
        top: 110,
        right: 60,
        bottom: 250,
        left: 60,
      });
    } else if (pickupPosition && destinationPosition) {
      bounds.extend(pickupPosition);
      stopPositions.forEach((stop) => bounds.extend(stop));
      bounds.extend(destinationPosition);
      hasPoints = true;

      map.fitBounds(bounds, {
        top: 130,
        right: 70,
        bottom: 360,
        left: 70,
      });
    } else if (pickupPosition && showPickupRadar) {
      bounds.extend(pickupPosition);
      hasPoints = true;

      if (currentPosition) {
        bounds.extend(currentPosition);
      }

      safeNearbyDrivers.slice(0, 8).forEach((driver) => {
        bounds.extend({ lat: driver.lat, lng: driver.lng });
      });

      map.fitBounds(bounds, {
        top: 80,
        right: 60,
        bottom: 260,
        left: 60,
      });
    } else if (pickupPosition) {
      map.panTo(pickupPosition);
      map.setZoom(15);
      hasPoints = true;
    } else if (currentPosition) {
      map.panTo(currentPosition);
      map.setZoom(zoom);
      hasPoints = true;
    }

    if (!hasPoints) return;

    hasAutoFittedRef.current = true;
    lastFocusKeyRef.current = stableMapFocusKey;
  }, [
    map,
    mapsApiLoaded,
    stableMapFocusKey,
    showRouteToPickup,
    showPickupRadar,
    routeOrigin,
    pickupPosition,
    destinationPosition,
    stopPositions,
    currentPosition,
    safeNearbyDrivers,
    zoom,
  ]);

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  const userDotIcon =
    mapsApiLoaded && window.google?.maps
      ? {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        }
      : undefined;

  const pickupDotIcon =
    mapsApiLoaded && window.google?.maps
      ? {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: CENTRAL_GO_DARK,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        }
      : undefined;

  const destinationDotIcon =
    mapsApiLoaded && window.google?.maps
      ? {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: CENTRAL_GO_PURPLE,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        }
      : undefined;

  const buildStopIcon = (index) => {
    if (!mapsApiLoaded || !window.google?.maps) return undefined;

    const number = String(index + 1);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
        <defs>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.28"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M23 3C13.6 3 6 10.5 6 19.9C6 32.1 23 51 23 51C23 51 40 32.1 40 19.9C40 10.5 32.4 3 23 3Z" fill="${CENTRAL_GO_PURPLE}"/>
          <circle cx="23" cy="20" r="11" fill="white"/>
          <text x="23" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="${CENTRAL_GO_DARK}">${number}</text>
        </g>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(40, 47),
      anchor: new window.google.maps.Point(20, 47),
    };
  };

  const buildProCarIcon = (rotation = 0, active = true) => {
    if (!mapsApiLoaded || !window.google?.maps) return undefined;

    const bodyTop = active ? "#b36cff" : "#cbd5e1";
    const bodyMid = active ? "#7c1fd1" : "#9ca3af";
    const bodyDark = active ? "#3b0764" : "#4b5563";
    const windowDark = "#0b1020";
    const windowSoft = "#1f2937";
    const light = "#f5f3ff";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="82" height="82" viewBox="0 0 82 82">
        <defs>
          <linearGradient id="body" x1="18" y1="8" x2="64" y2="76" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="${bodyTop}"/>
            <stop offset="0.42" stop-color="${bodyMid}"/>
            <stop offset="1" stop-color="${bodyDark}"/>
          </linearGradient>

          <linearGradient id="side" x1="20" y1="38" x2="62" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#9333ea"/>
            <stop offset="1" stop-color="#2e1065"/>
          </linearGradient>

          <linearGradient id="glass" x1="28" y1="13" x2="54" y2="37" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="${windowSoft}"/>
            <stop offset="1" stop-color="${windowDark}"/>
          </linearGradient>

          <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000000" flood-opacity="0.34"/>
          </filter>

          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g transform="rotate(${rotation} 41 41)" filter="url(#shadow)">
          <ellipse cx="41" cy="63" rx="23" ry="7" fill="#000000" opacity="0.20"/>

          <path
            d="M19 52
               C15.5 47 15.2 39.5 17.8 32
               C20.7 23.7 28.4 17.3 37.6 15.1
               C47.4 12.8 57.6 17.4 63.4 26.8
               C68.7 35.4 67.5 45.9 62.3 52.4
               C53.4 59.4 29.2 60.6 19 52Z"
            fill="url(#body)"
            stroke="#2e1065"
            stroke-width="1.8"
          />

          <path
            d="M28.8 24.6
               C33.4 18.6 45.7 18.2 53.7 25.6
               C49.8 31.8 35.2 32.7 25.8 28.6
               C26.3 27 27.2 25.6 28.8 24.6Z"
            fill="url(#glass)"
            stroke="#111827"
            stroke-width="1"
            opacity="0.98"
          />

          <path
            d="M22.3 36.3
               C31.2 40.1 50.6 39.6 60.4 34.2
               C61.7 40.3 60.1 46.7 55.8 50.2
               C46.4 54.1 31.7 54.4 23.3 50.1
               C19.9 46 19.8 41.1 22.3 36.3Z"
            fill="url(#side)"
            opacity="0.92"
          />

          <path
            d="M23.5 36.4
               C31.3 39.4 49.5 39.1 58.5 34.9"
            stroke="#f3e8ff"
            stroke-width="1.5"
            opacity="0.65"
            fill="none"
          />

          <path
            d="M24.4 49.2
               C34.1 53.1 47.9 52.8 56.6 49.2"
            stroke="#1e1b4b"
            stroke-width="1.8"
            opacity="0.45"
            fill="none"
          />

          <path
            d="M19.2 39.5
               C15.1 39.4 12.9 42.4 13.6 46.3
               C16.1 45.2 18.5 44.2 20.5 42.3Z"
            fill="#2e1065"
            opacity="0.98"
          />

          <path
            d="M63.3 39.4
               C67.4 39.3 69.6 42.4 68.9 46.3
               C66.4 45.2 64.1 44.2 62.1 42.3Z"
            fill="#2e1065"
            opacity="0.98"
          />

          <ellipse cx="28" cy="56.4" rx="6.1" ry="4.1" fill="#020617"/>
          <ellipse cx="54" cy="56.4" rx="6.1" ry="4.1" fill="#020617"/>
          <ellipse cx="28" cy="56.4" rx="2.8" ry="1.8" fill="#cbd5e1"/>
          <ellipse cx="54" cy="56.4" rx="2.8" ry="1.8" fill="#cbd5e1"/>

          <path
            d="M24.5 33.5
               C26.8 28.5 30.2 24.9 35.4 22.2"
            stroke="#ffffff"
            stroke-width="1.4"
            opacity="0.35"
            fill="none"
          />

          <circle cx="23.3" cy="35.6" r="2.2" fill="${light}" filter="url(#softGlow)" opacity="0.98"/>
          <circle cx="59.4" cy="35.5" r="2.2" fill="${light}" filter="url(#softGlow)" opacity="0.98"/>

          <path
            d="M31.5 18.7
               C40.6 14.8 51.2 17.9 58.3 27.4"
            stroke="#f5d0fe"
            stroke-width="1.5"
            opacity="0.52"
            fill="none"
          />

          <path
            d="M35.4 15.8
               C41.8 13.9 49.1 15.3 54.9 20.4"
            stroke="#ffffff"
            stroke-width="1"
            opacity="0.28"
            fill="none"
          />
        </g>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(58, 58),
      anchor: new window.google.maps.Point(29, 29),
    };
  };

  if (!isGeolocationAvailable) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-sm text-gray-700 px-4 text-center">
        La geolocalización no es compatible con este navegador.
      </div>
    );
  }

  if (error && !currentPosition) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-sm text-gray-700 px-4 text-center">
        Error: {error}. Verifica que el GPS del celular esté activado y que la
        app tenga permisos de ubicación.
      </div>
    );
  }

  if (!mapsApiLoaded || (isLoading && !currentPosition)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-sm text-gray-700">
        Cargando mapa...
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      zoom={zoom}
      onLoad={handleMapLoad}
      onDragStart={markUserInteraction}
      onClick={markUserInteraction}
      options={mapOptions}
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: CENTRAL_GO_PURPLE,
              strokeOpacity: 0.92,
              strokeWeight: 7,
            },
          }}
        />
      )}

      {currentPosition && (
        <>
          <Circle
            center={currentPosition}
            radius={55}
            options={{
              fillColor: "#2563eb",
              fillOpacity: 0.18,
              strokeOpacity: 0,
              clickable: false,
              draggable: false,
              editable: false,
              visible: true,
            }}
          />

          <Marker position={currentPosition} icon={userDotIcon} zIndex={50} />
        </>
      )}

      {pickupPosition && (
        <>
          {showPickupRadar && !hasUserRoute && (
            <>
              <Circle
                center={pickupPosition}
                radius={pulseRadiusA}
                options={{
                  fillColor: CENTRAL_GO_PURPLE,
                  fillOpacity: 0.08,
                  strokeColor: CENTRAL_GO_PURPLE,
                  strokeOpacity: 0.16,
                  strokeWeight: 1,
                  clickable: false,
                }}
              />

              <Circle
                center={pickupPosition}
                radius={pulseRadiusB}
                options={{
                  fillColor: CENTRAL_GO_PURPLE,
                  fillOpacity: 0.04,
                  strokeColor: CENTRAL_GO_PURPLE,
                  strokeOpacity: 0.1,
                  strokeWeight: 1,
                  clickable: false,
                }}
              />
            </>
          )}

          <Circle
            center={pickupPosition}
            radius={70}
            options={{
              fillColor: CENTRAL_GO_DARK,
              fillOpacity: 0.12,
              strokeOpacity: 0,
              clickable: false,
            }}
          />

          <Marker position={pickupPosition} icon={pickupDotIcon} zIndex={80} />

          <OverlayView
            position={pickupPosition}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              style={{
                transform: "translate(-50%, -115%)",
                background: CENTRAL_GO_DARK,
                color: "#fff",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 700,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
              }}
            >
              Punto de recogida
            </div>
          </OverlayView>
        </>
      )}

      {stopPositions.map((stop, index) => (
        <Marker
          key={`stop-${index}-${stop.lat}-${stop.lng}`}
          position={{ lat: stop.lat, lng: stop.lng }}
          icon={buildStopIcon(index)}
          zIndex={85}
          title={`Parada ${index + 1}`}
        />
      ))}

      {destinationPosition && (
        <>
          <Marker
            position={destinationPosition}
            icon={destinationDotIcon}
            zIndex={82}
            title="Destino final"
          />

          <OverlayView
            position={destinationPosition}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              style={{
                transform: "translate(-50%, 16px)",
                background: "rgba(255,255,255,0.97)",
                color: CENTRAL_GO_DARK,
                padding: "8px 12px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 800,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
                border: "1px solid #ede9fe",
              }}
            >
              Destino final
            </div>
          </OverlayView>
        </>
      )}

      {mapsApiLoaded &&
        window.google?.maps &&
        safeNearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            position={{ lat: driver.lat, lng: driver.lng }}
            icon={buildProCarIcon(driver.rotation, true)}
            zIndex={40}
            title={driver.name}
          />
        ))}

      {showRouteToPickup &&
        routeOrigin &&
        !selectedDriver &&
        mapsApiLoaded &&
        window.google?.maps && (
          <Marker
            position={{ lat: routeOrigin.lat, lng: routeOrigin.lng }}
            icon={buildProCarIcon(routeOrigin.rotation, true)}
            zIndex={90}
            title="Mi ubicación"
          />
        )}

      {directions && (etaText || distanceText) && pickupPosition && (
        <OverlayView
          position={showRouteToPickup ? pickupPosition : destinationPosition || pickupPosition}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div
            style={{
              transform: showRouteToPickup
                ? "translate(-50%, 18px)"
                : "translate(-50%, -115%)",
              background: "rgba(255,255,255,0.97)",
              color: "#111827",
              padding: "10px 14px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 800,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
              border: "1px solid #e5e7eb",
            }}
          >
            {etaText ? `${etaText}` : ""}
            {etaText && distanceText ? " · " : ""}
            {distanceText || ""}
          </div>
        </OverlayView>
      )}
    </GoogleMap>
  );
};

export default LiveTracking;