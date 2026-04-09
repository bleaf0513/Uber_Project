import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import { getApiBaseUrl } from "../apiBase";

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

  const [geoError, setGeoError] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [routeInfo, setRouteInfo] = useState({
    orderedStops: [],
    totalStops: 0,
    totalDistanceText: "",
    totalDurationText: "",
  });

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

  const persistDriverLocation = async (coords) => {
    if (!selectedDriver?._id) return;

    const updatedDriver = {
      ...selectedDriver,
      currentLocation: {
        lat: Number(coords.lat),
        lng: Number(coords.lng),
        updatedAt: new Date().toISOString(),
      },
    };

    setSelectedDriver(updatedDriver);
    localStorage.setItem(
      "activeEnterpriseDriverData",
      JSON.stringify(updatedDriver)
    );

    try {
      await fetch(
        `${API_BASE}/enterprise-drivers/${selectedDriver._id}/location`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            lat: Number(coords.lat),
            lng: Number(coords.lng),
          }),
        }
      );
    } catch (error) {
      console.error("No se pudo persistir la ubicación en backend:", error);
    }
  };

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: selectedDriver?.currentLocation
          ? {
              lat: Number(selectedDriver.currentLocation.lat),
              lng: Number(selectedDriver.currentLocation.lng),
            }
          : DEFAULT_CENTER,
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
      !selectedDriver
    ) {
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Este dispositivo no soporta geolocalización.");
      return;
    }

    const updatePosition = (position) => {
      const coords = {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude),
      };

      setGeoError("");
      setIsTracking(true);
      persistDriverLocation(coords);

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position: coords,
          title: `Conductor: ${selectedDriver.name}`,
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      } else {
        driverMarkerRef.current.setPosition(coords);
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

    watchIdRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      onError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [mapsApiLoaded, selectedDriver, pendingStops.length]);

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

              const legs = result.routes?.[0]?.legs || [];
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
                orderedStops,
                totalStops: orderedStops.length,
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
  }, [mapsApiLoaded, selectedDriver, pendingStops, activeDelivery]);

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
    const destination = stopsForNavigation[stopsForNavigation.length - 1].address;

    const waypoints =
      stopsForNavigation.length > 1
        ? stopsForNavigation
            .slice(0, -1)
            .map((stop) => encodeURIComponent(stop.address))
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
    <div>
      <div
        ref={mapRef}
        className="w-full h-[420px] rounded-2xl overflow-hidden border"
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 flex flex-wrap gap-4">
            <p className="text-sm text-gray-700">
              Seguimiento en tiempo real:{" "}
              <span
                className={`font-semibold ${
                  isTracking ? "text-green-600" : "text-red-600"
                }`}
              >
                {isTracking ? "Activo" : "Inactivo"}
              </span>
            </p>

            <p className="text-sm text-gray-700">
              Paradas:{" "}
              <span className="font-semibold text-gray-900">
                {visibleStops.length}
              </span>
            </p>

            <p className="text-sm text-gray-700">
              Distancia:{" "}
              <span className="font-semibold text-gray-900">
                {routeInfo.totalDistanceText || "—"}
              </span>
            </p>

            <p className="text-sm text-gray-700">
              Tiempo estimado:{" "}
              <span className="font-semibold text-gray-900">
                {routeInfo.totalDurationText || "—"}
              </span>
            </p>
          </div>

          {geoError ? (
            <p className="text-sm text-red-600 font-medium">{geoError}</p>
          ) : null}

          {activeDelivery ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
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
              className={`px-4 py-2 rounded-xl font-semibold ${
                canNavigate
                  ? "bg-green-600 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Abrir navegación en Google Maps
            </button>
          </div>

          {visibleStops.length > 0 ? (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-bold text-gray-900 mb-2">
                Orden de la ruta
              </p>

              <div className="space-y-2">
                {visibleStops.map((stop, index) => (
                  <div
                    key={stop._id || stop.id || index}
                    className={`text-sm border-b last:border-b-0 pb-2 last:pb-0 ${
                      String(activeDelivery?._id || activeDelivery?.id) ===
                      String(stop._id || stop.id)
                        ? "text-blue-700 font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    <span className="font-semibold">{index + 1}.</span>{" "}
                    {stop.clientName} — {stop.address}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aún no hay direcciones pendientes para dibujar la ruta.
            </p>
          )}
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="font-bold text-gray-900">Indicaciones</p>
            <p className="text-xs text-gray-500">
              Paso a paso de la navegación
            </p>
          </div>

          <div
            ref={directionsPanelRef}
            className="p-3 text-sm text-gray-700 max-h-[420px] overflow-y-auto"
          />
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
          const parsedDriver = JSON.parse(savedDriverData);
          setSelectedDriver(parsedDriver);
          currentDriver = parsedDriver;
        }

        if (savedDriverId) {
          const response = await fetch(`${API_BASE}/enterprise-drivers`, {
            method: "GET",
            credentials: "include",
          });

          const text = await response.text();
          const data = JSON.parse(text);

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

        const deliveriesResponse = await fetch(`${API_BASE}/enterprise-deliveries/me`, {
          method: "GET",
          credentials: "include",
        });

        const deliveriesText = await deliveriesResponse.text();
        const deliveriesData = JSON.parse(deliveriesText);

        if (!deliveriesResponse.ok) {
          throw new Error(
            deliveriesData.message || "No se pudieron cargar los pedidos del conductor."
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

  const updateDeliveriesStorage = (updatedDeliveries) => {
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

  const persistDriverStatus = async (driverId, status) => {
    try {
      const response = await fetch(`${API_BASE}/enterprise-drivers/${driverId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        console.error("Respuesta no JSON en persistDriverStatus:", text);
        return null;
      }

      if (!response.ok) {
        console.error("Error actualizando estado del conductor:", data.message || text);
        return null;
      }

      return data.driver || null;
    } catch (error) {
      console.error("Failed to fetch en persistDriverStatus:", error);
      return null;
    }
  };

  const persistDeliveryStatus = async (deliveryId, status) => {
    const response = await fetch(`${API_BASE}/enterprise-deliveries/${deliveryId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ status }),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data.message || "No se pudo actualizar el estado de la entrega.");
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
        await persistDriverStatus(driverId, "En ruta");
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

      const optimisticDeliveries = deliveries.map((delivery) => {
        const currentId = delivery._id || delivery.id;

        return String(currentId) === String(deliveryId)
          ? {
              ...delivery,
              status: "Finalizada",
              finishedAt: new Date().toISOString(),
            }
          : delivery;
      });

      updateDeliveriesStorage(optimisticDeliveries);

      const remainingOptimistic = optimisticDeliveries.filter((delivery) => {
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

      const nextOptimistic = remainingOptimistic.find(
        (delivery) => delivery.status === "En curso"
      );
      setActiveDeliveryId(nextOptimistic?._id || nextOptimistic?.id || "");

      const nextDriverStatus = remainingOptimistic.length ? "En ruta" : "Disponible";

      const optimisticDriver = {
        ...selectedDriver,
        status: nextDriverStatus,
      };

      setSelectedDriver(optimisticDriver);
      localStorage.setItem(
        "activeEnterpriseDriverData",
        JSON.stringify(optimisticDriver)
      );

      const persistedDelivery = await persistDeliveryStatus(deliveryId, "Finalizada");

      const normalizedPersistedDeliveryId =
        persistedDelivery?._id || persistedDelivery?.id || deliveryId;

      const updatedDeliveries = optimisticDeliveries.map((delivery) => {
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

      try {
        await persistDriverStatus(driverId, nextDriverStatus);
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

  if (!activeCedula) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">Sesión no válida</h2>
          <p className="text-gray-600 mt-3">
            Debes ingresar con tu cédula desde el acceso de conductor.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Ir al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  if (loadingDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">Cargando panel...</h2>
          <p className="text-gray-600 mt-3">
            Estamos validando la sesión del conductor.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Conductor no encontrado
          </h2>
          <p className="text-gray-600 mt-3">
            La cédula ingresada no está asociada a un conductor activo.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Volver al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel del Conductor</h1>
            <p className="text-sm text-green-100 mt-1">
              Bienvenido, {selectedDriver.name}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="bg-white text-green-700 px-4 py-2 rounded-xl font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tus datos</h2>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
            <p className="text-sm text-gray-600">
              Cédula: {selectedDriver.cedula}
            </p>
            <p className="text-sm text-gray-600">
              Estado: {selectedDriver.status || "Disponible"}
            </p>
            <p className="text-sm text-gray-600">
              Vehículo: {selectedDriver.vehicle} · {selectedDriver.plate}
            </p>
            <p className="text-sm text-gray-600">
              Ubicación:{" "}
              {selectedDriver.currentLocation
                ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                : "Aún no reportada"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Tu ruta</h2>

          <EnterpriseDriverMap
            selectedDriver={selectedDriver}
            assignedDeliveries={assignedDeliveries}
            activeDelivery={activeDelivery}
            setSelectedDriver={setSelectedDriver}
          />
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Tus pedidos asignados
          </h2>

          {assignedDeliveries.length === 0 ? (
            <p className="text-gray-500">
              No tienes pedidos asignados en este momento.
            </p>
          ) : (
            <div className="space-y-4">
              {assignedDeliveries.map((delivery) => {
                const deliveryId = String(delivery._id || delivery.id || "");
                const isStarting = startingDeliveryId === deliveryId;
                const isFinishing = finishingDeliveryId === deliveryId;
                const isBusy = !!startingDeliveryId || !!finishingDeliveryId;

                return (
                  <div key={delivery._id || delivery.id} className="border rounded-xl p-4">
                    <p className="font-bold text-gray-900">
                      Factura #{delivery.invoiceNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      Cliente: {delivery.clientName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Dirección: {delivery.address}
                    </p>
                    <p className="text-sm text-gray-600">
                      Teléfono: {delivery.clientPhone}
                    </p>

                    <p className="text-sm mt-2">
                      Estado:{" "}
                      <span
                        className={
                          delivery.status === "Finalizada"
                            ? "text-green-600 font-semibold"
                            : delivery.status === "En curso"
                            ? "text-blue-600 font-semibold"
                            : "text-yellow-600 font-semibold"
                        }
                      >
                        {delivery.status}
                      </span>
                    </p>

                    {delivery.notes ? (
                      <p className="text-sm text-gray-500 mt-1">
                        Observaciones: {delivery.notes}
                      </p>
                    ) : null}

                    <div className="flex gap-3 mt-4 flex-wrap">
                      {delivery.status === "Pendiente" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleStartDelivery(delivery._id || delivery.id)}
                          className={`px-4 py-2 rounded-xl font-semibold text-white ${
                            isBusy
                              ? "bg-blue-300 cursor-not-allowed"
                              : "bg-blue-600"
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
                            onClick={() => handleFinishDelivery(delivery._id || delivery.id)}
                            className={`px-4 py-2 rounded-xl font-semibold text-white ${
                              isBusy
                                ? "bg-green-300 cursor-not-allowed"
                                : "bg-green-600"
                            }`}
                          >
                            {isFinishing ? "Finalizando..." : "Finalizar entrega"}
                          </button>

                          <span className="inline-flex items-center px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold">
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
  );
};

export default EnterpriseDriverPanel;
