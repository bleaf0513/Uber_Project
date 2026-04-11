import React, { useState, useEffect, useRef, useMemo } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { useGoogleMapsScript } from "../src/context/GoogleMapsLoadContext";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const DEFAULT_CENTER = {
  lat: 6.1686,
  lng: -75.6114,
};

const LiveTracking = () => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const [currentPosition, setCurrentPosition] = useState(DEFAULT_CENTER);
  const [error, setError] = useState(null);
  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [map, setMap] = useState(null);
  const advancedMarkerRef = useRef(null);

  const mapOptions = useMemo(() => {
    const options = {
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: "greedy",
    };

    const mapId = import.meta.env.VITE_GOOGLE_MAP_ID?.trim();
    if (mapId) {
      options.mapId = mapId;
    }

    return options;
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
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
      setError(null);
      setIsLoading(false);
    };

    const handleError = (err) => {
      console.error("Geolocation error:", err);
      setError(err.message || "No se pudo obtener la ubicación");
      setIsLoading(false);
    };

    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (!map || !currentPosition || !mapsApiLoaded || !window.google?.maps) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { AdvancedMarkerElement } = await google.maps.importLibrary(
          "marker"
        );

        if (cancelled) return;

        if (!advancedMarkerRef.current) {
          advancedMarkerRef.current = new AdvancedMarkerElement({
            map,
            position: currentPosition,
          });
        } else {
          advancedMarkerRef.current.position = currentPosition;
          advancedMarkerRef.current.map = map;
        }
      } catch (e) {
        console.error("Advanced marker error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map, currentPosition, mapsApiLoaded]);

  useEffect(() => {
    if (!map || !currentPosition) return;
    map.panTo(currentPosition);
  }, [map, currentPosition]);

  useEffect(() => {
    return () => {
      if (advancedMarkerRef.current) {
        advancedMarkerRef.current.map = null;
        advancedMarkerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gray-100">
      {mapsApiLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentPosition}
          zoom={15}
          onLoad={(loadedMap) => setMap(loadedMap)}
          options={mapOptions}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-100">
          Cargando mapa...
        </div>
      )}

      {(isLoading || error || !isGeolocationAvailable) && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-2xl bg-white/95 shadow-lg px-4 py-3 text-sm text-gray-700">
          {isLoading && <span>Obteniendo tu ubicación...</span>}
          {!isLoading && error && (
            <span>Ubicación no disponible. Mostrando mapa general.</span>
          )}
          {!isLoading && !isGeolocationAvailable && (
            <span>Tu navegador no soporta geolocalización.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveTracking;
