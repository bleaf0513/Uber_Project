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

const mapStyles = [
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
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

const LiveTracking = ({
  pickup = "",
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
          lat,
          lng,
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

  const markUserInteraction = () => {
    isUserInteractingRef.current = true;

    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 4000);
  };

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

    navigator.geolocation.getCurrentPosition(handlePositionUpdate, handleGeoError, {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 0,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeoError,
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps) return;

    const currentRequestId = ++geocoderRequestIdRef.current;

    if (!pickup || typeof pickup !== "string" || pickup.trim().length < 3) {
      setPickupPosition(null);
      return;
    }

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address: pickup }, (results, status) => {
      if (currentRequestId !== geocoderRequestIdRef.current) return;

      if (status === "OK" && results?.[0]?.geometry?.location) {
        const location = results[0].geometry.location;
        setPickupPosition({
          lat: location.lat(),
          lng: location.lng(),
        });
      } else {
        console.warn("No se pudo geocodificar el pickup:", status);
        setPickupPosition(null);
      }
    });
  }, [pickup, mapsApiLoaded]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRadiusA((prev) => (prev >= 280 ? 140 : prev + 12));
      setPulseRadiusB((prev) => (prev >= 420 ? 220 : prev + 14));
    }, 120);

    return () => clearInterval(interval);
  }, []);

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
    if (!mapsApiLoaded || !window.google?.maps || !showRouteToPickup) {
      setDirections(null);
      setEtaText("");
      setDistanceText("");
      if (typeof onEtaUpdate === "function") {
        onEtaUpdate({ etaText: "", distanceText: "" });
      }
      return;
    }

    if (!pickupPosition || !selectedDriver) {
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

    directionsService.route(
      {
        origin: { lat: selectedDriver.lat, lng: selectedDriver.lng },
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
          setDirections(null);
          setEtaText("");
          setDistanceText("");
          if (typeof onEtaUpdate === "function") {
            onEtaUpdate({ etaText: "", distanceText: "" });
          }
        }
      }
    );
  }, [mapsApiLoaded, pickupPosition, selectedDriver, showRouteToPickup, onEtaUpdate]);

  useEffect(() => {
    if (!map || !mapsApiLoaded || !window.google?.maps) return;
    if (isUserInteractingRef.current) return;

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    if (currentPosition) {
      bounds.extend(currentPosition);
      hasPoints = true;
    }

    if (pickupPosition) {
      bounds.extend(pickupPosition);
      hasPoints = true;
    }

    safeNearbyDrivers.forEach((driver) => {
      bounds.extend({ lat: driver.lat, lng: driver.lng });
      hasPoints = true;
    });

    if (!hasPoints) return;

    const focusKey = JSON.stringify({
      pickup: pickupPosition
        ? {
            lat: Number(pickupPosition.lat).toFixed(5),
            lng: Number(pickupPosition.lng).toFixed(5),
          }
        : null,
      me: currentPosition
        ? {
            lat: Number(currentPosition.lat).toFixed(5),
            lng: Number(currentPosition.lng).toFixed(5),
          }
        : null,
      drivers: safeNearbyDrivers.map((d) => ({
        id: d.id,
        lat: Number(d.lat).toFixed(5),
        lng: Number(d.lng).toFixed(5),
      })),
      routeToPickup: !!showRouteToPickup,
      selectedDriver: selectedDriver
        ? {
            id: selectedDriver.id,
            lat: Number(selectedDriver.lat).toFixed(5),
            lng: Number(selectedDriver.lng).toFixed(5),
          }
        : null,
    });

    const shouldRefocus =
      !hasAutoFittedRef.current || lastFocusKeyRef.current !== focusKey;

    if (!shouldRefocus) return;

    if (showRouteToPickup && selectedDriver && pickupPosition) {
      bounds.extend({ lat: selectedDriver.lat, lng: selectedDriver.lng });
      bounds.extend(pickupPosition);
      map.fitBounds(bounds, {
        top: 110,
        right: 60,
        bottom: 250,
        left: 60,
      });
    } else if (pickupPosition && (currentPosition || safeNearbyDrivers.length > 0)) {
      map.fitBounds(bounds, {
        top: 80,
        right: 60,
        bottom: 260,
        left: 60,
      });
    } else if (currentPosition) {
      map.panTo(currentPosition);
      map.setZoom(zoom);
    }

    hasAutoFittedRef.current = true;
    lastFocusKeyRef.current = focusKey;
  }, [
    map,
    currentPosition,
    pickupPosition,
    safeNearbyDrivers,
    mapsApiLoaded,
    zoom,
    showRouteToPickup,
    selectedDriver,
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
          fillColor: "#111111",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        }
      : undefined;

  const buildCarSvg = (rotation = 0, active = true) => {
    const fill = active ? "#7c3aed" : "#9ca3af";
    const topFill = active ? "#8b5cf6" : "#cbd5e1";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <g transform="rotate(${rotation} 28 28)">
          <circle cx="28" cy="28" r="24" fill="white" fill-opacity="0.96"/>
          <circle cx="28" cy="28" r="24" stroke="#d1d5db" stroke-width="1.5" fill="none"/>
          <rect x="15" y="22" width="26" height="12" rx="5" fill="${fill}"/>
          <rect x="20" y="18" width="16" height="8" rx="3" fill="${topFill}"/>
          <circle cx="21" cy="36" r="4" fill="#111827"/>
          <circle cx="35" cy="36" r="4" fill="#111827"/>
          <rect x="22" y="20" width="5" height="4" rx="1" fill="#dbeafe"/>
          <rect x="29" y="20" width="5" height="4" rx="1" fill="#dbeafe"/>
        </g>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(42, 42),
      anchor: new window.google.maps.Point(21, 21),
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
        Error: {error}. Verifica que el GPS del celular esté activado y que la app tenga permisos de ubicación.
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
      center={currentPosition || DEFAULT_CENTER}
      zoom={zoom}
      onLoad={setMap}
      onDragStart={markUserInteraction}
      onZoomChanged={markUserInteraction}
      onClick={markUserInteraction}
      options={mapOptions}
    >
      {directions && showRouteToPickup && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: "#7c3aed",
              strokeOpacity: 0.85,
              strokeWeight: 6,
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
          {showPickupRadar && (
            <>
              <Circle
                center={pickupPosition}
                radius={pulseRadiusA}
                options={{
                  fillColor: "#7c3aed",
                  fillOpacity: 0.08,
                  strokeColor: "#7c3aed",
                  strokeOpacity: 0.16,
                  strokeWeight: 1,
                  clickable: false,
                }}
              />
              <Circle
                center={pickupPosition}
                radius={pulseRadiusB}
                options={{
                  fillColor: "#7c3aed",
                  fillOpacity: 0.04,
                  strokeColor: "#7c3aed",
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
              fillColor: "#111111",
              fillOpacity: 0.12,
              strokeOpacity: 0,
              clickable: false,
            }}
          />

          <Marker position={pickupPosition} icon={pickupDotIcon} zIndex={60} />

          <OverlayView
            position={pickupPosition}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              style={{
                transform: "translate(-50%, -115%)",
                background: "#111827",
                color: "#fff",
                padding: "6px 10px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
              }}
            >
              Punto de recogida
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
            icon={buildCarSvg(driver.rotation, true)}
            zIndex={40}
            title={driver.name}
          />
        ))}

      {showRouteToPickup && selectedDriver && pickupPosition && (etaText || distanceText) && (
        <OverlayView
          position={pickupPosition}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div
            style={{
              transform: "translate(-50%, 18px)",
              background: "rgba(255,255,255,0.96)",
              color: "#111827",
              padding: "10px 14px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
              border: "1px solid #e5e7eb",
            }}
          >
            {etaText ? `Llega en ${etaText}` : ""}
            {etaText && distanceText ? " · " : ""}
            {distanceText || ""}
          </div>
        </OverlayView>
      )}
    </GoogleMap>
  );
};

export default LiveTracking;