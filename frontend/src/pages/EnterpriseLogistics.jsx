import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";

const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };

const EnterpriseLogisticsDriverMap = ({ selectedDriver }) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const infoWindowRef = useRef(null);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
  }, [mapsApiLoaded]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapInstanceRef.current) return;

    if (!selectedDriver?.currentLocation?.lat || !selectedDriver?.currentLocation?.lng) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }

      mapInstanceRef.current.setCenter(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(12);
      return;
    }

    const coords = {
      lat: Number(selectedDriver.currentLocation.lat),
      lng: Number(selectedDriver.currentLocation.lng),
    };

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: coords,
        title: selectedDriver.name || "Conductor",
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });
    } else {
      markerRef.current.setPosition(coords);
      markerRef.current.setTitle(selectedDriver.name || "Conductor");
      markerRef.current.setMap(mapInstanceRef.current);
    }

    mapInstanceRef.current.panTo(coords);
    mapInstanceRef.current.setZoom(15);

    const updatedAtText = selectedDriver.currentLocation.updatedAt
      ? new Date(selectedDriver.currentLocation.updatedAt).toLocaleString()
      : "Sin registro";

    const content = `
      <div style="min-width:220px;padding:4px 6px;">
        <div style="font-weight:700;font-size:15px;margin-bottom:6px;">
          ${selectedDriver.name || "Conductor"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Estado: <b>${selectedDriver.status || "Disponible"}</b>
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Vehículo: ${selectedDriver.vehicle || "-"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Placa: ${selectedDriver.plate || "-"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Última actualización: ${updatedAtText}
        </div>
        <div style="font-size:12px;color:#666;">
          ${coords.lat}, ${coords.lng}
        </div>
      </div>
    `;

    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({
        anchor: markerRef.current,
        map: mapInstanceRef.current,
      });
    }
  }, [mapsApiLoaded, selectedDriver]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[420px] rounded-2xl overflow-hidden border border-gray-200"
    />
  );
};

const EnterpriseLogistics = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);

  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const addressBoxRef = useRef(null);

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    address: "",
    clientPhone: "",
    assignedDriverId: "",
    notes: "",
    placeId: "",
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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (addressBoxRef.current && !addressBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const normalizeSuggestionRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        description:
          row.description ||
          row.structured_formatting?.main_text ||
          row.formatted_address ||
          "",
        place_id: row.place_id || "",
      }))
      .filter((r) => r.description);

  const runFetchSuggestions = useCallback(async (query) => {
    const seq = ++suggestionSeqRef.current;

    try {
      const { data } = await axios.get(
        `${getApiBaseUrl()}/maps/get-suggestions`,
        {
          params: { address: query },
          timeout: 18000,
        }
      );

      if (seq !== suggestionSeqRef.current) return;

      const normalized = normalizeSuggestionRows(data);
      setAddressSuggestions(normalized);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      if (seq === suggestionSeqRef.current) {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, []);

  const fetchSuggestions = (query) => {
    if (query.length < 3) {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);

    suggestionTimerRef.current = setTimeout(() => {
      suggestionTimerRef.current = null;
      runFetchSuggestions(query);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    };
  }, []);

  const handleAddressSelect = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.description || "",
      placeId: suggestion.place_id || "",
    }));

    setAddressSelected(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "address") {
        next.placeId = "";
        setAddressSelected(false);
        fetchSuggestions(value);
      }

      return next;
    });
  };

  const handleSaveDelivery = (e) => {
    e.preventDefault();

    const {
      invoiceNumber,
      clientName,
      address,
      clientPhone,
      assignedDriverId,
      notes,
      placeId,
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

    if (!addressSelected) {
      alert("Debes escoger la dirección desde la lista de sugerencias.");
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => String(driver.id) === String(assignedDriverId)
    );

    if (!selectedDriver) {
      alert("Debes seleccionar un conductor válido.");
      return;
    }

    try {
      setSavingDelivery(true);

      const newDelivery = {
        id: Date.now(),
        invoiceNumber,
        clientName,
        address,
        clientPhone,
        assignedDriverId: selectedDriver.id,
        assignedDriverName: selectedDriver.name,
        notes,
        status: "Pendiente",
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        placeId,
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
        placeId: "",
      });

      setAddressSelected(false);
      setAddressSuggestions([]);
      setShowSuggestions(false);

      alert("Entrega guardada y asignada correctamente.");
    } catch (error) {
      console.error("Error guardando la entrega:", error);
      alert("No fue posible guardar la entrega.");
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

  const stats = useMemo(() => {
    return {
      pending: filteredDeliveries.filter((d) => d.status === "Pendiente").length,
      inProgress: filteredDeliveries.filter((d) => d.status === "En curso").length,
      finished: filteredDeliveries.filter((d) => d.status === "Finalizada").length,
    };
  }, [filteredDeliveries]);

  const selectedDriverPendingDeliveries = useMemo(() => {
    if (!selectedDriver) return [];

    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id) &&
        delivery.status !== "Finalizada"
    );
  }, [deliveries, selectedDriver]);

  const openDriverInGoogleMaps = () => {
    if (!selectedDriver?.currentLocation?.lat || !selectedDriver?.currentLocation?.lng) {
      return;
    }

    const url = `https://www.google.com/maps?q=${selectedDriver.currentLocation.lat},${selectedDriver.currentLocation.lng}`;
    window.open(url, "_blank");
  };

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

            <div className="relative" ref={addressBoxRef}>
              <input
                name="address"
                type="text"
                placeholder="Dirección de entrega"
                value={formData.address}
                onChange={handleChange}
                onFocus={() => {
                  if (addressSuggestions.length > 0) setShowSuggestions(true);
                }}
                autoComplete="off"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              />

              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-80 overflow-y-auto">
                  {addressSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.place_id || suggestion.description}-${index}`}
                      type="button"
                      onClick={() => handleAddressSelect(suggestion)}
                      className="w-full text-left px-4 py-4 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                          📍
                        </div>
                        <div className="text-sm text-gray-800">
                          {suggestion.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {addressSelected ? (
              <p className="text-xs text-green-600 font-medium">
                Dirección seleccionada correctamente.
              </p>
            ) : (
              <p className="text-xs text-orange-600 font-medium">
                Escribe mínimo 3 letras y selecciona una dirección de la lista.
              </p>
            )}

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
              {savingDelivery ? "Guardando..." : "Guardar y asignar entrega"}
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

        {selectedDriver ? (
          <div className="bg-white rounded-2xl shadow p-5 mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Ubicación del conductor
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Seguimiento visual en tiempo real
                </p>
              </div>

              <button
                type="button"
                onClick={openDriverInGoogleMaps}
                disabled={!selectedDriver?.currentLocation?.lat}
                className={`px-4 py-2 rounded-xl font-semibold ${
                  selectedDriver?.currentLocation?.lat
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Abrir en Google Maps
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">Conductor</p>
                <p className="font-bold text-gray-900">{selectedDriver.name}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">Estado</p>
                <p className="font-bold text-gray-900">
                  {selectedDriver.status || "Disponible"}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">Última actualización</p>
                <p className="font-bold text-gray-900">
                  {selectedDriver.currentLocation?.updatedAt
                    ? new Date(selectedDriver.currentLocation.updatedAt).toLocaleString()
                    : "Aún no reportada"}
                </p>
              </div>
            </div>

            <EnterpriseLogisticsDriverMap selectedDriver={selectedDriver} />

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-semibold">
                  Coordenadas actuales
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  {selectedDriver.currentLocation
                    ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                    : "Sin ubicación reportada"}
                </p>
              </div>

              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-700 font-semibold">
                  Entregas pendientes de este conductor
                </p>
                <p className="text-2xl font-bold text-purple-700 mt-1">
                  {selectedDriverPendingDeliveries.length}
                </p>
              </div>
            </div>
          </div>
        ) : null}

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

                  {delivery.placeId ? (
                    <p className="text-xs text-gray-500 mt-1">
                      placeId: {delivery.placeId}
                    </p>
                  ) : null}

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
