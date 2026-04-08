import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext"; // ajusta la ruta si este archivo está en otra carpeta

const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 }; // Medellín

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
  drivers,
  setDrivers,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const geocoderRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastGeocodeSignatureRef = useRef("");
  const [geoError, setGeoError] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [routeInfo, setRouteInfo] = useState({
    orderedStops: [],
    totalStops: 0,
  });

  const activeStops = useMemo(() => {
    return assignedDeliveries.filter(
      (delivery) => delivery.status !== "Finalizada" && delivery.address
    );
  }, [assignedDeliveries]);

  const persistDriverLocation = (coords) => {
    if (!selectedDriver) return;

    setDrivers((prevDrivers) => {
      const updatedDrivers = prevDrivers.map((driver) =>
        driver.id === selectedDriver.id
          ? {
              ...driver,
              currentLocation: {
                lat: Number(coords.lat),
                lng: Number(coords.lng),
                updatedAt: new Date().toISOString(),
              },
            }
          : driver
      );

      localStorage.setItem("enterpriseDrivers", JSON.stringify(updatedDrivers));
      return updatedDrivers;
    });
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
      });

      geocoderRef.current = new window.google.maps.Geocoder();

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer(
        {
          suppressMarkers: false,
          preserveViewport: false,
        }
      );

      directionsRendererRef.current.setMap(mapInstanceRef.current);
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

      if (!activeStops.length) {
        mapInstanceRef.current.setCenter(coords);
        mapInstanceRef.current.setZoom(15);
      }
    };

    const onError = (error) => {
      setIsTracking(false);

      if (error.code === 1) {
        setGeoError(
          "Debes permitir la ubicación en tiempo real para ver tu ruta."
        );
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
  }, [mapsApiLoaded, selectedDriver, activeStops.length]);

  useEffect(() => {
    if (
      !mapsApiLoaded ||
      !window.google?.maps ||
      !mapInstanceRef.current ||
      !geocoderRef.current ||
      !directionsRendererRef.current ||
      !selectedDriver?.currentLocation
    ) {
      return;
    }

    if (!activeStops.length) {
      directionsRendererRef.current.set("directions", null);
      setRouteInfo({ orderedStops: [], totalStops: 0 });
      return;
    }

    const signature = JSON.stringify({
      driverLocation: selectedDriver.currentLocation,
      stops: activeStops.map((item) => ({
        id: item.id,
        address: item.address,
        status: item.status,
      })),
    });

    if (signature === lastGeocodeSignatureRef.current) return;
    lastGeocodeSignatureRef.current = signature;

    const geocodeAddress = (address) =>
      new Promise((resolve, reject) => {
        geocoderRef.current.geocode({ address }, (results, status) => {
          if (status === "OK" && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            resolve({
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            reject(new Error(`No se pudo geocodificar: ${address}`));
          }
        });
      });

    const buildRoute = async () => {
      try {
        const geocodedStops = await Promise.all(
          activeStops.map(async (delivery) => {
            const coords = await geocodeAddress(delivery.address);
            return {
              ...delivery,
              coords,
            };
          })
        );

        const driverCoords = {
          lat: Number(selectedDriver.currentLocation.lat),
          lng: Number(selectedDriver.currentLocation.lng),
        };

        const orderedStops = [...geocodedStops].sort((a, b) => {
          const distA = haversineDistanceKm(driverCoords, a.coords);
          const distB = haversineDistanceKm(driverCoords, b.coords);
          return distA - distB;
        });

        setRouteInfo({
          orderedStops,
          totalStops: orderedStops.length,
        });

        const directionsService = new window.google.maps.DirectionsService();

        const origin = driverCoords;
        const destination =
          orderedStops.length === 1
            ? orderedStops[0].address
            : orderedStops[orderedStops.length - 1].address;

        const waypoints =
          orderedStops.length > 1
            ? orderedStops.slice(0, -1).map((stop) => ({
                location: stop.address,
                stopover: true,
              }))
            : [];

        directionsService.route(
          {
            origin,
            destination,
            waypoints,
            optimizeWaypoints: false,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK") {
              directionsRendererRef.current.setDirections(result);
            } else {
              console.error("Error trazando la ruta:", status);
            }
          }
        );
      } catch (error) {
        console.error("Error construyendo ruta:", error);
      }
    };

    buildRoute();
  }, [mapsApiLoaded, selectedDriver, activeStops]);

  return (
    <div>
      <div
        ref={mapRef}
        className="w-full h-80 rounded-2xl overflow-hidden"
        style={{ minHeight: "320px" }}
      />

      <div className="mt-3 space-y-2">
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

        {geoError ? (
          <p className="text-sm text-red-600 font-medium">{geoError}</p>
        ) : null}

        <p className="text-sm text-gray-600">
          Paradas pendientes: {routeInfo.totalStops}
        </p>

        {routeInfo.orderedStops.length > 0 ? (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-sm font-bold text-gray-900 mb-2">
              Orden sugerido por cercanía
            </p>

            <div className="space-y-2">
              {routeInfo.orderedStops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="text-sm text-gray-700 border-b last:border-b-0 pb-2 last:pb-0"
                >
                  <span className="font-semibold">{index + 1}.</span>{" "}
                  {stop.clientName} — {stop.address}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Aún no hay direcciones pendientes para dibujar ruta.
          </p>
        )}
      </div>
    </div>
  );
};

const EnterpriseDriverPanel = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [activeCedula, setActiveCedula] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedCedula =
      localStorage.getItem("activeEnterpriseDriverCedula") || "";
    setActiveCedula(savedCedula);

    const loadData = () => {
      const savedDrivers = JSON.parse(
        localStorage.getItem("enterpriseDrivers") || "[]"
      );
      const savedDeliveries = JSON.parse(
        localStorage.getItem("enterpriseDeliveries") || "[]"
      );

      setDrivers(savedDrivers);
      setDeliveries(savedDeliveries);
    };

    loadData();

    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedDriver = useMemo(() => {
    return drivers.find(
      (driver) => String(driver.cedula) === String(activeCedula)
    );
  }, [drivers, activeCedula]);

  const assignedDeliveries = useMemo(() => {
    if (!selectedDriver) return [];
    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id)
    );
  }, [deliveries, selectedDriver]);

  const updateDriversStorage = (updatedDrivers) => {
    setDrivers(updatedDrivers);
    localStorage.setItem("enterpriseDrivers", JSON.stringify(updatedDrivers));
  };

  const updateDeliveriesStorage = (updatedDeliveries) => {
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

  const handleStartDelivery = (deliveryId) => {
    if (!selectedDriver) return;

    const updatedDeliveries = deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "En curso",
            startedAt: new Date().toISOString(),
          }
        : delivery
    );

    updateDeliveriesStorage(updatedDeliveries);

    const updatedDrivers = drivers.map((driver) =>
      driver.id === selectedDriver.id
        ? {
            ...driver,
            status: "En ruta",
          }
        : driver
    );

    updateDriversStorage(updatedDrivers);
  };

  const handleFinishDelivery = (deliveryId) => {
    if (!selectedDriver) return;

    const updatedDeliveries = deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "Finalizada",
            finishedAt: new Date().toISOString(),
          }
        : delivery
    );

    updateDeliveriesStorage(updatedDeliveries);

    const hasOtherInProgress = updatedDeliveries.some(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id) &&
        delivery.status === "En curso"
    );

    const updatedDrivers = drivers.map((driver) =>
      driver.id === selectedDriver.id
        ? {
            ...driver,
            status: hasOtherInProgress ? "En ruta" : "Disponible",
          }
        : driver
    );

    updateDriversStorage(updatedDrivers);
  };

  const handleLogout = () => {
    localStorage.removeItem("activeEnterpriseDriverCedula");
    navigate("/enterprise-driver-login");
  };

  if (!activeCedula) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Sesión no válida
          </h2>
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
            drivers={drivers}
            setDrivers={setDrivers}
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
              {assignedDeliveries.map((delivery) => (
                <div key={delivery.id} className="border rounded-xl p-4">
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

                  <div className="flex gap-3 mt-4">
                    {delivery.status === "Pendiente" && (
                      <button
                        type="button"
                        onClick={() => handleStartDelivery(delivery.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        Iniciar entrega
                      </button>
                    )}

                    {delivery.status === "En curso" && (
                      <button
                        type="button"
                        onClick={() => handleFinishDelivery(delivery.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        Finalizar entrega
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDriverPanel;
