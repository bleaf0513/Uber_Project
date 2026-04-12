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

const areCoordsMeaningfullyDifferent = (a, b, threshold = 0.0003) => {
  if (!a || !b) return true;

  return (
    Math.abs(Number(a.lat) - Number(b.lat)) > threshold ||
    Math.abs(Number(a.lng) - Number(b.lng)) > threshold
  );
};

const statusBadgeClass = (status) => {
  if (status === "Finalizada") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }
  if (status === "En curso") {
    return "bg-blue-100 text-blue-700 border border-blue-200";
  }
  return "bg-amber-100 text-amber-700 border border-amber-200";
};

const statusCardClass = (status) => {
  if (status === "Finalizada") {
    return "from-emerald-50 to-white border-emerald-100";
  }
  if (status === "En curso") {
    return "from-blue-50 to-white border-blue-100";
  }
  return "from-amber-50 to-white border-amber-100";
};

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
  const infoWindowSignatureRef = useRef("");

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

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      mapInstanceRef.current.setCenter(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(12);
      lastCoordsRef.current = null;
      routeSignatureRef.current = "";
      infoWindowSignatureRef.current = "";
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
    const movedEnough = areCoordsMeaningfullyDifferent(last, coords, 0.0003);

    if (movedEnough) {
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

    const nextInfoSignature = JSON.stringify({
      id: selectedDriver?._id || selectedDriver?.id || "",
      name: selectedDriver?.name || "",
      status: selectedDriver?.status || "",
      vehicle: selectedDriver?.vehicle || "",
      plate: selectedDriver?.plate || "",
      lat: Number(coords.lat).toFixed(6),
      lng: Number(coords.lng).toFixed(6),
      updatedAt: selectedDriver?.currentLocation?.updatedAt || "",
      pending: driverPendingDeliveriesCount,
    });

    if (infoWindowRef.current && infoWindowSignatureRef.current !== nextInfoSignature) {
      infoWindowRef.current.setContent(content);
      infoWindowRef.current.open({
        anchor: markerRef.current,
        map: mapInstanceRef.current,
      });
      infoWindowSignatureRef.current = nextInfoSignature;
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
      lat: Number(lat).toFixed(5),
      lng: Number(lng).toFixed(5),
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
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Mapa en tiempo real</h3>
          <p className="text-sm text-slate-500">
            Ubicación del conductor y ruta hacia el destino activo
          </p>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
          Seguimiento activo
        </div>
      </div>

      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-b-[28px] overflow-hidden"
      />
    </div>
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

  const areDeliveriesEquivalent = (prev, next) => {
    if (!Array.isArray(prev) || !Array.isArray(next)) return false;
    if (prev.length !== next.length) return false;

    for (let i = 0; i < prev.length; i += 1) {
      const a = prev[i];
      const b = next[i];

      const aId = String(a?._id || a?.id || "");
      const bId = String(b?._id || b?.id || "");

      const aDriverId =
        a?.assignedDriverId?._id || a?.assignedDriverId || a?.driver?._id || a?.driver || "";
      const bDriverId =
        b?.assignedDriverId?._id || b?.assignedDriverId || b?.driver?._id || b?.driver || "";

      if (
        aId !== bId ||
        String(a?.status || "") !== String(b?.status || "") ||
        String(a?.startedAt || "") !== String(b?.startedAt || "") ||
        String(a?.finishedAt || "") !== String(b?.finishedAt || "") ||
        String(a?.updatedAt || "") !== String(b?.updatedAt || "") ||
        String(a?.address || "") !== String(b?.address || "") ||
        String(a?.clientName || "") !== String(b?.clientName || "") ||
        String(a?.clientPhone || "") !== String(b?.clientPhone || "") ||
        String(a?.invoiceNumber || "") !== String(b?.invoiceNumber || "") ||
        String(aDriverId) !== String(bDriverId)
      ) {
        return false;
      }
    }

    return true;
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

      const incomingDeliveries = Array.isArray(data.deliveries) ? data.deliveries : [];

      setDeliveries((prev) => {
        if (areDeliveriesEquivalent(prev, incomingDeliveries)) {
          return prev;
        }
        return incomingDeliveries;
      });
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
    }, 8000);

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

    return (
      deliveries.find((delivery) => {
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
      }) || null
    );
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

  const selectedDriverChatDelivery = useMemo(() => {
    if (!activeOrLastDelivery) return null;
    return activeOrLastDelivery;
  }, [activeOrLastDelivery]);

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
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-blue-900 to-blue-700 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute top-10 right-0 h-56 w-56 rounded-full bg-indigo-400 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur">
                <span>🚚</span>
                <span>Central Go Empresas</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Panel de Logística Empresarial
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100 md:text-base">
                Asigna entregas, supervisa conductores, consulta rutas en tiempo real
                y controla toda la operación desde un solo lugar.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/enterprise-dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-blue-800 shadow-lg transition hover:scale-[1.02]"
              >
                Volver al dashboard
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-blue-100">Conductores registrados</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-extrabold">{drivers.length}</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  Equipo
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-blue-100">Entregas pendientes</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-extrabold">{stats.pending}</p>
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
                  Pendiente
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-blue-100">Entregas en curso</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-extrabold">{stats.inProgress}</p>
                <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100">
                  Activa
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur">
              <p className="text-sm text-blue-100">Entregas finalizadas</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-extrabold">{stats.finished}</p>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  Cerrada
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-blue-50 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Crear nueva entrega
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Registra la factura, selecciona la dirección y asigna el conductor.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-100">
                    Nueva operación
                  </div>
                </div>
              </div>

              <div className="p-6">
                <form onSubmit={handleSaveDelivery} className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Número de factura
                    </label>
                    <input
                      name="invoiceNumber"
                      type="text"
                      placeholder="Ej. FAC-10245"
                      value={formData.invoiceNumber}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Nombre del cliente
                    </label>
                    <input
                      name="clientName"
                      type="text"
                      placeholder="Nombre del cliente"
                      value={formData.clientName}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="relative" ref={addressBoxRef}>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Dirección de entrega
                    </label>
                    <input
                      name="address"
                      type="text"
                      placeholder="Escribe la dirección"
                      value={formData.address}
                      onChange={handleChange}
                      onFocus={() => {
                        if (addressSuggestions.length > 0) setShowSuggestions(true);
                      }}
                      autoComplete="off"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />

                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                        <div className="max-h-80 overflow-y-auto">
                          {addressSuggestions.map((suggestion, index) => (
                            <button
                              key={`${suggestion.place_id || suggestion.description}-${index}`}
                              type="button"
                              onClick={() => handleAddressSelect(suggestion)}
                              className="w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-base">
                                  📍
                                </div>
                                <div className="text-sm text-slate-800">
                                  {suggestion.description}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {addressSelected ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      Dirección seleccionada correctamente.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                      Escribe mínimo 3 letras y selecciona una dirección de la lista.
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Teléfono del cliente
                    </label>
                    <input
                      name="clientPhone"
                      type="text"
                      placeholder="Teléfono del cliente"
                      value={formData.clientPhone}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Conductor asignado
                    </label>
                    <select
                      name="assignedDriverId"
                      value={formData.assignedDriverId}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Observaciones
                    </label>
                    <textarea
                      name="notes"
                      placeholder="Información adicional para la entrega"
                      value={formData.notes}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      rows="4"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={savingDelivery}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDelivery ? "Guardando..." : "Guardar y asignar entrega"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="xl:col-span-7">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-6 py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Supervisar por conductor
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Consulta desempeño, estado actual y operaciones por conductor.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200">
                    Monitoreo operativo
                  </div>
                </div>
              </div>

              <div className="p-6">
                <select
                  value={selectedDriverFilter}
                  onChange={(e) => setSelectedDriverFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Ver todos los conductores</option>
                  {drivers.map((driver) => (
                    <option key={driverIdValue(driver)} value={driverIdValue(driver)}>
                      {driver.name} - CC {driver.cedula} - {driver.vehicle}
                    </option>
                  ))}
                </select>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-600">Pendientes</p>
                      <span className="text-xl">🕒</span>
                    </div>
                    <p className="mt-3 text-3xl font-extrabold text-amber-600">
                      {stats.pending}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Entregas por iniciar</p>
                  </div>

                  <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-600">En curso</p>
                      <span className="text-xl">🚚</span>
                    </div>
                    <p className="mt-3 text-3xl font-extrabold text-blue-600">
                      {stats.inProgress}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Entregas activas</p>
                  </div>

                  <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-600">Finalizadas</p>
                      <span className="text-xl">✅</span>
                    </div>
                    <p className="mt-3 text-3xl font-extrabold text-emerald-600">
                      {stats.finished}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Entregas cerradas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedDriver ? (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">Seguimiento del conductor</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Ubicación actual, destino activo y última operación registrada.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openDriverInGoogleMaps}
                    disabled={!selectedDriver?.currentLocation?.lat}
                    className={`rounded-2xl px-4 py-2.5 font-semibold transition ${
                      selectedDriver?.currentLocation?.lat
                        ? "bg-emerald-500 text-white hover:scale-[1.02]"
                        : "cursor-not-allowed bg-slate-700 text-slate-400"
                    }`}
                  >
                    Ver ubicación
                  </button>

                  <button
                    type="button"
                    onClick={openRouteInGoogleMaps}
                    disabled={!activeOrLastDelivery?.address || !selectedDriver?.currentLocation?.lat}
                    className={`rounded-2xl px-4 py-2.5 font-semibold transition ${
                      activeOrLastDelivery?.address && selectedDriver?.currentLocation?.lat
                        ? "bg-blue-500 text-white hover:scale-[1.02]"
                        : "cursor-not-allowed bg-slate-700 text-slate-400"
                    }`}
                  >
                    Ver ruta
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Conductor</p>
                  <p className="mt-2 text-lg font-extrabold text-slate-900">
                    {selectedDriver.name}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Estado</p>
                  <div className="mt-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${statusBadgeClass(selectedDriver.status || "Pendiente")}`}>
                      {selectedDriver.status || "Disponible"}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Última actualización</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {selectedDriver.currentLocation?.updatedAt
                      ? new Date(selectedDriver.currentLocation.updatedAt).toLocaleString()
                      : "Aún no reportada"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <p className="text-sm font-semibold text-slate-500">Pendientes</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {selectedDriverPendingDeliveries.length}
                  </p>
                </div>
              </div>

              <EnterpriseLogisticsDriverMap
                selectedDriver={selectedDriver}
                activeOrLastDelivery={activeOrLastDelivery}
                driverPendingDeliveriesCount={selectedDriverPendingDeliveries.length}
              />

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
                  <p className="text-sm font-semibold text-blue-700">
                    Coordenadas actuales
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {selectedDriver.currentLocation?.lat && selectedDriver.currentLocation?.lng
                      ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                      : "Sin ubicación reportada"}
                  </p>
                </div>

                <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
                  <p className="text-sm font-semibold text-indigo-700">Ruta activa</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {selectedDriverActiveDelivery
                      ? `${selectedDriverActiveDelivery.clientName} — ${selectedDriverActiveDelivery.address}`
                      : "No tiene ruta en curso"}
                  </p>
                </div>

                <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                  <p className="text-sm font-semibold text-emerald-700">
                    Última entrega finalizada
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {selectedDriverLastFinishedDelivery
                      ? `${selectedDriverLastFinishedDelivery.clientName} — ${selectedDriverLastFinishedDelivery.address}`
                      : "Sin entregas finalizadas"}
                  </p>
                </div>

                <div className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5">
                  <p className="text-sm font-semibold text-purple-700">
                    Referencia mostrada en mapa
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {selectedDriverActiveDelivery
                      ? "Destino activo"
                      : selectedDriverLastFinishedDelivery
                      ? "Última ruta conocida"
                      : "Solo ubicación actual"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {selectedDriver ? (
          <div className="mt-6">
            <EnterpriseDeliveryChat
              delivery={selectedDriverChatDelivery}
              selectedDriver={selectedDriver}
              logisticsName="Logística"
            />
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-slate-100 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Pedidos asignados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Listado operativo de entregas registradas en el sistema.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200">
                Total: {filteredDeliveries.length}
              </div>
            </div>
          </div>

          <div className="p-6">
            {loadingDeliveries ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-slate-500">
                Cargando pedidos...
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-slate-500">
                No hay pedidos para este filtro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredDeliveries.map((delivery) => {
                  const deliveryId = delivery._id || delivery.id;

                  return (
                    <div
                      key={deliveryId}
                      className={`rounded-[26px] border bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${statusCardClass(delivery.status)}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-extrabold text-slate-900">
                              Factura #{delivery.invoiceNumber}
                            </p>
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(delivery.status)}`}>
                              {delivery.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            Pedido asignado a operación logística
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDelivery(deliveryId)}
                          className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-600"
                        >
                          Eliminar
                        </button>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white/80 p-4 border border-white/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Cliente
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.clientName}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/80 p-4 border border-white/70">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Teléfono
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.clientPhone}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/80 p-4 border border-white/70 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Dirección
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {delivery.address}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white/80 p-4 border border-white/70 sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Asignado a
                          </p>
                          <p className="mt-1 text-sm font-bold text-blue-700">
                            {delivery.assignedDriverName ||
                              delivery.assignedDriverId?.name ||
                              "Sin nombre"}
                          </p>
                        </div>
                      </div>

                      {delivery.placeId ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
                          placeId: {delivery.placeId}
                        </div>
                      ) : null}

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {delivery.startedAt && (
                          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Inicio
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {new Date(delivery.startedAt).toLocaleString()}
                            </p>
                          </div>
                        )}

                        {delivery.finishedAt && (
                          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Finalizó
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {new Date(delivery.finishedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {delivery.notes ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Observaciones
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{delivery.notes}</p>
                        </div>
                      ) : null}
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

export default EnterpriseLogistics;
