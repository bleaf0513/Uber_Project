import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import { getApiBaseUrl } from "../apiBase";
import EnterpriseDriverDeliveryChat from "./EnterpriseDriverDeliveryChat";

const API_BASE = getApiBaseUrl();
const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };

const haversineDistanceKm = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;

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

const formatCurrencyCOP = (value) => {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const EnterpriseDriverMap = ({
  selectedDriver,
  assignedDeliveries,
  activeDelivery,
  setSelectedDriver,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const mapRef = useRef(null);
  const directionsPanelRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const geocoderRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastSignatureRef = useRef("");
  const routeBuildIdRef = useRef(0);
  const selectedDriverRef = useRef(selectedDriver);
  const trackingStartedRef = useRef(false);
  const lastSentCoordsRef = useRef(null);
  const sendingLocationRef = useRef(false);

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
    const base = assignedDeliveries.filter(
      (delivery) =>
        delivery &&
        delivery.status !== "Finalizada" &&
        delivery.address &&
        String(delivery.address).trim() !== ""
    );

    if (activeDelivery?._id || activeDelivery?.id) {
      const activeId = String(activeDelivery._id || activeDelivery.id);
      const current = base.find((d) => String(d._id || d.id) === activeId);
      const others = base.filter((d) => String(d._id || d.id) !== activeId);
      return current ? [current, ...others] : [activeDelivery, ...others];
    }

    return base;
  }, [assignedDeliveries, activeDelivery]);

  const persistDriverLocation = useCallback(
    async (coords) => {
      const currentDriver = selectedDriverRef.current;

      if (!currentDriver?._id) return false;
      if (sendingLocationRef.current) return false;

      const roundedCoords = {
        lat: Number(Number(coords.lat).toFixed(6)),
        lng: Number(Number(coords.lng).toFixed(6)),
      };

      const last = lastSentCoordsRef.current;
      if (last && last.lat === roundedCoords.lat && last.lng === roundedCoords.lng) {
        return true;
      }

      sendingLocationRef.current = true;

      try {
        const response = await fetch(
          `${API_BASE}/enterprise-drivers/${currentDriver._id}/location`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
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
        setGeoError("");

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

      if (selectedDriver?.currentLocation?.lat && selectedDriver?.currentLocation?.lng) {
        driverMarkerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position: {
            lat: Number(selectedDriver.currentLocation.lat),
            lng: Number(selectedDriver.currentLocation.lng),
          },
          title: `Conductor: ${selectedDriver?.name || "Conductor"}`,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      }
    }

    if (directionsRendererRef.current && directionsPanelRef.current) {
      directionsRendererRef.current.setPanel(directionsPanelRef.current);
    }
  }, [mapsApiLoaded, selectedDriver]);

  useEffect(() => {
    if (
      !mapsApiLoaded ||
      !window.google?.maps ||
      !mapInstanceRef.current ||
      !selectedDriver?._id
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

      setIsTracking(true);

      const saved = await persistDriverLocation(coords);
      if (!saved) return;

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position: coords,
          title: `Conductor: ${selectedDriverRef.current?.name || "Conductor"}`,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      } else {
        driverMarkerRef.current.setPosition(coords);
        driverMarkerRef.current.setTitle(
          `Conductor: ${selectedDriverRef.current?.name || "Conductor"}`
        );
      }

      if (!pendingStops.length) {
        mapInstanceRef.current.setCenter(coords);
        mapInstanceRef.current.setZoom(15);
      }
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
      timeout: 15000,
      maximumAge: 0,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(updatePosition, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 3000,
    });

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      trackingStartedRef.current = false;
    };
  }, [mapsApiLoaded, selectedDriver?._id, persistDriverLocation, pendingStops.length]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapInstanceRef.current) return;

    const driverLocation = selectedDriver?.currentLocation;
    if (!driverLocation?.lat || !driverLocation?.lng) return;

    const coords = {
      lat: Number(driverLocation.lat),
      lng: Number(driverLocation.lng),
    };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: coords,
        title: `Conductor: ${selectedDriver?.name || "Conductor"}`,
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });
    } else {
      driverMarkerRef.current.setPosition(coords);
      driverMarkerRef.current.setTitle(
        `Conductor: ${selectedDriver?.name || "Conductor"}`
      );
    }
  }, [mapsApiLoaded, selectedDriver?.currentLocation, selectedDriver?.name]);

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
      return;
    }

    if (!pendingStops.length) {
      directionsRendererRef.current.set("directions", null);
      if (directionsPanelRef.current) {
        directionsPanelRef.current.innerHTML = "";
      }
      setRouteInfo({
        orderedStops: [],
        totalStops: 0,
        totalDistanceText: "",
        totalDurationText: "",
      });
      return;
    }

    const signature = JSON.stringify({
      driverLat: Number(driverLocation.lat).toFixed(6),
      driverLng: Number(driverLocation.lng).toFixed(6),
      activeDeliveryId: activeDelivery?._id || activeDelivery?.id || null,
      stops: pendingStops.map((s) => ({
        id: s._id || s.id,
        address: s.address,
        status: s.status,
      })),
    });

    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    const geocodeAddress = (address) =>
      new Promise((resolve, reject) => {
        geocoderRef.current.geocode({ address }, (results, status) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            resolve({
              lat: location.lat(),
              lng: location.lng(),
              formattedAddress: results[0].formatted_address || address,
            });
          } else {
            reject(new Error(`No se pudo geocodificar: ${address}`));
          }
        });
      });

    const buildRoute = async () => {
      const buildId = ++routeBuildIdRef.current;

      try {
        const geocodedStops = await Promise.all(
          pendingStops.map(async (delivery) => {
            const coords = await geocodeAddress(delivery.address);
            return {
              ...delivery,
              coords,
              formattedAddress: coords.formattedAddress,
            };
          })
        );

        if (buildId !== routeBuildIdRef.current) return;

        const originCoords = {
          lat: Number(driverLocation.lat),
          lng: Number(driverLocation.lng),
        };

        let orderedStops = [...geocodedStops];

        if (!(activeDelivery?._id || activeDelivery?.id)) {
          orderedStops.sort((a, b) => {
            const distA = haversineDistanceKm(originCoords, a.coords);
            const distB = haversineDistanceKm(originCoords, b.coords);
            return distA - distB;
          });
        }

        const directionsService = new window.google.maps.DirectionsService();

        const destination =
          orderedStops.length === 1
            ? orderedStops[0].formattedAddress || orderedStops[0].address
            : orderedStops[orderedStops.length - 1].formattedAddress ||
              orderedStops[orderedStops.length - 1].address;

        const waypoints =
          orderedStops.length > 1
            ? orderedStops.slice(0, -1).map((stop) => ({
                location: stop.formattedAddress || stop.address,
                stopover: true,
              }))
            : [];

        directionsService.route(
          {
            origin: originCoords,
            destination,
            waypoints,
            optimizeWaypoints: !(activeDelivery?._id || activeDelivery?.id),
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (buildId !== routeBuildIdRef.current) return;

            if (status === "OK" && result) {
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

              let orderedStopsFromRoute = orderedStops;

              if (
                route?.waypoint_order &&
                Array.isArray(route.waypoint_order) &&
                orderedStops.length > 1 &&
                !(activeDelivery?._id || activeDelivery?.id)
              ) {
                const reorderedIntermediate = route.waypoint_order.map(
                  (idx) => orderedStops[idx]
                );
                const finalDestination = orderedStops[orderedStops.length - 1];
                orderedStopsFromRoute = [...reorderedIntermediate, finalDestination];
              }

              setRouteInfo({
                orderedStops: orderedStopsFromRoute,
                totalStops: orderedStopsFromRoute.length,
                totalDistanceText: `${totalKm} km`,
                totalDurationText:
                  totalMin >= 60
                    ? `${Math.floor(totalMin / 60)} h ${totalMin % 60} min`
                    : `${totalMin} min`,
              });
            } else {
              console.error("Error trazando la ruta:", status);
              setRouteInfo({
                orderedStops: geocodedStops,
                totalStops: geocodedStops.length,
                totalDistanceText: "",
                totalDurationText: "",
              });
            }
          }
        );
      } catch (error) {
        console.error("Error construyendo ruta:", error);
        setRouteInfo({
          orderedStops: activeDelivery?.address ? [activeDelivery] : [],
          totalStops: activeDelivery?.address ? 1 : 0,
          totalDistanceText: "",
          totalDurationText: "",
        });
      }
    };

    buildRoute();
  }, [mapsApiLoaded, selectedDriver?.currentLocation, pendingStops, activeDelivery]);

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

    window.open(url, "_blank");
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
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-green-50 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Mapa y navegación de ruta
            </h3>
            <p className="text-sm text-slate-500">
              Seguimiento en tiempo real, orden de paradas e indicaciones paso a paso.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-3 py-1 ${
                isTracking ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {isTracking ? "Seguimiento activo" : "Seguimiento inactivo"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Paradas: {visibleStops.length}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Distancia: {routeInfo.totalDistanceText || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div
          ref={mapRef}
          className="w-full h-[420px] rounded-[24px] overflow-hidden border border-slate-200"
        />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado GPS
                </p>
                <p
                  className={`mt-2 text-sm font-bold ${
                    isTracking ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isTracking ? "Activo" : "Inactivo"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Paradas
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {visibleStops.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Distancia total
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {routeInfo.totalDistanceText || "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tiempo estimado
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {routeInfo.totalDurationText || "—"}
                </p>
              </div>
            </div>

            {geoError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {geoError}
              </div>
            ) : null}

            {activeDelivery ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-900 mb-1">
                  Entrega en curso
                </p>
                <p className="text-sm text-blue-800">
                  {activeDelivery.clientName} — {activeDelivery.address}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openExternalGoogleMaps}
                disabled={!canNavigate}
                className={`px-4 py-2.5 rounded-2xl font-semibold transition ${
                  canNavigate
                    ? "bg-green-600 text-white hover:scale-[1.02]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Abrir navegación en Google Maps
              </button>
            </div>

            {visibleStops.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900 mb-3">
                  Orden de la ruta
                </p>

                <div className="space-y-2">
                  {visibleStops.map((stop, index) => (
                    <div
                      key={stop._id || stop.id || index}
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        String(activeDelivery?._id || activeDelivery?.id) ===
                        String(stop._id || stop.id)
                          ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span className="font-semibold">{index + 1}.</span>{" "}
                      {stop.clientName} — {stop.address}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Aún no hay direcciones pendientes para dibujar la ruta.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="font-bold text-slate-900">Indicaciones</p>
              <p className="text-xs text-slate-500">
                Paso a paso de la navegación
              </p>
            </div>

            <div
              ref={directionsPanelRef}
              className="p-3 text-sm text-slate-700 max-h-[420px] overflow-y-auto"
            />
          </div>
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
  const navigate = useNavigate();

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
          const response = await fetch(`${API_BASE}/enterprise-drivers`, {
            method: "GET",
            credentials: "include",
          });

          const text = await response.text();
          const data = text ? JSON.parse(text) : {};

          if (response.ok && data?.drivers?.length) {
            const matched = data.drivers.find(
              (driver) => String(driver._id) === String(savedDriverId)
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
        }

        const deliveriesResponse = await fetch(
          `${API_BASE}/enterprise-deliveries/me`,
          {
            method: "GET",
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
    return assignedDeliveries.find(
      (delivery) =>
        String(delivery._id || delivery.id) === String(activeDeliveryId)
    );
  }, [assignedDeliveries, activeDeliveryId]);

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

  const filteredAssignedDeliveries = useMemo(() => {
    return assignedDeliveries
      .filter((delivery) => {
        const matchesStatus =
          listStatusFilter === "Todos" ||
          String(delivery?.status || "") === String(listStatusFilter);

        const deliveryDate = getDeliveryReferenceDate(delivery);

        const matchesDate =
          listScopeFilter === "Todos"
            ? !listDateFilter || deliveryDate === listDateFilter
            : !listDateFilter || deliveryDate === listDateFilter;

        return matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        const aTime = new Date(
          a?.createdAt || a?.updatedAt || a?.startedAt || a?.finishedAt || 0
        ).getTime();
        const bTime = new Date(
          b?.createdAt || b?.updatedAt || b?.startedAt || b?.finishedAt || 0
        ).getTime();

        return bTime - aTime;
      });
  }, [
    assignedDeliveries,
    listStatusFilter,
    listDateFilter,
    listScopeFilter,
    getDeliveryReferenceDate,
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
          headers: {
            "Content-Type": "application/json",
          },
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
        headers: {
          "Content-Type": "application/json",
        },
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

    setStartingDeliveryId(String(deliveryId));

    try {
      const driverId = selectedDriver._id || selectedDriver.id;

      const optimisticDeliveries = deliveries.map((delivery) => {
        const currentId = delivery._id || delivery.id;

        return String(currentId) === String(deliveryId)
          ? {
              ...delivery,
              status: "En curso",
              startedAt: new Date().toISOString(),
            }
          : delivery;
      });

      updateDeliveriesStorage(optimisticDeliveries);
      setActiveDeliveryId(String(deliveryId));

      const optimisticDriver = {
        ...selectedDriver,
        status: "En ruta",
      };

      setSelectedDriver(optimisticDriver);
      localStorage.setItem(
        "activeEnterpriseDriverData",
        JSON.stringify(optimisticDriver)
      );

      const persistedDelivery = await persistDeliveryStatus(deliveryId, "En curso");

      const normalizedPersistedDeliveryId =
        persistedDelivery?._id || persistedDelivery?.id || deliveryId;

      const updatedDeliveries = optimisticDeliveries.map((delivery) => {
        const currentId = delivery._id || delivery.id;

        if (String(currentId) === String(normalizedPersistedDeliveryId)) {
          return {
            ...delivery,
            ...persistedDelivery,
          };
        }

        return delivery;
      });

      updateDeliveriesStorage(updatedDeliveries);
      setActiveDeliveryId(String(normalizedPersistedDeliveryId));

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

    setFinishingDeliveryId(String(deliveryId));

    try {
      const driverId = selectedDriver._id || selectedDriver.id;

      const persistedDelivery = await persistDeliveryStatus(deliveryId, "Finalizada");

      const normalizedPersistedDeliveryId =
        persistedDelivery?._id || persistedDelivery?.id || deliveryId;

      const updatedDeliveries = deliveries.map((delivery) => {
        const currentId = delivery._id || delivery.id;

        return String(currentId) === String(normalizedPersistedDeliveryId)
          ? {
              ...delivery,
              ...persistedDelivery,
            }
          : delivery;
      });

      updateDeliveriesStorage(updatedDeliveries);

      const remaining = updatedDeliveries.filter((delivery) => {
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

      const nextActive = remaining.find((delivery) => delivery.status === "En curso");
      setActiveDeliveryId(nextActive?._id || nextActive?.id || "");

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
        const persistedDriver = await persistDriverStatus(driverId, nextDriverStatus);
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

  const handleLogout = () => {
    localStorage.removeItem("activeEnterpriseDriverCedula");
    localStorage.removeItem("activeEnterpriseDriverId");
    localStorage.removeItem("activeEnterpriseDriverData");
    localStorage.removeItem("enterpriseDeliveries");
    navigate("/enterprise-driver-login");
  };

  const handleScopeChange = (scope) => {
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
    return;
  }
};

  if (!activeCedula) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">Sesión no válida</h2>
          <p className="mt-3 text-slate-600">
            Debes ingresar con tu cédula desde el acceso de conductor.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-flex mt-5 rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white"
          >
            Ir al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  if (loadingDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">Cargando panel...</h2>
          <p className="mt-3 text-slate-600">
            Estamos validando la sesión del conductor.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Conductor no encontrado
          </h2>
          <p className="mt-3 text-slate-600">
            La cédula ingresada no está asociada a un conductor activo.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-flex mt-5 rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white"
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
          <div className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute top-8 right-0 h-56 w-56 rounded-full bg-green-300 blur-3xl" />
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

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-green-800 shadow-lg transition hover:scale-[1.02]"
            >
              Cerrar sesión
            </button>
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
              <p className="mt-1 text-xs text-green-100/80">Historial del conductor</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-green-50 px-6 py-5">
                <h2 className="text-xl font-extrabold text-slate-900">Tus datos</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Información general del conductor y ubicación actual.
                </p>
              </div>

              <div className="p-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <p className="text-lg font-extrabold text-slate-900">{selectedDriver.name}</p>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cédula
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selectedDriver.cedula}</p>
                    </div>

                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Estado
                      </p>
                      <div className="mt-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                            selectedDriver.status === "En ruta"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {selectedDriver.status || "Disponible"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Vehículo
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {selectedDriver.vehicle} · {selectedDriver.plate}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ubicación
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {selectedDriver.currentLocation?.lat && selectedDriver.currentLocation?.lng
                          ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                          : "Aún no reportada"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-4 border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Última actualización
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {selectedDriver.currentLocation?.updatedAt
                          ? new Date(selectedDriver.currentLocation.updatedAt).toLocaleString()
                          : "Sin actualización"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-8">
            <EnterpriseDriverMap
              selectedDriver={selectedDriver}
              assignedDeliveries={assignedDeliveries}
              activeDelivery={activeDelivery}
              setSelectedDriver={setSelectedDriver}
            />
          </div>
        </div>

        {selectedDriver ? (
          <div className="mt-6">
            <EnterpriseDriverDeliveryChat
              delivery={activeDelivery}
              selectedDriver={selectedDriver}
            />
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Tus pedidos asignados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Por defecto se muestran los pedidos pendientes para evitar una lista muy larga.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200">
                Total mostrados: {filteredAssignedDeliveries.length}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
  <button
    type="button"
    onClick={() => handleScopeChange("Pendientes")}
    className={`px-4 py-2 rounded-2xl font-semibold transition ${
      listScopeFilter === "Pendientes"
        ? "bg-amber-500 text-white shadow-md"
        : "bg-slate-100 text-slate-700 border border-slate-200"
    }`}
  >
    Pendientes
  </button>

  <button
    type="button"
    onClick={() => handleScopeChange("En curso")}
    className={`px-4 py-2 rounded-2xl font-semibold transition ${
      listScopeFilter === "En curso"
        ? "bg-blue-600 text-white shadow-md"
        : "bg-slate-100 text-slate-700 border border-slate-200"
    }`}
  >
    En curso
  </button>

  <button
    type="button"
    onClick={() => handleScopeChange("Finalizados")}
    className={`px-4 py-2 rounded-2xl font-semibold transition ${
      listScopeFilter === "Finalizados"
        ? "bg-emerald-600 text-white shadow-md"
        : "bg-slate-100 text-slate-700 border border-slate-200"
    }`}
  >
    Finalizados
  </button>

  <button
    type="button"
    onClick={() => handleScopeChange("Hoy")}
    className={`px-4 py-2 rounded-2xl font-semibold transition ${
      listScopeFilter === "Hoy"
        ? "bg-green-600 text-white shadow-md"
        : "bg-slate-100 text-slate-700 border border-slate-200"
    }`}
  >
    Ver hoy
  </button>

  <button
    type="button"
    onClick={() => handleScopeChange("Todos")}
    className={`px-4 py-2 rounded-2xl font-semibold transition ${
      listScopeFilter === "Todos"
        ? "bg-slate-800 text-white shadow-md"
        : "bg-slate-100 text-slate-700 border border-slate-200"
    }`}
  >
    Ver todos
  </button>
</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <input
                type="date"
                value={listDateFilter}
                onChange={(e) => {
                  setListDateFilter(e.target.value);
                  setListScopeFilter("Todos");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-green-400 focus:bg-white focus:ring-4 focus:ring-green-100"
              />

              <select
                value={listStatusFilter}
                onChange={(e) => {
                  setListStatusFilter(e.target.value);
                  setListScopeFilter("Todos");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-green-400 focus:bg-white focus:ring-4 focus:ring-green-100"
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
                }}
                className="w-full rounded-2xl bg-slate-800 px-4 py-3 font-semibold text-white transition hover:scale-[1.01]"
              >
                Reiniciar filtros
              </button>
            </div>

            {assignedDeliveries.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-slate-500">
                No tienes pedidos asignados en este momento.
              </div>
            ) : filteredAssignedDeliveries.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-slate-500">
                No hay pedidos para este filtro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredAssignedDeliveries.map((delivery) => {
                  const deliveryId = String(delivery._id || delivery.id || "");
                  const isStarting = startingDeliveryId === deliveryId;
                  const isFinishing = finishingDeliveryId === deliveryId;
                  const isBusy = !!startingDeliveryId || !!finishingDeliveryId;

                  return (
                    <div
                      key={delivery._id || delivery.id}
                      className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-extrabold text-slate-900">
                              Factura #{delivery.invoiceNumber}
                            </p>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                                delivery.status
                              )}`}
                            >
                              {delivery.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Fecha: {getDeliveryReferenceDate(delivery) || "Sin fecha"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Cliente
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.clientName}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Teléfono
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.clientPhone || "Sin teléfono"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Dirección
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.address}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Valor factura
                          </p>
                          <p className="mt-1 text-sm font-bold text-emerald-700">
                            {formatCurrencyCOP(delivery.invoiceValue)}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Método de pago
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.paymentMethod || "No definido"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Barrio
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.neighborhood || "Sin barrio"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4 border border-slate-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Referencia
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.reference || "Sin referencia"}
                          </p>
                        </div>

                        {delivery.placeId ? (
                          <div className="rounded-2xl bg-white p-4 border border-slate-200 sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Place ID
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900 break-all">
                              {delivery.placeId}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {delivery.notes ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Observaciones
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {delivery.notes}
                          </p>
                        </div>
                      ) : null}

                      {(delivery.startedAt || delivery.finishedAt) ? (
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {delivery.startedAt ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Inicio
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-800">
                                {new Date(delivery.startedAt).toLocaleString()}
                              </p>
                            </div>
                          ) : null}

                          {delivery.finishedAt ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Finalizó
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-800">
                                {new Date(delivery.finishedAt).toLocaleString()}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-5 flex gap-3 flex-wrap">
                        {delivery.status === "Pendiente" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleStartDelivery(delivery._id || delivery.id)
                            }
                            className={`px-4 py-2.5 rounded-2xl font-semibold text-white transition ${
                              isBusy
                                ? "bg-blue-300 cursor-not-allowed"
                                : "bg-blue-600 hover:scale-[1.02]"
                            }`}
                          >
                            {isStarting ? "Iniciando..." : "Iniciar entrega"}
                          </button>
                        )}

                        {delivery.status === "En curso" && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleFinishDelivery(delivery._id || delivery.id)
                              }
                              className={`px-4 py-2.5 rounded-2xl font-semibold text-white transition ${
                                isBusy
                                  ? "bg-green-300 cursor-not-allowed"
                                  : "bg-green-600 hover:scale-[1.02]"
                              }`}
                            >
                              {isFinishing ? "Finalizando..." : "Finalizar entrega"}
                            </button>

                            <span className="inline-flex items-center rounded-2xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 border border-blue-200">
                              Ruta activa en el mapa
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDriverPanel;
