import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import { getApiBaseUrl } from "../apiBase";
import EnterpriseDriverDeliveryChat from "./EnterpriseDriverDeliveryChat";
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../backgroundLocation";

const API_BASE = getApiBaseUrl();
const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };
const GPS_MARKER_ICON = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";

const haversineDistanceMeters = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

const getStatusBadgeClass = (status) => {
  if (status === "Finalizada") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }

  if (status === "En curso") {
    return "bg-blue-100 text-blue-700 border border-blue-200";
  }

  return "bg-amber-100 text-amber-700 border border-amber-200";
};

const getStatusDotClass = (status) => {
  if (status === "Finalizada") return "bg-emerald-500";
  if (status === "En curso") return "bg-blue-500";
  return "bg-amber-500";
};

const formatCurrencyCOP = (value) => {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const getDriverAuthHeaders = () => {
  const token = localStorage.getItem("enterpriseDriverToken") || "";

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const getDeliveryAddressText = (delivery) => {
  return String(delivery?.address || "").trim();
};

const normalizeColombiaAddress = (address) => {
  const clean = String(address || "").trim();
  if (!clean) return "";

  const lowered = clean.toLowerCase();
  if (
    lowered.includes("colombia") ||
    lowered.includes("antioquia") ||
    lowered.includes("medellín") ||
    lowered.includes("medellin") ||
    lowered.includes("itagüí") ||
    lowered.includes("itagui") ||
    lowered.includes("envigado") ||
    lowered.includes("sabaneta")
  ) {
    return clean;
  }

  return `${clean}, Antioquia, Colombia`;
};

const getDeliveryCoordinates = (delivery) => {
  const lat =
    delivery?.deliveryLocation?.lat ??
    delivery?.location?.lat ??
    delivery?.coordinates?.lat ??
    delivery?.lat ??
    null;

  const lng =
    delivery?.deliveryLocation?.lng ??
    delivery?.location?.lng ??
    delivery?.coordinates?.lng ??
    delivery?.lng ??
    null;

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }

  return {
    lat: Number(lat),
    lng: Number(lng),
  };
};

const getDeliveryNavigationDestination = (delivery) => {
  const coords = getDeliveryCoordinates(delivery);
  if (coords) return `${coords.lat},${coords.lng}`;
  return normalizeColombiaAddress(getDeliveryAddressText(delivery));
};

const buildGoogleMapsDeliveryUrl = (delivery, selectedDriver) => {
  const destination = getDeliveryNavigationDestination(delivery);

  if (!destination) return "";

  const driverLat = selectedDriver?.currentLocation?.lat;
  const driverLng = selectedDriver?.currentLocation?.lng;

  const origin = driverLat && driverLng ? `${driverLat},${driverLng}` : "";

  const params = new URLSearchParams();
  params.set("api", "1");

  if (origin) {
    params.set("origin", origin);
  }

  params.set("destination", destination);
  params.set("travelmode", "driving");

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildWazeDeliveryUrl = (delivery) => {
  const destination = getDeliveryNavigationDestination(delivery);

  if (!destination) return "";

  const params = new URLSearchParams();
  params.set("q", destination);
  params.set("navigate", "yes");

  return `https://waze.com/ul?${params.toString()}`;
};

const openNavigationForDelivery = (delivery, selectedDriver, app) => {
  const url =
    app === "waze"
      ? buildWazeDeliveryUrl(delivery)
      : buildGoogleMapsDeliveryUrl(delivery, selectedDriver);

  if (!url) {
    alert("Este pedido no tiene una dirección válida para navegar.");
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
};

const EnterpriseDriverMap = ({
  selectedDriver,
  assignedDeliveries,
  activeDelivery,
  setSelectedDriver,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const fallbackRoutePolylineRef = useRef(null);
  const fallbackDestinationMarkerRef = useRef(null);
  const geocoderRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastSignatureRef = useRef("");
  const routeBuildIdRef = useRef(0);
  const selectedDriverRef = useRef(selectedDriver);
  const trackingStartedRef = useRef(false);
  const lastSentCoordsRef = useRef(null);
  const sendingLocationRef = useRef(false);
  const lastPersistedAtRef = useRef(0);

  const [geoError, setGeoError] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [routeInfo, setRouteInfo] = useState({
    orderedStops: [],
    totalStops: 0,
    totalDistanceText: "",
    totalDurationText: "",
  });

  useEffect(() => {
    selectedDriverRef.current = selectedDriver;
  }, [selectedDriver]);

  const pendingStops = useMemo(() => {
    if (!activeDelivery || activeDelivery.status !== "En curso") {
      return [];
    }

    const hasAddress = Boolean(getDeliveryAddressText(activeDelivery));
    const hasCoords = Boolean(getDeliveryCoordinates(activeDelivery));

    if (!hasAddress && !hasCoords) {
      return [];
    }

    return [activeDelivery];
  }, [activeDelivery]);

  const updateDriverMarker = useCallback((coords) => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: coords,
        title: `Conductor: ${selectedDriverRef.current?.name || "Conductor"}`,
        icon: {
          url: GPS_MARKER_ICON,
        },
      });
    } else {
      driverMarkerRef.current.setPosition(coords);
      driverMarkerRef.current.setTitle(
        `Conductor: ${selectedDriverRef.current?.name || "Conductor"}`
      );
    }
  }, []);


  const clearFallbackRoute = useCallback(() => {
    if (fallbackRoutePolylineRef.current) {
      fallbackRoutePolylineRef.current.setMap(null);
      fallbackRoutePolylineRef.current = null;
    }

    if (fallbackDestinationMarkerRef.current) {
      fallbackDestinationMarkerRef.current.setMap(null);
      fallbackDestinationMarkerRef.current = null;
    }
  }, []);

  const drawFallbackRoute = useCallback((originCoords, destinationCoords, label = "Destino activo") => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    clearFallbackRoute();

    fallbackRoutePolylineRef.current = new window.google.maps.Polyline({
      path: [originCoords, destinationCoords],
      geodesic: true,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: mapInstanceRef.current,
    });

    fallbackDestinationMarkerRef.current = new window.google.maps.Marker({
      map: mapInstanceRef.current,
      position: destinationCoords,
      title: label,
      label: {
        text: "D",
        color: "#ffffff",
        fontWeight: "bold",
      },
    });

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(originCoords);
    bounds.extend(destinationCoords);
    mapInstanceRef.current.fitBounds(bounds);
  }, [clearFallbackRoute]);

  const persistDriverLocation = useCallback(
    async (coords, meta = {}) => {
      const currentDriver = selectedDriverRef.current;

      if (!currentDriver?._id && !currentDriver?.id) return false;
      if (sendingLocationRef.current) return false;

      const driverId = currentDriver._id || currentDriver.id;

      const roundedCoords = {
        lat: Number(Number(coords.lat).toFixed(6)),
        lng: Number(Number(coords.lng).toFixed(6)),
      };

      const now = Date.now();
      const last = lastSentCoordsRef.current;
      const movedMeters = last
        ? haversineDistanceMeters(last, roundedCoords)
        : Number.MAX_SAFE_INTEGER;
      const elapsedMs = now - lastPersistedAtRef.current;

      if (last) {
        const exactlySame =
          last.lat === roundedCoords.lat && last.lng === roundedCoords.lng;

        if (exactlySame && elapsedMs < 25000) {
          return true;
        }

        if (!exactlySame && movedMeters < 5 && elapsedMs < 15000) {
          return true;
        }
      }

      sendingLocationRef.current = true;

      try {
        const response = await fetch(
          `${API_BASE}/enterprise-drivers/${driverId}/location`,
          {
            method: "PATCH",
            headers: getDriverAuthHeaders(),
            credentials: "include",
            body: JSON.stringify(roundedCoords),
          }
        );

        const text = await response.text();
        let data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error(`Respuesta inválida del backend: ${text}`);
        }

        if (!response.ok) {
          throw new Error(
            data.message || "No se pudo guardar la ubicación en backend."
          );
        }

        const persistedDriver = data.driver || {
          ...currentDriver,
          currentLocation: {
            lat: roundedCoords.lat,
            lng: roundedCoords.lng,
            updatedAt: new Date().toISOString(),
          },
        };

        setSelectedDriver(persistedDriver);
        localStorage.setItem(
          "activeEnterpriseDriverData",
          JSON.stringify(persistedDriver)
        );

        selectedDriverRef.current = persistedDriver;
        lastSentCoordsRef.current = roundedCoords;
        lastPersistedAtRef.current = now;

        setGeoError("");
        setIsTracking(true);

        if (meta?.source) {
          console.log("[GPS] Ubicación persistida:", meta.source, roundedCoords);
        }

        return true;
      } catch (error) {
        console.error("No se pudo persistir la ubicación en backend:", error);
        setGeoError(
          error.message || "No se pudo guardar la ubicación en tiempo real."
        );
        return false;
      } finally {
        sendingLocationRef.current = false;
      }
    },
    [setSelectedDriver]
  );

  const handleCoordsUpdate = useCallback(
    async (coords, options = {}) => {
      const normalizedCoords = {
        lat: Number(coords.lat),
        lng: Number(coords.lng),
      };

      if (
        !Number.isFinite(normalizedCoords.lat) ||
        !Number.isFinite(normalizedCoords.lng)
      ) {
        return false;
      }

      const saved = await persistDriverLocation(normalizedCoords, {
        source: options.source || "unknown",
      });

      if (!saved) return false;

      updateDriverMarker(normalizedCoords);

      if (
        options.shouldCenterMap &&
        mapInstanceRef.current &&
        !pendingStops.length
      ) {
        mapInstanceRef.current.setCenter(normalizedCoords);
        mapInstanceRef.current.setZoom(15);
      }

      return true;
    },
    [persistDriverLocation, updateDriverMarker, pendingStops.length]
  );

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCoords =
        selectedDriver?.currentLocation?.lat && selectedDriver?.currentLocation?.lng
          ? {
              lat: Number(selectedDriver.currentLocation.lat),
              lng: Number(selectedDriver.currentLocation.lng),
            }
          : DEFAULT_CENTER;

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: initialCoords,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      geocoderRef.current = new window.google.maps.Geocoder();

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
      });

      directionsRendererRef.current.setMap(mapInstanceRef.current);

      if (
        selectedDriver?.currentLocation?.lat &&
        selectedDriver?.currentLocation?.lng
      ) {
        driverMarkerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position: {
            lat: Number(selectedDriver.currentLocation.lat),
            lng: Number(selectedDriver.currentLocation.lng),
          },
          title: `Conductor: ${selectedDriver?.name || "Conductor"}`,
          icon: {
            url: GPS_MARKER_ICON,
          },
        });
      }
    }
  }, [mapsApiLoaded, selectedDriver]);

  useEffect(() => {
    if (
      !mapsApiLoaded ||
      !window.google?.maps ||
      !mapInstanceRef.current ||
      (!selectedDriver?._id && !selectedDriver?.id)
    ) {
      return;
    }

    if (trackingStartedRef.current) return;

    if (!navigator.geolocation) {
      setGeoError("Este dispositivo no soporta geolocalización.");
      return;
    }

    trackingStartedRef.current = true;

    const updatePosition = async (position) => {
      const coords = {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      };

      await handleCoordsUpdate(coords, {
        shouldCenterMap: true,
        source: "foreground",
      });
    };

    const onError = (error) => {
      setIsTracking(false);

      if (error.code === 1) {
        setGeoError("Debes permitir la ubicación en tiempo real para ver tu ruta.");
      } else if (error.code === 2) {
        setGeoError("No se pudo determinar tu ubicación actual.");
      } else if (error.code === 3) {
        setGeoError("La ubicación tardó demasiado en responder.");
      } else {
        setGeoError("No fue posible obtener la ubicación.");
      }
    };

    navigator.geolocation.getCurrentPosition(updatePosition, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      onError,
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      trackingStartedRef.current = false;
    };
  }, [
    mapsApiLoaded,
    selectedDriver?._id,
    selectedDriver?.id,
    handleCoordsUpdate,
  ]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapInstanceRef.current) return;

    const driverLocation = selectedDriver?.currentLocation;
    if (!driverLocation?.lat || !driverLocation?.lng) return;

    const coords = {
      lat: Number(driverLocation.lat),
      lng: Number(driverLocation.lng),
    };

    updateDriverMarker(coords);
  }, [
    mapsApiLoaded,
    selectedDriver?.currentLocation,
    selectedDriver?.name,
    updateDriverMarker,
  ]);

  useEffect(() => {
    if (
      !mapsApiLoaded ||
      !window.google?.maps ||
      !mapInstanceRef.current ||
      !geocoderRef.current ||
      !directionsRendererRef.current
    ) {
      return;
    }

    const driverLocation = selectedDriver?.currentLocation;
    if (!driverLocation?.lat || !driverLocation?.lng) {
      directionsRendererRef.current.set("directions", null);
      clearFallbackRoute();
      setRouteInfo({
        orderedStops: [],
        totalStops: 0,
        totalDistanceText: "",
        totalDurationText: "",
      });
      return;
    }

    const originCoords = {
      lat: Number(driverLocation.lat),
      lng: Number(driverLocation.lng),
    };

    if (!pendingStops.length) {
      directionsRendererRef.current.set("directions", null);
      clearFallbackRoute();
      lastSignatureRef.current = "";

      setRouteInfo({
        orderedStops: [],
        totalStops: 0,
        totalDistanceText: "",
        totalDurationText: "",
      });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(originCoords);
        mapInstanceRef.current.setZoom(15);
      }

      return;
    }

    const activeStop = pendingStops[0];
    const activeStopCoords = getDeliveryCoordinates(activeStop);
    const activeStopAddress = normalizeColombiaAddress(getDeliveryAddressText(activeStop));

    const signature = JSON.stringify({
      driverLat: Number(driverLocation.lat).toFixed(6),
      driverLng: Number(driverLocation.lng).toFixed(6),
      activeDeliveryId: activeStop?._id || activeStop?.id || null,
      activeDeliveryStatus: activeStop?.status || "",
      destinationLat: activeStopCoords?.lat ? Number(activeStopCoords.lat).toFixed(6) : "",
      destinationLng: activeStopCoords?.lng ? Number(activeStopCoords.lng).toFixed(6) : "",
      destinationAddress: activeStopAddress,
    });

    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const geocodeDelivery = (delivery) =>
      new Promise((resolve, reject) => {
        const coords = getDeliveryCoordinates(delivery);
        const address = normalizeColombiaAddress(getDeliveryAddressText(delivery));

        if (coords) {
          resolve({
            ...delivery,
            coords,
            routeLocation: coords,
            formattedAddress: address || `${coords.lat},${coords.lng}`,
          });
          return;
        }

        if (!address) {
          reject(new Error("La entrega activa no tiene dirección ni coordenadas."));
          return;
        }

        geocoderRef.current.geocode({ address, region: "co" }, (results, status) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            const resolvedCoords = {
              lat: location.lat(),
              lng: location.lng(),
            };

            resolve({
              ...delivery,
              coords: resolvedCoords,
              routeLocation: resolvedCoords,
              formattedAddress: results[0].formatted_address || address,
            });
          } else {
            reject(new Error(`No se pudo geocodificar: ${address}. Estado: ${status}`));
          }
        });
      });

    const buildRoute = async () => {
      const buildId = ++routeBuildIdRef.current;

      try {
        const activeRouteStop = await geocodeDelivery(activeStop);

        if (buildId !== routeBuildIdRef.current) return;

        const directionsService = new window.google.maps.DirectionsService();
        const destination = activeRouteStop.routeLocation || activeRouteStop.formattedAddress || activeRouteStop.address;

        directionsService.route(
          {
            origin: originCoords,
            destination,
            waypoints: [],
            optimizeWaypoints: false,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (buildId !== routeBuildIdRef.current) return;

            if (status === "OK" && result) {
              clearFallbackRoute();
              directionsRendererRef.current.setDirections(result);

              const route = result.routes?.[0];
              const legs = route?.legs || [];

              const totalDistanceMeters = legs.reduce(
                (sum, leg) => sum + (leg.distance?.value || 0),
                0
              );

              const totalDurationSeconds = legs.reduce(
                (sum, leg) => sum + (leg.duration?.value || 0),
                0
              );

              const totalKm = (totalDistanceMeters / 1000).toFixed(1);
              const totalMin = Math.round(totalDurationSeconds / 60);

              setRouteInfo({
                orderedStops: [activeRouteStop],
                totalStops: 1,
                totalDistanceText: `${totalKm} km`,
                totalDurationText:
                  totalMin >= 60
                    ? `${Math.floor(totalMin / 60)} h ${totalMin % 60} min`
                    : `${totalMin} min`,
              });
            } else {
              console.error("Error trazando la ruta activa:", status);
              directionsRendererRef.current.set("directions", null);

              if (activeRouteStop.coords) {
                drawFallbackRoute(
                  originCoords,
                  activeRouteStop.coords,
                  activeRouteStop.clientName || "Destino activo"
                );
              }

              setRouteInfo({
                orderedStops: [activeRouteStop],
                totalStops: 1,
                totalDistanceText: "",
                totalDurationText: "",
              });
            }
          }
        );
      } catch (error) {
        console.error("Error construyendo ruta activa:", error);
        directionsRendererRef.current.set("directions", null);
        clearFallbackRoute();

        setRouteInfo({
          orderedStops: activeDelivery?.address ? [activeDelivery] : [],
          totalStops: activeDelivery?.address ? 1 : 0,
          totalDistanceText: "",
          totalDurationText: "",
        });
      }
    };

    buildRoute();
  }, [
    mapsApiLoaded,
    selectedDriver?.currentLocation,
    pendingStops,
    activeDelivery,
    clearFallbackRoute,
    drawFallbackRoute,
  ]);

  const openExternalGoogleMaps = () => {
    const driverLocation = selectedDriver?.currentLocation;
    if (!driverLocation?.lat || !driverLocation?.lng) return;

    const stopsForNavigation =
      routeInfo.orderedStops.length > 0
        ? routeInfo.orderedStops
        : activeDelivery?.address
        ? [activeDelivery]
        : [];

    if (!stopsForNavigation.length) return;

    const origin = `${driverLocation.lat},${driverLocation.lng}`;

    const destination =
      stopsForNavigation[stopsForNavigation.length - 1].formattedAddress ||
      stopsForNavigation[stopsForNavigation.length - 1].address;

    const waypoints =
      stopsForNavigation.length > 1
        ? stopsForNavigation
            .slice(0, -1)
            .map((stop) => encodeURIComponent(stop.formattedAddress || stop.address))
            .join("|")
        : "";

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(
      destination
    )}&travelmode=driving${waypoints ? `&waypoints=${waypoints}` : ""}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const canNavigate =
    !!selectedDriver?.currentLocation?.lat &&
    !!selectedDriver?.currentLocation?.lng &&
    (routeInfo.orderedStops.length > 0 || !!activeDelivery?.address);

  const visibleStops =
    routeInfo.orderedStops.length > 0
      ? routeInfo.orderedStops
      : activeDelivery?.address
      ? [activeDelivery]
      : [];

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-emerald-50 px-5 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">
              <span>🗺️</span>
              <span>Ruta en vivo</span>
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">
              Mapa del conductor
            </h3>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Seguimiento GPS y ruta activa hacia la entrega en curso.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-extrabold">
            <span
              className={`rounded-full px-3 py-1 ${
                isTracking
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {isTracking ? "GPS activo" : "GPS inactivo"}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Paradas: {visibleStops.length}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {routeInfo.totalDistanceText || "Sin distancia"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div
          ref={mapRef}
          className="h-[430px] w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100"
        />

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Estado GPS
              </p>
              <p
                className={`mt-2 text-sm font-extrabold ${
                  isTracking ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {isTracking ? "Activo" : "Inactivo"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Paradas
              </p>
              <p className="mt-2 text-sm font-extrabold text-slate-900">
                {visibleStops.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Distancia total
              </p>
              <p className="mt-2 text-sm font-extrabold text-slate-900">
                {routeInfo.totalDistanceText || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Tiempo estimado
              </p>
              <p className="mt-2 text-sm font-extrabold text-slate-900">
                {routeInfo.totalDurationText || "—"}
              </p>
            </div>
          </div>

          {geoError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {geoError}
            </div>
          ) : null}

          {activeDelivery ? (
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-blue-900">
                    Entrega activa
                  </p>

                  <p className="mt-1 text-sm font-semibold text-blue-800">
                    {activeDelivery.clientName} — {activeDelivery.address}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openNavigationForDelivery(activeDelivery, selectedDriver, "waze")
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition hover:scale-[1.02]"
                  >
                    <span>🚙</span>
                    <span>Waze</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openNavigationForDelivery(activeDelivery, selectedDriver, "google")
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:scale-[1.02]"
                  >
                    <span>📍</span>
                    <span>Maps</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openExternalGoogleMaps}
              disabled={!canNavigate}
              className={`rounded-2xl px-5 py-3 font-extrabold transition ${
                canNavigate
                  ? "bg-green-600 text-white shadow-lg shadow-green-600/20 hover:scale-[1.02]"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
            >
              Abrir ruta completa en Google Maps
            </button>
          </div>

          {visibleStops.length > 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-extrabold text-slate-900">
                    Ruta activa en el mapa
                  </p>

                  <p className="text-xs font-semibold text-slate-500">
                    Solo se dibuja la entrega que está actualmente en curso.
                  </p>
                </div>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-600">
                  {visibleStops.length} destino activo
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {visibleStops.map((stop, index) => {
                  const isCurrentStop =
                    String(activeDelivery?._id || activeDelivery?.id) ===
                    String(stop._id || stop.id);

                  return (
                    <div
                      key={stop._id || stop.id || index}
                      className={`rounded-2xl border px-4 py-3 ${
                        isCurrentStop
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                            isCurrentStop
                              ? "bg-blue-600 text-white"
                              : "bg-slate-900 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-slate-900">
                            {stop.clientName || "Cliente"}
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600">
                            {stop.address}
                          </p>

                          {isCurrentStop ? (
                            <span className="mt-2 inline-flex rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
                              Parada activa
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
              No hay una entrega activa en curso para dibujar ruta en el mapa.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EnterpriseDriverPanel = () => {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [activeCedula, setActiveCedula] = useState("");
  const [activeDeliveryId, setActiveDeliveryId] = useState("");
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [startingDeliveryId, setStartingDeliveryId] = useState("");
  const [finishingDeliveryId, setFinishingDeliveryId] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState("Pendiente");
  const [listDateFilter, setListDateFilter] = useState("");
  const [listScopeFilter, setListScopeFilter] = useState("Pendientes");
  const [openedDeliveryId, setOpenedDeliveryId] = useState("");

  const navigate = useNavigate();
  const nativeTrackingStartedRef = useRef(false);

  const startNativeTrackingNow = useCallback(
    async ({ silent = false } = {}) => {
      const driverId =
        selectedDriver?._id ||
        selectedDriver?.id ||
        localStorage.getItem("activeEnterpriseDriverId") ||
        "";

      const token = localStorage.getItem("enterpriseDriverToken") || "";

      console.log("[BG-NATIVE] Intentando iniciar GPS nativo", {
        driverId,
        hasToken: !!token,
        apiBaseUrl: API_BASE,
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
      });

      if (!driverId || !token) {
        nativeTrackingStartedRef.current = false;

        if (!silent) {
          alert(
            "Falta driverId o token. Cierra sesión e ingresa nuevamente como conductor."
          );
        }

        return false;
      }

      if (!Capacitor.isNativePlatform()) {
        nativeTrackingStartedRef.current = false;

        if (!silent) {
          alert(
            "El GPS en segundo plano solo funciona en la app instalada en Android, no en navegador."
          );
        }

        return false;
      }

      try {
        const result = await startBackgroundTracking({
          driverId,
          token,
          apiBaseUrl: API_BASE,
        });

        nativeTrackingStartedRef.current = true;
        console.log("[BG-NATIVE] GPS nativo iniciado correctamente:", result);

        if (!silent) {
          alert(
            "GPS en segundo plano iniciado correctamente. Verifica que quede la notificación fija de Central Go."
          );
        }

        return true;
      } catch (error) {
        nativeTrackingStartedRef.current = false;

        console.error("[BG-NATIVE] Error iniciando GPS nativo:", error);

        if (!silent) {
          alert(error?.message || "No se pudo iniciar el GPS en segundo plano.");
        }

        return false;
      }
    },
    [selectedDriver]
  );

  useEffect(() => {
    if (!selectedDriver?._id && !selectedDriver?.id) return;
    if (nativeTrackingStartedRef.current) return;

    startNativeTrackingNow({ silent: true });
  }, [selectedDriver?._id, selectedDriver?.id, startNativeTrackingNow]);

  useEffect(() => {
    const savedCedula =
      localStorage.getItem("activeEnterpriseDriverCedula") || "";
    const savedDriverId =
      localStorage.getItem("activeEnterpriseDriverId") || "";
    const savedDriverData = localStorage.getItem("activeEnterpriseDriverData");

    setActiveCedula(savedCedula);

    const loadDriver = async () => {
      try {
        setLoadingDriver(true);

        let currentDriver = null;

        if (savedDriverData) {
          try {
            const parsedDriver = JSON.parse(savedDriverData);
            setSelectedDriver(parsedDriver);
            currentDriver = parsedDriver;
          } catch (error) {
            console.error("No se pudo parsear activeEnterpriseDriverData:", error);
          }
        }

        if (savedDriverId) {
          try {
            const response = await fetch(`${API_BASE}/enterprise-drivers`, {
              method: "GET",
              headers: getDriverAuthHeaders(),
              credentials: "include",
            });

            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            if (response.ok && data?.drivers?.length) {
              const matched = data.drivers.find(
                (driver) => String(driver._id || driver.id) === String(savedDriverId)
              );

              if (matched) {
                setSelectedDriver(matched);
                currentDriver = matched;

                localStorage.setItem(
                  "activeEnterpriseDriverData",
                  JSON.stringify(matched)
                );
              }
            }
          } catch (error) {
            console.error("No se pudo refrescar datos del conductor:", error);
          }
        }

        const deliveriesResponse = await fetch(
          `${API_BASE}/enterprise-deliveries/me`,
          {
            method: "GET",
            headers: getDriverAuthHeaders(),
            credentials: "include",
          }
        );

        const deliveriesText = await deliveriesResponse.text();
        const deliveriesData = deliveriesText ? JSON.parse(deliveriesText) : {};

        if (!deliveriesResponse.ok) {
          throw new Error(
            deliveriesData.message ||
              "No se pudieron cargar los pedidos del conductor."
          );
        }

        const apiDeliveries = Array.isArray(deliveriesData?.deliveries)
          ? deliveriesData.deliveries
          : [];

        setDeliveries(apiDeliveries);

        const currentDriverId =
          savedDriverId || currentDriver?._id || currentDriver?.id || "";

        if (currentDriverId) {
          const inProgress = apiDeliveries.find((delivery) => {
            const assignedId =
              delivery.assignedDriverId?._id ||
              delivery.assignedDriverId ||
              delivery.driver?._id ||
              delivery.driver ||
              "";

            return (
              String(assignedId) === String(currentDriverId) &&
              delivery.status === "En curso"
            );
          });

          setActiveDeliveryId(inProgress?._id || inProgress?.id || "");

          if (inProgress) {
            setListScopeFilter("En curso");
            setListStatusFilter("En curso");
            setListDateFilter("");
            setOpenedDeliveryId(inProgress?._id || inProgress?.id || "");
          }
        }
      } catch (error) {
        console.error("Error cargando panel del conductor:", error);
      } finally {
        setLoadingDriver(false);
      }
    };

    loadDriver();
  }, []);

  const assignedDeliveries = useMemo(() => {
    if (!selectedDriver) return [];

    const currentDriverId = selectedDriver._id || selectedDriver.id;

    return deliveries.filter((delivery) => {
      const assignedId =
        delivery.assignedDriverId?._id ||
        delivery.assignedDriverId ||
        delivery.driver?._id ||
        delivery.driver ||
        "";

      return String(assignedId) === String(currentDriverId);
    });
  }, [deliveries, selectedDriver]);

  const activeDelivery = useMemo(() => {
    const byId = activeDeliveryId
      ? assignedDeliveries.find(
          (delivery) => String(delivery._id || delivery.id) === String(activeDeliveryId)
        )
      : null;

    if (byId && byId.status === "En curso") return byId;

    return (
      assignedDeliveries.find((delivery) => delivery.status === "En curso") ||
      byId ||
      null
    );
  }, [assignedDeliveries, activeDeliveryId]);

  const openedDelivery = useMemo(() => {
    if (!openedDeliveryId) return null;

    return assignedDeliveries.find(
      (delivery) =>
        String(delivery._id || delivery.id || "") === String(openedDeliveryId)
    );
  }, [assignedDeliveries, openedDeliveryId]);

  const getDeliveryReferenceDate = useCallback((delivery) => {
    const raw =
      delivery?.createdAt ||
      delivery?.startedAt ||
      delivery?.finishedAt ||
      delivery?.updatedAt ||
      "";

    if (!raw) return "";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";

    return date.toISOString().slice(0, 10);
  }, []);

  const getDeliverySmartOrder = useCallback((delivery, fallbackIndex = 0) => {
    const possibleOrder =
      delivery?.routeOrder ??
      delivery?.smartRouteOrder ??
      delivery?.optimizedOrder ??
      delivery?.stopOrder ??
      delivery?.sequence ??
      delivery?.order ??
      delivery?.position;

    const numericOrder = Number(possibleOrder);

    if (Number.isFinite(numericOrder)) {
      return numericOrder;
    }

    return fallbackIndex;
  }, []);

  const getDeliveryStatusWeight = useCallback((status) => {
    if (status === "En curso") return 0;
    if (status === "Pendiente") return 1;
    if (status === "Finalizada") return 2;
    return 3;
  }, []);

  const filteredAssignedDeliveries = useMemo(() => {
    return assignedDeliveries
      .map((delivery, index) => ({
        delivery,
        originalIndex: index,
      }))
      .filter(({ delivery }) => {
        const matchesStatus =
          listStatusFilter === "Todos" ||
          String(delivery?.status || "") === String(listStatusFilter);

        const deliveryDate = getDeliveryReferenceDate(delivery);
        const matchesDate = !listDateFilter || deliveryDate === listDateFilter;

        return matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        const statusDiff =
          getDeliveryStatusWeight(a.delivery?.status) -
          getDeliveryStatusWeight(b.delivery?.status);

        if (statusDiff !== 0) return statusDiff;

        const orderDiff =
          getDeliverySmartOrder(a.delivery, a.originalIndex) -
          getDeliverySmartOrder(b.delivery, b.originalIndex);

        if (orderDiff !== 0) return orderDiff;

        return a.originalIndex - b.originalIndex;
      })
      .map(({ delivery }) => delivery);
  }, [
    assignedDeliveries,
    listStatusFilter,
    listDateFilter,
    getDeliveryReferenceDate,
    getDeliverySmartOrder,
    getDeliveryStatusWeight,
  ]);

  const stats = useMemo(() => {
    const pending = assignedDeliveries.filter((d) => d.status === "Pendiente").length;
    const inProgress = assignedDeliveries.filter((d) => d.status === "En curso").length;
    const finished = assignedDeliveries.filter((d) => d.status === "Finalizada").length;

    return {
      total: assignedDeliveries.length,
      pending,
      inProgress,
      finished,
    };
  }, [assignedDeliveries]);

  const updateDeliveriesStorage = (updatedDeliveries) => {
    setDeliveries(updatedDeliveries);

    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

  const persistDriverStatus = async (driverId, status) => {
    try {
      const response = await fetch(
        `${API_BASE}/enterprise-drivers/${driverId}/status`,
        {
          method: "PATCH",
          headers: getDriverAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({ status }),
        }
      );

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        console.error("Respuesta no JSON en persistDriverStatus:", text);
        return null;
      }

      if (!response.ok) {
        console.error(
          "Error actualizando estado del conductor:",
          data.message || text
        );
        return null;
      }

      return data.driver || null;
    } catch (error) {
      console.error("Failed to fetch en persistDriverStatus:", error);
      return null;
    }
  };

  const persistDeliveryStatus = async (deliveryId, status) => {
    const response = await fetch(
      `${API_BASE}/enterprise-deliveries/${deliveryId}/status`,
      {
        method: "PATCH",
        headers: getDriverAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ status }),
      }
    );

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      console.error("Respuesta no JSON en persistDeliveryStatus:", text);
      throw new Error(
        "La API devolvió una respuesta inválida al actualizar la entrega."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message || "No se pudo actualizar el estado de la entrega."
      );
    }

    return data.delivery || null;
  };

  const handleStartDelivery = async (deliveryId) => {
    if (!selectedDriver || startingDeliveryId || finishingDeliveryId) return;

    const normalizedDeliveryId = String(deliveryId);
    setStartingDeliveryId(normalizedDeliveryId);

    try {
      const driverId = selectedDriver._id || selectedDriver.id;

      await startNativeTrackingNow({ silent: true });

      const nowIso = new Date().toISOString();

      const optimisticDeliveries = deliveries.map((delivery) => {
        const currentId = String(delivery._id || delivery.id || "");

        if (currentId !== normalizedDeliveryId) return delivery;

        return {
          ...delivery,
          status: "En curso",
          startedAt: delivery.startedAt || nowIso,
          updatedAt: nowIso,
        };
      });

      updateDeliveriesStorage(optimisticDeliveries);
      setActiveDeliveryId(normalizedDeliveryId);
      setOpenedDeliveryId(normalizedDeliveryId);

      setListScopeFilter("En curso");
      setListStatusFilter("En curso");
      setListDateFilter("");

      const optimisticDriver = {
        ...selectedDriver,
        status: "En ruta",
      };

      setSelectedDriver(optimisticDriver);

      localStorage.setItem(
        "activeEnterpriseDriverData",
        JSON.stringify(optimisticDriver)
      );

      const persistedDelivery = await persistDeliveryStatus(
        normalizedDeliveryId,
        "En curso"
      );

      const persistedDeliveryId = String(
        persistedDelivery?._id || persistedDelivery?.id || normalizedDeliveryId
      );

      const finalDeliveries = optimisticDeliveries.map((delivery) => {
        const currentId = String(delivery._id || delivery.id || "");

        if (currentId !== persistedDeliveryId) return delivery;

        return {
          ...delivery,
          ...(persistedDelivery || {}),
          status: "En curso",
          startedAt: persistedDelivery?.startedAt || delivery.startedAt || nowIso,
          updatedAt: persistedDelivery?.updatedAt || new Date().toISOString(),
        };
      });

      updateDeliveriesStorage(finalDeliveries);
      setActiveDeliveryId(persistedDeliveryId);
      setOpenedDeliveryId(persistedDeliveryId);

      try {
        const persistedDriver = await persistDriverStatus(driverId, "En ruta");

        if (persistedDriver) {
          setSelectedDriver(persistedDriver);

          localStorage.setItem(
            "activeEnterpriseDriverData",
            JSON.stringify(persistedDriver)
          );
        }
      } catch (error) {
        console.error("No se pudo persistir el estado del conductor:", error);
      }
    } catch (error) {
      console.error("Error iniciando entrega:", error);
      alert(error.message || "No se pudo iniciar la entrega.");
    } finally {
      setStartingDeliveryId("");
    }
  };

  const handleFinishDelivery = async (deliveryId) => {
    if (!selectedDriver || startingDeliveryId || finishingDeliveryId) return;

    const normalizedDeliveryId = String(deliveryId);
    setFinishingDeliveryId(normalizedDeliveryId);

    try {
      const driverId = selectedDriver._id || selectedDriver.id;
      const nowIso = new Date().toISOString();

      const optimisticDeliveries = deliveries.map((delivery) => {
        const currentId = String(delivery._id || delivery.id || "");

        if (currentId !== normalizedDeliveryId) return delivery;

        return {
          ...delivery,
          status: "Finalizada",
          finishedAt: delivery.finishedAt || nowIso,
          updatedAt: nowIso,
        };
      });

      updateDeliveriesStorage(optimisticDeliveries);

      const persistedDelivery = await persistDeliveryStatus(
        normalizedDeliveryId,
        "Finalizada"
      );

      const persistedDeliveryId = String(
        persistedDelivery?._id || persistedDelivery?.id || normalizedDeliveryId
      );

      const finalDeliveries = optimisticDeliveries.map((delivery) => {
        const currentId = String(delivery._id || delivery.id || "");

        if (currentId !== persistedDeliveryId) return delivery;

        return {
          ...delivery,
          ...(persistedDelivery || {}),
          status: "Finalizada",
          finishedAt:
            persistedDelivery?.finishedAt || delivery.finishedAt || nowIso,
          updatedAt: persistedDelivery?.updatedAt || new Date().toISOString(),
        };
      });

      updateDeliveriesStorage(finalDeliveries);
      setOpenedDeliveryId(persistedDeliveryId);

      const remaining = finalDeliveries.filter((delivery) => {
        const assignedId =
          delivery.assignedDriverId?._id ||
          delivery.assignedDriverId ||
          delivery.driver?._id ||
          delivery.driver ||
          "";

        return (
          String(assignedId) === String(driverId) &&
          delivery.status !== "Finalizada"
        );
      });

      const nextActive = remaining.find(
        (delivery) => delivery.status === "En curso"
      );

      setActiveDeliveryId(nextActive?._id || nextActive?.id || "");

      if (nextActive) {
        setListScopeFilter("En curso");
        setListStatusFilter("En curso");
        setListDateFilter("");
      } else if (remaining.some((delivery) => delivery.status === "Pendiente")) {
        setListScopeFilter("Pendientes");
        setListStatusFilter("Pendiente");
        setListDateFilter("");
      } else {
        setListScopeFilter("Finalizados");
        setListStatusFilter("Finalizada");
        setListDateFilter("");
      }

      const nextDriverStatus = remaining.length ? "En ruta" : "Disponible";

      const updatedDriver = {
        ...selectedDriver,
        status: nextDriverStatus,
      };

      setSelectedDriver(updatedDriver);

      localStorage.setItem(
        "activeEnterpriseDriverData",
        JSON.stringify(updatedDriver)
      );

      try {
        const persistedDriver = await persistDriverStatus(
          driverId,
          nextDriverStatus
        );

        if (persistedDriver) {
          setSelectedDriver(persistedDriver);

          localStorage.setItem(
            "activeEnterpriseDriverData",
            JSON.stringify(persistedDriver)
          );
        }
      } catch (error) {
        console.error("No se pudo persistir el estado del conductor:", error);
      }
    } catch (error) {
      console.error("Error finalizando entrega:", error);
      alert(error.message || "No se pudo finalizar la entrega.");
    } finally {
      setFinishingDeliveryId("");
    }
  };

  const handleLogout = async () => {
    try {
      await stopBackgroundTracking();
    } catch (error) {
      console.error("[BG-NATIVE] Error deteniendo tracking al cerrar sesión:", error);
    }

    localStorage.removeItem("enterpriseDriverToken");
    localStorage.removeItem("activeEnterpriseDriverCedula");
    localStorage.removeItem("activeEnterpriseDriverId");
    localStorage.removeItem("activeEnterpriseDriverData");
    localStorage.removeItem("enterpriseDeliveries");

    nativeTrackingStartedRef.current = false;

    navigate("/enterprise-driver-login");
  };

  const handleScopeChange = (scope) => {
    setOpenedDeliveryId("");
    setListScopeFilter(scope);

    if (scope === "Pendientes") {
      setListStatusFilter("Pendiente");
      setListDateFilter("");
      return;
    }

    if (scope === "En curso") {
      setListStatusFilter("En curso");
      setListDateFilter("");
      return;
    }

    if (scope === "Finalizados") {
      setListStatusFilter("Finalizada");
      setListDateFilter("");
      return;
    }

    if (scope === "Hoy") {
      setListStatusFilter("Todos");
      setListDateFilter(new Date().toISOString().slice(0, 10));
      return;
    }

    if (scope === "Todos") {
      setListStatusFilter("Todos");
      setListDateFilter("");
    }
  };

  if (!activeCedula) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Sesión no válida
          </h2>
          <p className="mt-3 text-slate-600">
            Debes ingresar con tu cédula desde el acceso de conductor.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="mt-5 inline-flex rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white"
          >
            Ir al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  if (loadingDriver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Cargando panel...
          </h2>
          <p className="mt-3 text-slate-600">
            Estamos validando la sesión del conductor.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedDriver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Conductor no encontrado
          </h2>
          <p className="mt-3 text-slate-600">
            La cédula ingresada no está asociada a un conductor activo.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="mt-5 inline-flex rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white"
          >
            Volver al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-green-900 to-green-700 text-white">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute right-0 top-8 h-56 w-56 rounded-full bg-green-300 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-green-100 backdrop-blur">
                <span>🚚</span>
                <span>Central Go Conductores</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Panel del Conductor
              </h1>

              <p className="mt-2 text-sm text-green-100 md:text-base">
                Bienvenido, {selectedDriver.name}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => startNativeTrackingNow({ silent: false })}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-emerald-400 px-5 py-3 font-semibold text-slate-950 shadow-lg transition hover:scale-[1.02]"
              >
                Reactivar GPS segundo plano
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-green-800 shadow-lg transition hover:scale-[1.02]"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-green-100">Pedidos pendientes</p>
              <p className="mt-3 text-3xl font-extrabold">{stats.pending}</p>
              <p className="mt-1 text-xs text-green-100/80">Por iniciar</p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-green-100">En curso</p>
              <p className="mt-3 text-3xl font-extrabold">{stats.inProgress}</p>
              <p className="mt-1 text-xs text-green-100/80">Ruta activa</p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-green-100">Finalizadas</p>
              <p className="mt-3 text-3xl font-extrabold">{stats.finished}</p>
              <p className="mt-1 text-xs text-green-100/80">Entregas cerradas</p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-green-100">Total asignadas</p>
              <p className="mt-3 text-3xl font-extrabold">{stats.total}</p>
              <p className="mt-1 text-xs text-green-100/80">
                Historial del conductor
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_14px_42px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-2xl text-white shadow-lg shadow-emerald-600/20">
                🚚
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Conductor activo
                </p>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {selectedDriver.name}
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedDriver.vehicle || "Vehículo"} ·{" "}
                  {selectedDriver.plate || "Sin placa"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Cédula
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  {selectedDriver.cedula || "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Estado
                </p>
                <p
                  className={`mt-1 text-sm font-extrabold ${
                    selectedDriver.status === "En ruta"
                      ? "text-blue-700"
                      : "text-emerald-700"
                  }`}
                >
                  {selectedDriver.status || "Disponible"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Ubicación
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  {selectedDriver.currentLocation?.lat &&
                  selectedDriver.currentLocation?.lng
                    ? "Activa"
                    : "Sin GPS"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Última act.
                </p>
                <p className="mt-1 text-xs font-extrabold text-slate-900">
                  {selectedDriver.currentLocation?.updatedAt
                    ? new Date(
                        selectedDriver.currentLocation.updatedAt
                      ).toLocaleTimeString()
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <EnterpriseDriverMap
          selectedDriver={selectedDriver}
          assignedDeliveries={assignedDeliveries}
          activeDelivery={activeDelivery}
          setSelectedDriver={setSelectedDriver}
        />

        {selectedDriver ? (
          <div className="mt-6">
            <EnterpriseDriverDeliveryChat
              delivery={activeDelivery}
              selectedDriver={selectedDriver}
            />
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)]">
          <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-800 px-6 py-6 text-white">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-green-300/20 blur-3xl" />

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-100">
                  <span>🧭</span>
                  <span>Ruta del conductor</span>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight">
                  Orden de la ruta
                </h2>

                <p className="mt-1 max-w-2xl text-sm text-emerald-100">
                  Abre cada pedido para ver el detalle, iniciar, finalizar o navegar con
                  Waze/Maps.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-xs text-emerald-100">Pendientes</p>
                  <p className="text-2xl font-extrabold">{stats.pending}</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-xs text-emerald-100">En curso</p>
                  <p className="text-2xl font-extrabold">{stats.inProgress}</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-xs text-emerald-100">Hechas</p>
                  <p className="text-2xl font-extrabold">{stats.finished}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleScopeChange("Pendientes")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                    listScopeFilter === "Pendientes"
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Pendientes
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange("En curso")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                    listScopeFilter === "En curso"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  En curso
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange("Finalizados")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                    listScopeFilter === "Finalizados"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Finalizados
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange("Todos")}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                    listScopeFilter === "Todos"
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Todos
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:w-[620px]">
                <input
                  type="date"
                  value={listDateFilter}
                  onChange={(e) => {
                    setListDateFilter(e.target.value);
                    setListScopeFilter("Todos");
                    setOpenedDeliveryId("");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-green-400 focus:ring-4 focus:ring-green-100"
                />

                <select
                  value={listStatusFilter}
                  onChange={(e) => {
                    setListStatusFilter(e.target.value);
                    setListScopeFilter("Todos");
                    setOpenedDeliveryId("");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-green-400 focus:ring-4 focus:ring-green-100"
                >
                  <option value="Todos">Todos los estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En curso">En curso</option>
                  <option value="Finalizada">Finalizada</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setListStatusFilter("Pendiente");
                    setListDateFilter("");
                    setListScopeFilter("Pendientes");
                    setOpenedDeliveryId("");
                  }}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white transition hover:scale-[1.01]"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {!openedDelivery ? (
              <>
                {assignedDeliveries.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm">
                      📭
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      No tienes pedidos asignados
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Cuando logística te asigne una ruta, aparecerá aquí.
                    </p>
                  </div>
                ) : filteredAssignedDeliveries.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm">
                      🔎
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      No hay pedidos para este filtro
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Cambia el estado o limpia los filtros.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAssignedDeliveries.map((delivery, index) => {
                      const deliveryId = String(delivery._id || delivery.id || "");
                      const isActive =
                        String(activeDeliveryId || "") === deliveryId ||
                        delivery.status === "En curso";

                      return (
                        <div
                          key={delivery._id || delivery.id}
                          className={`rounded-[26px] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                            isActive
                              ? "border-blue-300 ring-4 ring-blue-100"
                              : delivery.status === "Finalizada"
                              ? "border-emerald-200"
                              : "border-slate-200"
                          }`}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-4">
                              <div
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white ${
                                  isActive
                                    ? "bg-blue-600"
                                    : delivery.status === "Finalizada"
                                    ? "bg-emerald-600"
                                    : "bg-amber-500"
                                }`}
                              >
                                {delivery.status === "Finalizada" ? "✓" : index + 1}
                              </div>

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-extrabold text-slate-900">
                                    {delivery.clientName || "Cliente sin nombre"}
                                  </h3>

                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${getStatusBadgeClass(
                                      delivery.status
                                    )}`}
                                  >
                                    {delivery.status || "Pendiente"}
                                  </span>

                                  {isActive ? (
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                                      Activa
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-sm font-semibold text-slate-600">
                                  Factura #{delivery.invoiceNumber || "Sin número"}
                                </p>

                                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                  {delivery.address || "Sin dirección"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setOpenedDeliveryId(deliveryId)}
                              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/10 transition hover:scale-[1.02]"
                            >
                              Abrir pedido
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                <div
                  className={`border-b px-5 py-5 ${
                    openedDelivery.status === "En curso"
                      ? "border-blue-100 bg-blue-50"
                      : openedDelivery.status === "Finalizada"
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-amber-100 bg-amber-50"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <button
                        type="button"
                        onClick={() => setOpenedDeliveryId("")}
                        className="mb-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
                      >
                        ← Atrás a la ruta
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-extrabold text-slate-900">
                          Factura #{openedDelivery.invoiceNumber || "Sin número"}
                        </h3>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${getStatusBadgeClass(
                            openedDelivery.status
                          )}`}
                        >
                          {openedDelivery.status || "Pendiente"}
                        </span>
                      </div>

                      <p className="mt-2 text-base font-bold text-slate-700">
                        {openedDelivery.clientName || "Cliente sin nombre"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {openedDelivery.status === "Pendiente" ? (
                        <button
                          type="button"
                          disabled={!!startingDeliveryId || !!finishingDeliveryId}
                          onClick={() =>
                            handleStartDelivery(openedDelivery._id || openedDelivery.id)
                          }
                          className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition ${
                            startingDeliveryId || finishingDeliveryId
                              ? "cursor-not-allowed bg-blue-300"
                              : "bg-blue-600 shadow-lg shadow-blue-600/20 hover:scale-[1.02]"
                          }`}
                        >
                          {startingDeliveryId ? "Iniciando..." : "Iniciar entrega"}
                        </button>
                      ) : null}

                      {openedDelivery.status === "En curso" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openNavigationForDelivery(
                                openedDelivery,
                                selectedDriver,
                                "waze"
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition hover:scale-[1.02]"
                          >
                            <span>🚙</span>
                            <span>Abrir Waze</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openNavigationForDelivery(
                                openedDelivery,
                                selectedDriver,
                                "google"
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:scale-[1.02]"
                          >
                            <span>📍</span>
                            <span>Abrir Maps</span>
                          </button>

                          <button
                            type="button"
                            disabled={!!startingDeliveryId || !!finishingDeliveryId}
                            onClick={() =>
                              handleFinishDelivery(
                                openedDelivery._id || openedDelivery.id
                              )
                            }
                            className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition ${
                              startingDeliveryId || finishingDeliveryId
                                ? "cursor-not-allowed bg-emerald-300"
                                : "bg-slate-900 shadow-lg shadow-slate-900/20 hover:scale-[1.02]"
                            }`}
                          >
                            {finishingDeliveryId
                              ? "Finalizando..."
                              : "Finalizar entrega"}
                          </button>
                        </>
                      ) : null}

                      {openedDelivery.status === "Finalizada" ? (
                        <div className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-extrabold text-emerald-700">
                          Entrega finalizada ✓
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Dirección de entrega
                      </p>

                      <p className="mt-2 text-lg font-extrabold leading-snug text-slate-900">
                        {openedDelivery.address || "Sin dirección"}
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-slate-400">
                            Barrio
                          </p>
                          <p className="mt-1 text-sm font-extrabold text-slate-800">
                            {openedDelivery.neighborhood || "Sin barrio"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-slate-400">
                            Referencia
                          </p>
                          <p className="mt-1 text-sm font-extrabold text-slate-800">
                            {openedDelivery.reference || "Sin referencia"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          Valor factura
                        </p>
                        <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                          {formatCurrencyCOP(openedDelivery.invoiceValue)}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          Método de pago
                        </p>
                        <p className="mt-2 text-sm font-extrabold text-slate-900">
                          {openedDelivery.paymentMethod || "No definido"}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                          Teléfono cliente
                        </p>
                        <p className="mt-2 text-sm font-extrabold text-slate-900">
                          {openedDelivery.clientPhone || "Sin teléfono"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {openedDelivery.notes ? (
                    <div className="lg:col-span-12">
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                          Observaciones
                        </p>
                        <p className="mt-1 text-sm font-semibold text-amber-900">
                          {openedDelivery.notes}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {openedDelivery.startedAt || openedDelivery.finishedAt ? (
                    <div className="lg:col-span-12">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {openedDelivery.startedAt ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                              Inicio
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {new Date(openedDelivery.startedAt).toLocaleString()}
                            </p>
                          </div>
                        ) : null}

                        {openedDelivery.finishedAt ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                              Finalizó
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {new Date(openedDelivery.finishedAt).toLocaleString()}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="lg:col-span-12">
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span
                        className={`h-3 w-3 rounded-full ${getStatusDotClass(
                          openedDelivery.status
                        )}`}
                      />
                      <span className="text-sm font-extrabold text-slate-800">
                        {openedDelivery.status === "Pendiente"
                          ? "Esta entrega está lista para iniciar."
                          : openedDelivery.status === "En curso"
                          ? "Esta entrega está activa. Puedes abrir Waze o Maps."
                          : "Esta entrega ya fue finalizada."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDriverPanel;