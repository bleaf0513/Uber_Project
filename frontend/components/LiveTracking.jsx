import React, { useState, useEffect, useRef, useMemo } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { useGoogleMapsScript } from "../src/context/GoogleMapsLoadContext";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const LiveTracking = () => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isGeolocationAvailable, setIsGeolocationAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [map, setMap] = useState(null);
  const advancedMarkerRef = useRef(null);

  const mapOptions = useMemo(
    () => ({
      mapTypeControl: false,
      fullscreenControl: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID",
    }),
    []
  );

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
      setIsLoading(false);
    };

    const handleError = (err) => {
      setError(err.message);
      setIsLoading(false);
      console.error("Geolocation error:", err);
    };

    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (!map || !currentPosition || !mapsApiLoaded) return;

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
    return () => {
      if (advancedMarkerRef.current) {
        advancedMarkerRef.current.map = null;
        advancedMarkerRef.current = null;
      }
    };
  }, []);

  if (!isGeolocationAvailable) {
    return <div>Error: Geolocation is not supported by your browser.</div>;
  }

  if (error) {
    return (
      <div>Error: {error}. Please ensure location permissions are granted.</div>
    );
  }

  if (isLoading || !currentPosition) {
    return <div>Loading map...</div>;
  }

  if (!mapsApiLoaded) {
    return <div>Loading map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={currentPosition}
      zoom={15}
      onLoad={setMap}
      options={mapOptions}
    />
  );
};

export default LiveTracking;
