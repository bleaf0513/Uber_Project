import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  GoogleMap,
  Marker,
  Circle,
  OverlayView,
} from "@react-google-maps/api";
import { useGoogleMapsScript } from "../src/context/GoogleMapsLoadContext";

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

const LiveTracking = ({
  pickup = "",
  nearbyDrivers = [],
  showPickupRadar = true,
  zoom = 15,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const [currentPosition, setCurrentPosition] = useState(null);
  const [pickupPosition, setPickupPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [map, setMap] = useState(null);

  const [pulseRadiusA, setPulseRadiusA] = useState(140);
  const [pulseRadiusB, setPulseRadiusB] = useState(260);

  const watchIdRef = useRef(null);

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

  const safeNearbyDrivers = useMemo(() => {
    return (Array.isArray(nearbyDrivers) ? nearbyDrivers : [])
      .map((driver, index) => {
        const lat =
          Number(driver?.lat) ||
          Number(driver?.location?.lat) ||
          Number(driver?.location?.ltd) ||
          Number(driver?.coordinates?.lat);

        const lng =
          Number(driver?.lng) ||
          Number(driver?.location?.lng) ||
          Number(driver?.coordinates?.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          id: driver?._id || driver?.id || `driver-${index}`,
          lat,
          lng,
          rotation: Number(driver?.heading) || Number(driver?.rotation) || 0,
          name: driver?.name || driver?.fullname || "Conductor activo",
        };
      })
      .filter(Boolean);
  }, [nearbyDrivers]);

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
      setError(err?.message || "No se pudo obtener la ubicación.");
      setIsLoading(false);
      console.error("Geolocation error:", err);
    };

    navigator.geolocation.getCurrentPosition(handlePositionUpdate, handleGeoError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeoError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
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
    if (!pickup || typeof pickup !== "string" || pickup.trim().length < 3) {
      setPickupPosition(null);
      return;
    }

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address: pickup }, (results, status) => {
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
    if (!map || !mapsApiLoaded || !window.google?.maps) return;

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

    if (hasPoints) {
      if (
        pickupPosition &&
        (currentPosition || safeNearbyDrivers.length > 0)
      ) {
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
    }
  }, [map, currentPosition, pickupPosition, safeNearbyDrivers, mapsApiLoaded, zoom]);

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

  const buildCarSvg = (rotation = 0) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <g transform="rotate(${rotation} 28 28)">
          <circle cx="28" cy="28" r="24" fill="white" fill-opacity="0.96"/>
          <circle cx="28" cy="28" r="24" stroke="#d1d5db" stroke-width="1.5" fill="none"/>
          <rect x="15" y="22" width="26" height="12" rx="5" fill="#7c3aed"/>
          <rect x="20" y="18" width="16" height="8" rx="3" fill="#8b5cf6"/>
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
        Error: {error}. Activa los permisos de ubicación.
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
      options={mapOptions}
    >
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
          <Marker
            position={currentPosition}
            icon={userDotIcon}
            zIndex={50}
          />
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

          <Marker
            position={pickupPosition}
            icon={pickupDotIcon}
            zIndex={60}
          />

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
            icon={buildCarSvg(driver.rotation)}
            zIndex={40}
            title={driver.name}
          />
        ))}
    </GoogleMap>
  );
};

export default LiveTracking;
