import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import EnterpriseDeliveryChat from "./EnterpriseDeliveryChat";

const API_BASE = getApiBaseUrl();
const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };

const TRUCK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="6" y="20" width="30" height="18" rx="4" fill="#2563eb"/>
  <rect x="36" y="24" width="14" height="14" rx="3" fill="#60a5fa"/>
  <rect x="44" y="28" width="10" height="10" rx="2" fill="#93c5fd"/>
  <circle cx="20" cy="42" r="6" fill="#111827"/>
  <circle cx="46" cy="42" r="6" fill="#111827"/>
  <circle cx="20" cy="42" r="2.5" fill="#f9fafb"/>
  <circle cx="46" cy="42" r="2.5" fill="#f9fafb"/>
</svg>
`;

const TRUCK_ICON_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(TRUCK_SVG)}`;

const EnterpriseLogisticsDriverMap = ({
  selectedDriver,
  activeOrLastDelivery,
  driverPendingDeliveriesCount,
}) => {
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const lastCoordsRef = useRef(null);
  const routeSignatureRef = useRef("");

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

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });

      directionsRendererRef.current.setMap(mapInstanceRef.current);
    }
  }, [mapsApiLoaded]);

  useEffect(() => {
    if (!mapsApiLoaded || !window.google?.maps || !mapInstanceRef.current) return;

    const lat = Number(selectedDriver?.currentLocation?.lat);
    const lng = Number(selectedDriver?.currentLocation?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }

      if (directionsRendererRef.current) {
        directionsRendererRef.current.set("directions", null);
      }

      mapInstanceRef.current.setCenter(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(12);
      lastCoordsRef.current = null;
      routeSignatureRef.current = "";
      return;
    }

    const coords = { lat, lng };

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: coords,
        title: selectedDriver?.name || "Conductor",
        icon: {
          url: TRUCK_ICON_URL,
          scaledSize: new window.google.maps.Size(46, 46),
          anchor: new window.google.maps.Point(23, 23),
        },
      });
    } else {
      markerRef.current.setPosition(coords);
      markerRef.current.setTitle(selectedDriver?.name || "Conductor");
      markerRef.current.setMap(mapInstanceRef.current);
    }

    const last = lastCoordsRef.current;
    const changed =
      !last ||
      Number(last.lat) !== Number(coords.lat) ||
      Number(last.lng) !== Number(coords.lng);

    if (changed) {
      mapInstanceRef.current.panTo(coords);
      mapInstanceRef.current.setZoom(15);
      lastCoordsRef.current = coords;
    }

    const updatedAtText = selectedDriver?.currentLocation?.updatedAt
      ? new Date(selectedDriver.currentLocation.updatedAt).toLocaleString()
      : "Sin registro";

    const content = `
      <div style="min-width:240px;padding:4px 6px;">
        <div style="font-weight:700;font-size:16px;margin-bottom:8px;">
          🚚 ${selectedDriver?.name || "Conductor"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Estado: <b>${selectedDriver?.status || "Disponible"}</b>
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Vehículo: ${selectedDriver?.vehicle || "-"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Placa: ${selectedDriver?.plate || "-"}
        </div>
        <div style="font-size:13px;margin-bottom:4px;">
          Pedidos pendientes: <b>${driverPendingDeliveriesCount}</b>
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
  }, [
    mapsApiLoaded,
    selectedDriver?._id,
    selectedDriver?.name,
    selectedDriver?.status,
    selectedDriver?.vehicle,
    selectedDriver?.plate,
    selectedDriver?.currentLocation?.lat,
    selectedDriver?.currentLocation?.lng,
    selectedDriver?.currentLocation?.updatedAt,
    driverPendingDeliveriesCount,
  ]);

  useEffect(() => {
    if (
      !mapsApiLoaded ||
      !window.google?.maps ||
      !mapInstanceRef.current ||
      !directionsRendererRef.current
    ) {
      return;
    }

    const lat = Number(selectedDriver?.currentLocation?.lat);
    const lng = Number(selectedDriver?.currentLocation?.lng);
    const destinationAddress = activeOrLastDelivery?.address?.trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !destinationAddress) {
      directionsRendererRef.current.set("directions", null);
      routeSignatureRef.current = "";
      return;
    }

    const signature = JSON.stringify({
      lat: Number(lat).toFixed(6),
      lng: Number(lng).toFixed(6),
      address: destinationAddress,
      deliveryId: activeOrLastDelivery?._id || activeOrLastDelivery?.id || "",
      status: activeOrLastDelivery?.status || "",
    });

    if (signature === routeSignatureRef.current) return;
    routeSignatureRef.current = signature;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat, lng },
        destination: destinationAddress,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRendererRef.current.setDirections(result);
        } else {
          console.error("No se pudo dibujar la ruta en logística:", status);
          directionsRendererRef.current.set("directions", null);
        }
      }
    );
  }, [
    mapsApiLoaded,
    selectedDriver?.currentLocation?.lat,
    selectedDriver?.currentLocation?.lng,
    activeOrLastDelivery?.address,
    activeOrLastDelivery?._id,
    activeOrLastDelivery?.id,
    activeOrLastDelivery?.status,
  ]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[480px] rounded-2xl overflow-hidden border border-gray-200"
    />
  );
};

const EnterpriseLogistics = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);

  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const addressBoxRef = useRef(null);

  const driversRequestSeqRef = useRef(0);
  const deliveriesRequestSeqRef = useRef(0);
  const driversPollingBusyRef = useRef(false);
  const deliveriesPollingBusyRef = useRef(false);

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    address: "",
    clientPhone: "",
    assignedDriverId: "",
    notes: "",
    placeId: "",
  });

  const driverIdValue = (driver) => String(driver?._id || driver?.id || "");

  const parseJsonSafe = async (response, label = "API") => {
    const text = await response.text();
    console.log(`${label} raw response:`, text);

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON. Revisa VITE_BASE_URL o la ruta backend. Respuesta: ${text.slice(
          0,
          150
        )}`
      );
    }
  };

  const sortDriversByFreshness = (items) => {
    return [...items].sort((a, b) => {
      const aUpdated = a?.currentLocation?.updatedAt
        ? new Date(a.currentLocation.updatedAt).getTime()
        : 0;
      const bUpdated = b?.currentLocation?.updatedAt
        ? new Date(b.currentLocation.updatedAt).getTime()
        : 0;

      if (bUpdated !== aUpdated) return bUpdated - aUpdated;

      const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });
  };

  const mergeDriversSafely = (incomingDrivers) => {
    setDrivers((prev) => {
      const prevMap = new Map(prev.map((d) => [driverIdValue(d), d]));

      const next = incomingDrivers.map((incoming) => {
        const id = driverIdValue(incoming);
        const previous = prevMap.get(id);

        if (!previous) return incoming;

        const prevUpdatedAt = previous?.currentLocation?.updatedAt
          ? new Date(previous.currentLocation.updatedAt).getTime()
          : 0;
        const incomingUpdatedAt = incoming?.currentLocation?.updatedAt
          ? new Date(incoming.currentLocation.updatedAt).getTime()
          : 0;

        if (prevUpdatedAt > incomingUpdatedAt) {
          return {
            ...incoming,
            currentLocation: previous.currentLocation,
          };
        }

        return incoming;
      });

      return sortDriversByFreshness(next);
    });
  };

  const fetchDrivers = useCallback(async (silent = false) => {
    if (silent && driversPollingBusyRef.current) return;

    const seq = ++driversRequestSeqRef.current;

    try {
      if (silent) {
        driversPollingBusyRef.current = true;
      } else {
        setLoadingDrivers(true);
      }

      const response = await fetch(`${API_BASE}/enterprise-drivers`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response, "GET /enterprise-drivers");

      if (seq !== driversRequestSeqRef.current) return;

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los conductores.");
      }

      const incomingDrivers = Array.isArray(data.drivers) ? data.drivers : [];
      mergeDriversSafely(incomingDrivers);
    } catch (error) {
      console.error("Error cargando conductores:", error);
      if (!silent) {
        alert(error.message || "Error cargando conductores.");
      }
    } finally {
      if (silent) {
        driversPollingBusyRef.current = false;
      } else {
        setLoadingDrivers(false);
      }
    }
  }, []);

  const fetchDeliveries = useCallback(async (silent = false) => {
    if (silent && deliveriesPollingBusyRef.current) return;

    const seq = ++deliveriesRequestSeqRef.current;

    try {
      if (silent) {
        deliveriesPollingBusyRef.current = true;
      } else {
        setLoadingDeliveries(true);
      }

      const response = await fetch(`${API_BASE}/enterprise-deliveries`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response, "GET /enterprise-deliveries");

      if (seq !== deliveriesRequestSeqRef.current) return;

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las entregas.");
      }

      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    } catch (error) {
      console.error("Error cargando entregas:", error);
      if (!silent) {
        alert(error.message || "Error cargando entregas.");
      }
    } finally {
      if (silent) {
        deliveriesPollingBusyRef.current = false;
      } else {
        setLoadingDeliveries(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDrivers(false);
    fetchDeliveries(false);

    const interval = setInterval(() => {
      fetchDrivers(true);
      fetchDeliveries(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchDrivers, fetchDeliveries]);

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
      const { data } = await axios.get(`${API_BASE}/maps/get-suggestions`, {
        params: { address: query },
        timeout: 18000,
        withCredentials: true,
      });

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

  const handleSaveDelivery = async (e) => {
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

    if (!invoiceNumber || !clientName || !address || !clientPhone || !assignedDriverId) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (!addressSelected) {
      alert("Debes escoger la dirección desde la lista de sugerencias.");
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => driverIdValue(driver) === String(assignedDriverId)
    );

    if (!selectedDriver) {
      alert("Debes seleccionar un conductor válido.");
      return;
    }

    try {
      setSavingDelivery(true);

      const response = await fetch(`${API_BASE}/enterprise-deliveries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          invoiceNumber,
          clientName,
          address,
          clientPhone,
          assignedDriverId,
          notes,
          placeId,
        }),
      });

      const data = await parseJsonSafe(response, "POST /enterprise-deliveries");

      if (!response.ok) {
        throw new Error(data.message || "No fue posible guardar la entrega.");
      }

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

      await fetchDeliveries(true);
      await fetchDrivers(true);

      alert("Entrega guardada y asignada correctamente.");
    } catch (error) {
      console.error("Error guardando la entrega:", error);
      alert(error.message || "No fue posible guardar la entrega.");
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDeleteDelivery = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/enterprise-deliveries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await parseJsonSafe(
        response,
        "DELETE /enterprise-deliveries/:id"
      );

      if (!response.ok) {
        throw new Error(data.message || "No se pudo eliminar la entrega.");
      }

      await fetchDeliveries(true);
      await fetchDrivers(true);
    } catch (error) {
      console.error("Error eliminando entrega:", error);
      alert(error.message || "No se pudo eliminar la entrega.");
    }
  };

  const selectedDriver = useMemo(() => {
    return drivers.find(
      (driver) => driverIdValue(driver) === String(selectedDriverFilter)
    );
  }, [drivers, selectedDriverFilter]);

  const filteredDeliveries = useMemo(() => {
    if (!selectedDriverFilter) return deliveries;

    return deliveries.filter((delivery) => {
      const assignedId =
        delivery.assignedDriverId?._id ||
        delivery.assignedDriverId ||
        delivery.driver?._id ||
        delivery.driver ||
        "";
      return String(assignedId) === String(selectedDriverFilter);
    });
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

    return deliveries.filter((delivery) => {
      const assignedId =
        delivery.assignedDriverId?._id ||
        delivery.assignedDriverId ||
        delivery.driver?._id ||
        delivery.driver ||
        "";

      return (
        String(assignedId) === String(driverIdValue(selectedDriver)) &&
        delivery.status !== "Finalizada"
      );
    });
  }, [deliveries, selectedDriver]);

  const selectedDriverActiveDelivery = useMemo(() => {
    if (!selectedDriver) return null;

    return deliveries.find((delivery) => {
      const assignedId =
        delivery.assignedDriverId?._id ||
        delivery.assignedDriverId ||
        delivery.driver?._id ||
        delivery.driver ||
        "";

      return (
        String(assignedId) === String(driverIdValue(selectedDriver)) &&
        delivery.status === "En curso"
      );
    }) || null;
  }, [deliveries, selectedDriver]);

  const selectedDriverLastFinishedDelivery = useMemo(() => {
    if (!selectedDriver) return null;

    const completed = deliveries
      .filter((delivery) => {
        const assignedId =
          delivery.assignedDriverId?._id ||
          delivery.assignedDriverId ||
          delivery.driver?._id ||
          delivery.driver ||
          "";

        return (
          String(assignedId) === String(driverIdValue(selectedDriver)) &&
          delivery.status === "Finalizada"
        );
      })
      .sort((a, b) => {
        const aTime = a?.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const bTime = b?.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        return bTime - aTime;
      });

    return completed[0] || null;
  }, [deliveries, selectedDriver]);

  const activeOrLastDelivery =
    selectedDriverActiveDelivery || selectedDriverLastFinishedDelivery || null;

  const selectedDriverChatDelivery = activeOrLastDelivery;

  const openDriverInGoogleMaps = () => {
    if (!selectedDriver?.currentLocation?.lat || !selectedDriver?.currentLocation?.lng) {
      return;
    }

    const url = `https://www.google.com/maps?q=${selectedDriver.currentLocation.lat},${selectedDriver.currentLocation.lng}`;
    window.open(url, "_blank");
  };

  const openRouteInGoogleMaps = () => {
    if (
      !selectedDriver?.currentLocation?.lat ||
      !selectedDriver?.currentLocation?.lng ||
      !activeOrLastDelivery?.address
    ) {
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      `${selectedDriver.currentLocation.lat},${selectedDriver.currentLocation.lng}`
    )}&destination=${encodeURIComponent(activeOrLastDelivery.address)}&travelmode=driving`;

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
              disabled={loadingDrivers}
            >
              <option value="">
                {loadingDrivers
                  ? "Cargando conductores..."
                  : drivers.length === 0
                  ? "No hay conductores disponibles"
                  : "Seleccionar conductor"}
              </option>
              {drivers.map((driver) => (
                <option key={driverIdValue(driver)} value={driverIdValue(driver)}>
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
              <option key={driverIdValue(driver)} value={driverIdValue(driver)}>
                {driver.name} - CC {driver.cedula} - {driver.vehicle}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
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
                  Seguimiento del conductor
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ubicación actual, destino activo y última operación registrada
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  Ver ubicación
                </button>

                <button
                  type="button"
                  onClick={openRouteInGoogleMaps}
                  disabled={!activeOrLastDelivery?.address || !selectedDriver?.currentLocation?.lat}
                  className={`px-4 py-2 rounded-xl font-semibold ${
                    activeOrLastDelivery?.address && selectedDriver?.currentLocation?.lat
                      ? "bg-blue-600 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Ver ruta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
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

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="font-bold text-gray-900">
                  {selectedDriverPendingDeliveries.length}
                </p>
              </div>
            </div>

            <EnterpriseLogisticsDriverMap
              selectedDriver={selectedDriver}
              activeOrLastDelivery={activeOrLastDelivery}
              driverPendingDeliveriesCount={selectedDriverPendingDeliveries.length}
            />

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-semibold">
                  Coordenadas actuales
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  {selectedDriver.currentLocation?.lat && selectedDriver.currentLocation?.lng
                    ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                    : "Sin ubicación reportada"}
                </p>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-indigo-700 font-semibold">
                  Ruta activa
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  {selectedDriverActiveDelivery
                    ? `${selectedDriverActiveDelivery.clientName} — ${selectedDriverActiveDelivery.address}`
                    : "No tiene ruta en curso"}
                </p>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-sm text-emerald-700 font-semibold">
                  Última entrega finalizada
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  {selectedDriverLastFinishedDelivery
                    ? `${selectedDriverLastFinishedDelivery.clientName} — ${selectedDriverLastFinishedDelivery.address}`
                    : "Sin entregas finalizadas"}
                </p>
              </div>

              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-700 font-semibold">
                  Referencia mostrada en mapa
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  {selectedDriverActiveDelivery
                    ? "Destino activo"
                    : selectedDriverLastFinishedDelivery
                    ? "Última ruta conocida"
                    : "Solo ubicación actual"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedDriver ? (
          <div className="mb-5">
            <EnterpriseDeliveryChat
              delivery={selectedDriverChatDelivery}
              selectedDriver={selectedDriver}
              logisticsName="Logística"
            />
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pedidos asignados
          </h2>

          {loadingDeliveries ? (
            <p className="text-gray-500">Cargando pedidos...</p>
          ) : filteredDeliveries.length === 0 ? (
            <p className="text-gray-500">No hay pedidos para este filtro.</p>
          ) : (
            <div className="space-y-4">
              {filteredDeliveries.map((delivery) => {
                const deliveryId = delivery._id || delivery.id;
                return (
                  <div key={deliveryId} className="border rounded-xl p-4">
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
                      Asignado a:{" "}
                      {delivery.assignedDriverName ||
                        delivery.assignedDriverId?.name ||
                        "Sin nombre"}
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
                        onClick={() => handleDeleteDelivery(deliveryId)}
                        className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold"
                      >
                        Eliminar
                      </button>
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

export default EnterpriseLogistics;
