import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";

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

const LogisticsDriverMap = ({ selectedDriver, driverDeliveries }) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const deliveryMarkersRef = useRef([]);
  const directionsRendererRef = useRef(null);
  const [orderedStops, setOrderedStops] = useState([]);

  const activeStops = useMemo(() => {
    return driverDeliveries.filter(
      (delivery) =>
        delivery.status !== "Finalizada" &&
        delivery.deliveryLocation &&
        typeof delivery.deliveryLocation.lat !== "undefined" &&
        typeof delivery.deliveryLocation.lng !== "undefined"
    );
  }, [driverDeliveries]);

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

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
      });

      directionsRendererRef.current.setMap(mapInstanceRef.current);
    }
  }, [mapsApiLoaded, selectedDriver]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapInstanceRef.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

    deliveryMarkersRef.current.forEach((marker) => marker.setMap(null));
    deliveryMarkersRef.current = [];

    if (!selectedDriver?.currentLocation) {
      setOrderedStops([]);
      if (directionsRendererRef.current) {
        directionsRendererRef.current.set("directions", null);
      }
      return;
    }

    const driverCoords = {
      lat: Number(selectedDriver.currentLocation.lat),
      lng: Number(selectedDriver.currentLocation.lng),
    };

    driverMarkerRef.current = new window.google.maps.Marker({
      map: mapInstanceRef.current,
      position: driverCoords,
      title: `Conductor: ${selectedDriver.name}`,
      icon: {
        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      },
    });

    mapInstanceRef.current.setCenter(driverCoords);

    if (!activeStops.length) {
      mapInstanceRef.current.setZoom(15);
      setOrderedStops([]);
      if (directionsRendererRef.current) {
        directionsRendererRef.current.set("directions", null);
      }
      return;
    }

    const sortedStops = [...activeStops].sort((a, b) => {
      const distA = haversineDistanceKm(driverCoords, a.deliveryLocation);
      const distB = haversineDistanceKm(driverCoords, b.deliveryLocation);
      return distA - distB;
    });

    setOrderedStops(sortedStops);

    sortedStops.forEach((delivery, index) => {
      const marker = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: {
          lat: Number(delivery.deliveryLocation.lat),
          lng: Number(delivery.deliveryLocation.lng),
        },
        title: `${index + 1}. ${delivery.clientName}`,
        label: `${index + 1}`,
      });

      deliveryMarkersRef.current.push(marker);
    });

    const directionsService = new window.google.maps.DirectionsService();

    const origin = driverCoords;
    const destination =
      sortedStops.length === 1
        ? {
            lat: Number(sortedStops[0].deliveryLocation.lat),
            lng: Number(sortedStops[0].deliveryLocation.lng),
          }
        : {
            lat: Number(sortedStops[sortedStops.length - 1].deliveryLocation.lat),
            lng: Number(sortedStops[sortedStops.length - 1].deliveryLocation.lng),
          };

    const waypoints =
      sortedStops.length > 1
        ? sortedStops.slice(0, -1).map((stop) => ({
            location: {
              lat: Number(stop.deliveryLocation.lat),
              lng: Number(stop.deliveryLocation.lng),
            },
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
          console.error("No fue posible trazar la ruta en logística:", status);
        }
      }
    );
  }, [mapsApiLoaded, selectedDriver, activeStops]);

  return (
    <div>
      <div
        ref={mapRef}
        className="w-full h-80 rounded-2xl overflow-hidden"
        style={{ minHeight: "320px" }}
      />

      <div className="mt-3 space-y-2">
        <p className="text-sm text-gray-600">
          Pedidos geolocalizados pendientes: {orderedStops.length}
        </p>

        {orderedStops.length > 0 ? (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-sm font-bold text-gray-900 mb-2">
              Orden sugerido por cercanía
            </p>

            <div className="space-y-2">
              {orderedStops.map((stop, index) => (
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
            Este conductor aún no tiene pedidos con coordenadas listas.
          </p>
        )}
      </div>
    </div>
  );
};

const EnterpriseLogistics = () => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    address: "",
    clientPhone: "",
    assignedDriverId: "",
    notes: "",
  });

  useEffect(() => {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const geocodeAddress = (address) => {
    return new Promise((resolve, reject) => {
      if (!mapsApiLoaded || !window.google?.maps) {
        reject(new Error("Google Maps aún no está cargado."));
        return;
      }

      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ address }, (results, status) => {
        if (
          status === "OK" &&
          results &&
          results[0] &&
          results[0].geometry &&
          results[0].geometry.location
        ) {
          const location = results[0].geometry.location;

          resolve({
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress: results[0].formatted_address || address,
            placeId: results[0].place_id || "",
          });
        } else {
          reject(
            new Error("No se pudo encontrar una coordenada válida para esa dirección.")
          );
        }
      });
    });
  };

  const handleSaveDelivery = async (e) => {
    e.preventDefault();

    const {
      invoiceNumber,
      clientName,
      address,
      clientPhone,
      assignedDriverId,
      notes,
    } = formData;

    if (
      !invoiceNumber ||
      !clientName ||
      !address ||
      !clientPhone ||
      !assignedDriverId
    ) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => String(driver.id) === String(assignedDriverId)
    );

    if (!selectedDriver) {
      alert("Debes seleccionar un conductor válido.");
      return;
    }

    if (!mapsApiLoaded || !window.google?.maps) {
      alert("Google Maps aún no está listo. Espera un momento e inténtalo de nuevo.");
      return;
    }

    try {
      setSavingDelivery(true);

      const geo = await geocodeAddress(address);

      const newDelivery = {
        id: Date.now(),
        invoiceNumber,
        clientName,
        address: geo.formattedAddress,
        originalAddress: address,
        clientPhone,
        assignedDriverId: selectedDriver.id,
        assignedDriverName: selectedDriver.name,
        notes,
        status: "Pendiente",
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        placeId: geo.placeId,
        deliveryLocation: {
          lat: Number(geo.lat),
          lng: Number(geo.lng),
        },
      };

      const updatedDeliveries = [...deliveries, newDelivery];
      setDeliveries(updatedDeliveries);
      localStorage.setItem(
        "enterpriseDeliveries",
        JSON.stringify(updatedDeliveries)
      );

      setFormData({
        invoiceNumber: "",
        clientName: "",
        address: "",
        clientPhone: "",
        assignedDriverId: "",
        notes: "",
      });

      alert("Entrega guardada, geolocalizada y asignada correctamente.");
    } catch (error) {
      console.error("Error geolocalizando la entrega:", error);
      alert(
        error?.message ||
          "No fue posible ubicar esa dirección en el mapa. Verifica la dirección."
      );
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDeleteDelivery = (id) => {
    const updatedDeliveries = deliveries.filter((delivery) => delivery.id !== id);
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

  const selectedDriver = useMemo(() => {
    return drivers.find(
      (driver) => String(driver.id) === String(selectedDriverFilter)
    );
  }, [drivers, selectedDriverFilter]);

  const filteredDeliveries = useMemo(() => {
    if (!selectedDriverFilter) return deliveries;

    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriverFilter)
    );
  }, [deliveries, selectedDriverFilter]);

  const selectedDriverDeliveries = useMemo(() => {
    if (!selectedDriver) return [];
    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id)
    );
  }, [deliveries, selectedDriver]);

  const stats = useMemo(() => {
    return {
      pending: filteredDeliveries.filter((d) => d.status === "Pendiente").length,
      inProgress: filteredDeliveries.filter((d) => d.status === "En curso").length,
      finished: filteredDeliveries.filter((d) => d.status === "Finalizada").length,
    };
  }, [filteredDeliveries]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de Logística</h1>
            <p className="text-sm text-blue-100 mt-1">
              Asigna pedidos y supervisa conductores en operación
            </p>
          </div>

          <Link
            to="/enterprise-dashboard"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Crear nueva entrega
          </h2>

          <form onSubmit={handleSaveDelivery} className="grid grid-cols-1 gap-4">
            <input
              name="invoiceNumber"
              type="text"
              placeholder="Número de factura"
              value={formData.invoiceNumber}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="clientName"
              type="text"
              placeholder="Nombre del cliente"
              value={formData.clientName}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="address"
              type="text"
              placeholder="Dirección de entrega"
              value={formData.address}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="clientPhone"
              type="text"
              placeholder="Teléfono del cliente"
              value={formData.clientPhone}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select
              name="assignedDriverId"
              value={formData.assignedDriverId}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="">Seleccionar conductor</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} - CC {driver.cedula} - {driver.vehicle}
                </option>
              ))}
            </select>

            <textarea
              name="notes"
              placeholder="Observaciones"
              value={formData.notes}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              rows="4"
            ></textarea>

            <button
              type="submit"
              disabled={savingDelivery}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold disabled:opacity-60"
            >
              {savingDelivery ? "Geolocalizando y guardando..." : "Guardar y asignar entrega"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Supervisar por conductor
          </h2>

          <select
            value={selectedDriverFilter}
            onChange={(e) => setSelectedDriverFilter(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          >
            <option value="">Ver todos los conductores</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - CC {driver.cedula} - {driver.vehicle}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">En curso</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">Finalizadas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.finished}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Ubicación del conductor
          </h2>

          {selectedDriver ? (
            <>
              <div className="mb-4">
                <p className="font-semibold text-gray-900">
                  {selectedDriver.name}
                </p>
                <p className="text-sm text-gray-600">
                  Cédula: {selectedDriver.cedula}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedDriver.vehicle} · {selectedDriver.plate}
                </p>
                <p className="text-sm text-gray-600">
                  Estado: {selectedDriver.status || "Disponible"}
                </p>
                <p className="text-sm text-gray-600">
                  Ubicación:{" "}
                  {selectedDriver.currentLocation
                    ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                    : "Aún no reportada"}
                </p>
              </div>

              <LogisticsDriverMap
                selectedDriver={selectedDriver}
                driverDeliveries={selectedDriverDeliveries}
              />
            </>
          ) : (
            <div className="w-full h-52 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-semibold">
              Selecciona un conductor para ver su ubicación y sus pedidos
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pedidos asignados
          </h2>

          {filteredDeliveries.length === 0 ? (
            <p className="text-gray-500">No hay pedidos para este filtro.</p>
          ) : (
            <div className="space-y-4">
              {filteredDeliveries.map((delivery) => (
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
                  <p className="text-sm text-blue-600 font-semibold mt-2">
                    Asignado a: {delivery.assignedDriverName}
                  </p>

                  {delivery.deliveryLocation ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Coordenadas: {delivery.deliveryLocation.lat},{" "}
                      {delivery.deliveryLocation.lng}
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 mt-1">
                      Esta entrega aún no tiene coordenadas guardadas.
                    </p>
                  )}

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

                  {delivery.startedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Inicio: {new Date(delivery.startedAt).toLocaleString()}
                    </p>
                  )}

                  {delivery.finishedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Finalizó: {new Date(delivery.finishedAt).toLocaleString()}
                    </p>
                  )}

                  {delivery.notes ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Observaciones: {delivery.notes}
                    </p>
                  ) : null}

                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleDeleteDelivery(delivery.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold"
                    >
                      Eliminar
                    </button>
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

export default EnterpriseLogistics;
