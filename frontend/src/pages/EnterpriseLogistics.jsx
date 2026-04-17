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
    <div
      ref={mapRef}
      className="w-full h-[480px] rounded-2xl overflow-hidden border border-gray-200"
    />
  );
};

const emptyFormData = {
  invoiceNumber: "",
  clientId: "",
  clientName: "",
  address: "",
  clientPhone: "",
  neighborhood: "",
  reference: "",
  assignedDriverId: "",
  invoiceValue: "",
  paymentMethod: "Efectivo",
  notes: "",
  placeId: "",
};

const EnterpriseLogistics = () => {
  const todayDate = new Date().toISOString().slice(0, 10);

  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [clients, setClients] = useState([]);

  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);

  const [listDriverFilter, setListDriverFilter] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState("Todos");
  const [listDateFilter, setListDateFilter] = useState(todayDate);
  const [listScopeFilter, setListScopeFilter] = useState("Hoy");

  const [clientSearch, setClientSearch] = useState("");
  const [globalIncomingBanner, setGlobalIncomingBanner] = useState(null);
  const [driverChatAlerts, setDriverChatAlerts] = useState({});

  const [routeSummaryLoading, setRouteSummaryLoading] = useState(false);
  const [routeSummaryDate, setRouteSummaryDate] = useState(todayDate);
  const [selectedDriverRouteSummary, setSelectedDriverRouteSummary] = useState(null);

  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const addressBoxRef = useRef(null);

  const driversRequestSeqRef = useRef(0);
  const deliveriesRequestSeqRef = useRef(0);
  const clientsRequestSeqRef = useRef(0);
  const driversPollingBusyRef = useRef(false);
  const deliveriesPollingBusyRef = useRef(false);
  const clientsPollingBusyRef = useRef(false);

  const chatPollingBusyRef = useRef(false);
  const knownLastDriverMessageByDeliveryRef = useRef({});
  const chatMonitorInitializedRef = useRef(false);
  const audioContextRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const originalTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Panel de Logística"
  );

  const [formData, setFormData] = useState(emptyFormData);

  const driverIdValue = (driver) => String(driver?._id || driver?.id || "");
  const clientIdValue = (client) => String(client?._id || client?.id || "");

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
        String(a?.invoiceValue || "") !== String(b?.invoiceValue || "") ||
        String(a?.paymentMethod || "") !== String(b?.paymentMethod || "") ||
        String(aDriverId) !== String(bDriverId)
      ) {
        return false;
      }
    }

    return true;
  };

  const getDeliveryAssignedId = (delivery) =>
    String(
      delivery?.assignedDriverId?._id ||
        delivery?.assignedDriverId ||
        delivery?.driver?._id ||
        delivery?.driver ||
        ""
    );

  const getDeliveryReferenceDate = (delivery) => {
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
  };

  const normalizeAddressQuery = (query) => {
    const clean = String(query || "").trim();
    if (!clean) return "";

    const lowered = clean.toLowerCase();
    if (
      lowered.includes("colombia") ||
      lowered.includes("medellín") ||
      lowered.includes("medellin") ||
      lowered.includes("itagüí") ||
      lowered.includes("itagui") ||
      lowered.includes("antioquia")
    ) {
      return clean;
    }

    return `${clean}, Colombia`;
  };

  const normalizeSender = (msg) =>
    String(msg?.senderType || msg?.senderRole || msg?.sender || msg?.role || "")
      .trim()
      .toLowerCase();

  const isIncomingForLogistics = (msg) => {
    const sender = normalizeSender(msg);
    return sender === "driver" || sender === "conductor";
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }

    return audioContextRef.current;
  };

  const playIncomingMessageSound = async () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

      const tone1 = ctx.createOscillator();
      tone1.type = "square";
      tone1.frequency.setValueAtTime(950, now);
      tone1.connect(gain);
      tone1.start(now);
      tone1.stop(now + 0.16);

      const tone2 = ctx.createOscillator();
      tone2.type = "square";
      tone2.frequency.setValueAtTime(1250, now + 0.18);
      tone2.connect(gain);
      tone2.start(now + 0.18);
      tone2.stop(now + 0.36);

      const tone3 = ctx.createOscillator();
      tone3.type = "triangle";
      tone3.frequency.setValueAtTime(1450, now + 0.38);
      tone3.connect(gain);
      tone3.start(now + 0.38);
      tone3.stop(now + 0.54);
    } catch (error) {
      console.error("No se pudo reproducir el sonido global:", error);
    }
  };

  const showBrowserNotification = (driverName, messageText) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }

    if (Notification.permission === "granted") {
      try {
        const notification = new Notification("Nuevo mensaje para logística", {
          body: `${driverName}: ${messageText || "Te escribió un conductor"}`,
          tag: `enterprise-logistics-global-chat`,
        });

        notification.onclick = () => {
          window.focus();
        };
      } catch (error) {
        console.error("No se pudo mostrar la notificación del navegador:", error);
      }
      return;
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission().catch((error) => {
        console.error("No se pudo solicitar permiso de notificación:", error);
      });
    }
  };

  const showGlobalIncomingBanner = (payload) => {
    setGlobalIncomingBanner(payload);

    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }

    bannerTimerRef.current = setTimeout(() => {
      setGlobalIncomingBanner(null);
      bannerTimerRef.current = null;
    }, 5000);
  };

  const markDriverAlertsAsSeen = useCallback((driverId) => {
    const key = String(driverId || "");
    if (!key) return;

    setDriverChatAlerts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

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

  const fetchClients = useCallback(async (silent = false) => {
    if (silent && clientsPollingBusyRef.current) return;

    const seq = ++clientsRequestSeqRef.current;

    try {
      if (silent) {
        clientsPollingBusyRef.current = true;
      } else {
        setLoadingClients(true);
      }

      const response = await fetch(`${API_BASE}/enterprise-clients`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response, "GET /enterprise-clients");

      if (seq !== clientsRequestSeqRef.current) return;

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los clientes.");
      }

      const incomingClients = Array.isArray(data.clients) ? data.clients : [];
      setClients(incomingClients);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      if (!silent) {
        alert(error.message || "Error cargando clientes.");
      }
    } finally {
      if (silent) {
        clientsPollingBusyRef.current = false;
      } else {
        setLoadingClients(false);
      }
    }
  }, []);

  const scanGlobalChats = useCallback(async () => {
    if (chatPollingBusyRef.current) return;
    if (!Array.isArray(deliveries) || deliveries.length === 0) return;

    const candidateDeliveries = [...deliveries]
      .filter((delivery) => {
        const status = String(delivery?.status || "");
        return status === "Pendiente" || status === "En curso" || status === "Finalizada";
      })
      .sort((a, b) => {
        const aTime = new Date(
          a?.updatedAt || a?.finishedAt || a?.startedAt || a?.createdAt || 0
        ).getTime();
        const bTime = new Date(
          b?.updatedAt || b?.finishedAt || b?.startedAt || b?.createdAt || 0
        ).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);

    if (candidateDeliveries.length === 0) return;

    chatPollingBusyRef.current = true;

    try {
      const results = await Promise.all(
        candidateDeliveries.map(async (delivery) => {
          const currentDeliveryId = String(delivery?._id || delivery?.id || "");
          if (!currentDeliveryId) return null;

          try {
            const response = await fetch(`${API_BASE}/enterprise-chat/${currentDeliveryId}`, {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            });

            const data = await parseJsonSafe(
              response,
              `GET /enterprise-chat/${currentDeliveryId}`
            );

            if (!response.ok) {
              return null;
            }

            const messages = Array.isArray(data.messages) ? data.messages : [];
            const lastIncoming = [...messages].reverse().find(isIncomingForLogistics);

            return {
              delivery,
              lastIncoming,
            };
          } catch (error) {
            console.error("Error revisando chat global:", error);
            return null;
          }
        })
      );

      const freshAlerts = [];
      const nextKnown = { ...knownLastDriverMessageByDeliveryRef.current };

      results.forEach((row) => {
        if (!row?.delivery) return;

        const delivery = row.delivery;
        const currentDeliveryId = String(delivery?._id || delivery?.id || "");
        const lastIncoming = row.lastIncoming;

        if (!lastIncoming) {
          if (!nextKnown[currentDeliveryId]) {
            nextKnown[currentDeliveryId] = "";
          }
          return;
        }

        const signature = JSON.stringify({
          id: lastIncoming?._id || "",
          text: lastIncoming?.text || "",
          createdAt: lastIncoming?.createdAt || "",
          sender: normalizeSender(lastIncoming),
        });

        const previousSignature = nextKnown[currentDeliveryId] || "";

        if (!chatMonitorInitializedRef.current) {
          nextKnown[currentDeliveryId] = signature;
          return;
        }

        if (signature && signature !== previousSignature) {
          const assignedDriverId = getDeliveryAssignedId(delivery);
          const assignedDriverName =
            delivery?.assignedDriverName ||
            delivery?.assignedDriverId?.name ||
            drivers.find((d) => driverIdValue(d) === String(assignedDriverId))?.name ||
            "Conductor";

          freshAlerts.push({
            driverId: String(assignedDriverId || ""),
            driverName: assignedDriverName,
            messageText: lastIncoming?.text || "",
            createdAt: lastIncoming?.createdAt || new Date().toISOString(),
            deliveryId: currentDeliveryId,
            invoiceNumber: delivery?.invoiceNumber || "",
          });
        }

        nextKnown[currentDeliveryId] = signature;
      });

      knownLastDriverMessageByDeliveryRef.current = nextKnown;

      if (!chatMonitorInitializedRef.current) {
        chatMonitorInitializedRef.current = true;
        return;
      }

      if (freshAlerts.length > 0) {
        const latest = freshAlerts[freshAlerts.length - 1];

        setDriverChatAlerts((prev) => {
          const next = { ...prev };

          freshAlerts.forEach((alert) => {
            if (!alert.driverId) return;
            next[alert.driverId] = {
              driverName: alert.driverName,
              messageText: alert.messageText,
              createdAt: alert.createdAt,
              deliveryId: alert.deliveryId,
              invoiceNumber: alert.invoiceNumber,
            };
          });

          return next;
        });

        const currentlyOpenDriver = String(selectedDriverFilter || "");
        if (!latest.driverId || latest.driverId !== currentlyOpenDriver) {
          showGlobalIncomingBanner(latest);
          await playIncomingMessageSound();
          showBrowserNotification(latest.driverName, latest.messageText);

          if (typeof document !== "undefined" && document.hidden) {
            document.title = `🔔 ${latest.driverName} escribió`;
          }
        }
      }
    } finally {
      chatPollingBusyRef.current = false;
    }
  }, [deliveries, drivers, selectedDriverFilter]);

  useEffect(() => {
    fetchDrivers(false);
    fetchDeliveries(false);
    fetchClients(false);

    const interval = setInterval(() => {
      fetchDrivers(true);
      fetchDeliveries(true);
      fetchClients(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchDrivers, fetchDeliveries, fetchClients]);

  useEffect(() => {
    if (!deliveries.length) return;

    scanGlobalChats();
    const interval = setInterval(() => {
      scanGlobalChats();
    }, 4000);

    return () => clearInterval(interval);
  }, [deliveries, scanGlobalChats]);

  useEffect(() => {
    if (selectedDriverFilter) {
      markDriverAlertsAsSeen(selectedDriverFilter);
      if (typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
    }
  }, [selectedDriverFilter, markDriverAlertsAsSeen]);

  useEffect(() => {
    const restoreTitle = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        document.title = originalTitleRef.current;
      }
    };

    window.addEventListener("focus", restoreTitle);
    document.addEventListener("visibilitychange", restoreTitle);

    return () => {
      window.removeEventListener("focus", restoreTitle);
      document.removeEventListener("visibilitychange", restoreTitle);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (audioContextRef.current && typeof audioContextRef.current.close === "function") {
        audioContextRef.current.close().catch(() => {});
      }
      if (typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
    };
  }, []);

  const selectedClient = useMemo(() => {
    if (!formData.clientId) return null;
    return (
      clients.find((client) => clientIdValue(client) === String(formData.clientId)) || null
    );
  }, [clients, formData.clientId]);

  const filteredClientsForSelect = useMemo(() => {
    const term = String(clientSearch || "").trim().toLowerCase();

    return clients
      .filter((client) => Boolean(client?.isActive ?? true))
      .filter((client) => {
        if (!term) return true;
        return String(client?.name || "").toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const aUpdated = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bUpdated = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bUpdated - aUpdated;
      });
  }, [clients, clientSearch]);

  const handleClientSelect = (clientId) => {
    const client =
      clients.find((item) => clientIdValue(item) === String(clientId || "")) || null;

    if (!client) {
      setFormData((prev) => ({
        ...prev,
        clientId: "",
        clientName: "",
        address: "",
        clientPhone: "",
        neighborhood: "",
        reference: "",
        placeId: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      clientId: clientIdValue(client),
      clientName: client?.name || "",
      address: client?.address || "",
      clientPhone: client?.phone || "",
      neighborhood: client?.neighborhood || "",
      reference: client?.reference || "",
      placeId: client?.placeId || "",
    }));
  };

  const resetDeliveryForm = () => {
    setFormData(emptyFormData);
    setClientSearch("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveDelivery = async (e) => {
    e.preventDefault();

    const {
      invoiceNumber,
      clientId,
      assignedDriverId,
      invoiceValue,
      paymentMethod,
      notes,
    } = formData;

    if (!invoiceNumber || !clientId || !assignedDriverId) {
      alert("Debes seleccionar cliente, número de factura y conductor.");
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => driverIdValue(driver) === String(assignedDriverId)
    );

    if (!selectedDriver) {
      alert("Debes seleccionar un conductor válido.");
      return;
    }

    const currentClient =
      clients.find((client) => clientIdValue(client) === String(clientId)) || null;

    if (!currentClient) {
      alert("Debes seleccionar un cliente válido.");
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
          clientId,
          assignedDriverId,
          invoiceValue: Number(invoiceValue || 0),
          paymentMethod: paymentMethod || "Efectivo",
          notes,
        }),
      });

      const data = await parseJsonSafe(response, "POST /enterprise-deliveries");

      if (!response.ok) {
        throw new Error(data.message || "No fue posible guardar la entrega.");
      }

      resetDeliveryForm();

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
      return getDeliveryAssignedId(delivery) === String(selectedDriverFilter);
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
      return (
        getDeliveryAssignedId(delivery) === String(driverIdValue(selectedDriver)) &&
        delivery.status !== "Finalizada"
      );
    });
  }, [deliveries, selectedDriver]);

  const selectedDriverActiveDelivery = useMemo(() => {
    if (!selectedDriver) return null;

    return (
      deliveries.find((delivery) => {
        return (
          getDeliveryAssignedId(delivery) === String(driverIdValue(selectedDriver)) &&
          delivery.status === "En curso"
        );
      }) || null
    );
  }, [deliveries, selectedDriver]);

  const selectedDriverLastFinishedDelivery = useMemo(() => {
    if (!selectedDriver) return null;

    const completed = deliveries
      .filter((delivery) => {
        return (
          getDeliveryAssignedId(delivery) === String(driverIdValue(selectedDriver)) &&
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

  const listFilteredDeliveries = useMemo(() => {
    return deliveries
      .filter((delivery) => {
        const matchesDriver =
          !listDriverFilter || getDeliveryAssignedId(delivery) === String(listDriverFilter);

        const matchesStatus =
          listStatusFilter === "Todos" || String(delivery?.status || "") === String(listStatusFilter);

        const deliveryDate = getDeliveryReferenceDate(delivery);

        const matchesDate =
          listScopeFilter === "Todos"
            ? !listDateFilter || deliveryDate === listDateFilter
            : deliveryDate === listDateFilter;

        return matchesDriver && matchesStatus && matchesDate;
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
  }, [deliveries, listDriverFilter, listStatusFilter, listDateFilter, listScopeFilter]);

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

  const handleListScopeChange = (scope) => {
    setListScopeFilter(scope);
    if (scope === "Hoy") {
      setListDateFilter(todayDate);
    }
  };

  const fetchSelectedDriverRouteSummary = useCallback(async () => {
    if (!selectedDriver?._id) {
      setSelectedDriverRouteSummary(null);
      return;
    }

    try {
      setRouteSummaryLoading(true);

      const response = await fetch(
        `${API_BASE}/enterprise-drivers/${selectedDriver._id}/route-summary?date=${routeSummaryDate}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await parseJsonSafe(
        response,
        "GET /enterprise-drivers/:id/route-summary"
      );

      if (!response.ok) {
        throw new Error(
          data.message || "No se pudo cargar el resumen de ruta del conductor."
        );
      }

      setSelectedDriverRouteSummary(data);
    } catch (error) {
      console.error("Error cargando resumen de ruta:", error);
      setSelectedDriverRouteSummary(null);
    } finally {
      setRouteSummaryLoading(false);
    }
  }, [selectedDriver?._id, routeSummaryDate]);

  useEffect(() => {
    fetchSelectedDriverRouteSummary();
  }, [fetchSelectedDriverRouteSummary]);

  const formatDurationText = (seconds) => {
    const total = Number(seconds || 0);
    if (!Number.isFinite(total) || total <= 0) return "0 min";

    const hours = Math.floor(total / 3600);
    const minutes = Math.round((total % 3600) / 60);

    if (hours <= 0) return `${minutes} min`;
    return `${hours} h ${minutes} min`;
  };

  const routeSummary = selectedDriverRouteSummary?.summary || null;
  const routeShift = routeSummary?.shift || null;
  const routeDeliveries = routeSummary?.deliveries || null;
  const routePoints = Array.isArray(routeSummary?.routePoints)
    ? routeSummary.routePoints
    : [];

  const totalUnreadDrivers = Object.keys(driverChatAlerts).length;

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

          <div className="flex gap-2 flex-wrap">
            <Link
              to="/enterprise-clients"
              className="bg-blue-900 text-white px-4 py-2 rounded-xl font-semibold"
            >
              Clientes
            </Link>

            <Link
              to="/enterprise-dashboard"
              className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="p-5">
        {globalIncomingBanner ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  🔔 Nuevo mensaje para logística
                </p>
                <p className="text-sm text-amber-900 mt-1">
                  <span className="font-semibold">{globalIncomingBanner.driverName}</span>
                  {globalIncomingBanner.invoiceNumber
                    ? ` · Factura #${globalIncomingBanner.invoiceNumber}`
                    : ""}
                </p>
                <p className="text-sm text-amber-900 mt-1">
                  {globalIncomingBanner.messageText || "Te escribió un conductor."}
                </p>
              </div>

              {globalIncomingBanner.driverId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDriverFilter(globalIncomingBanner.driverId);
                    markDriverAlertsAsSeen(globalIncomingBanner.driverId);
                    setGlobalIncomingBanner(null);
                  }}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl font-semibold"
                >
                  Abrir conductor
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Crear nueva entrega
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Selecciona un cliente y el sistema autollena la información principal.
              </p>
            </div>

            <Link
              to="/enterprise-clients"
              className="bg-fuchsia-600 text-white px-4 py-2 rounded-xl font-semibold"
            >
              Base de datos de clientes
            </Link>
          </div>

          <form onSubmit={handleSaveDelivery} className="grid grid-cols-1 gap-4">
            <input
              name="invoiceNumber"
              type="text"
              placeholder="Número de factura"
              value={formData.invoiceNumber}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <div className="relative">
              <input
                type="text"
                placeholder="Seleccionar cliente"
                value={
                  formData.clientId
                    ? `${formData.clientName || ""}`
                    : clientSearch
                }
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  if (formData.clientId) {
                    setFormData((prev) => ({
                      ...prev,
                      clientId: "",
                      clientName: "",
                      address: "",
                      clientPhone: "",
                      neighborhood: "",
                      reference: "",
                      placeId: "",
                    }));
                  }
                }}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
                disabled={loadingClients}
              />

              {!loadingClients && !formData.clientId && clientSearch.trim() !== "" && (
                <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {filteredClientsForSelect.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No se encontraron clientes
                    </div>
                  ) : (
                    filteredClientsForSelect.map((client) => (
                      <button
                        key={clientIdValue(client)}
                        type="button"
                        onClick={() => {
                          handleClientSelect(clientIdValue(client));
                          setClientSearch("");
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">
                          {client.phone} - {client.address}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedClient ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-700 font-semibold">Cliente</p>
                  <p className="text-sm text-gray-800 mt-1">{formData.clientName || "-"}</p>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-700 font-semibold">Teléfono</p>
                  <p className="text-sm text-gray-800 mt-1">{formData.clientPhone || "-"}</p>
                </div>

                <div className="bg-indigo-50 rounded-xl p-4 md:col-span-2">
                  <p className="text-sm text-indigo-700 font-semibold">Dirección</p>
                  <p className="text-sm text-gray-800 mt-1">{formData.address || "-"}</p>
                </div>

                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-sm text-emerald-700 font-semibold">Barrio</p>
                  <p className="text-sm text-gray-800 mt-1">{formData.neighborhood || "Sin barrio"}</p>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-purple-700 font-semibold">Referencia</p>
                  <p className="text-sm text-gray-800 mt-1">{formData.reference || "Sin referencia"}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-orange-600 font-medium">
                Selecciona un cliente de la base de datos para autollenar la entrega.
              </p>
            )}

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

            <input
              name="invoiceValue"
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor de la factura"
              value={formData.invoiceValue}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="Efectivo">Pago en efectivo</option>
              <option value="Transferencia">Pago por transferencia</option>
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
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">
              Supervisar por conductor
            </h2>

            <div className="text-sm">
              {totalUnreadDrivers > 0 ? (
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 font-semibold">
                  🔔 {totalUnreadDrivers} con mensaje nuevo
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-3 py-1 font-semibold">
                  Sin mensajes nuevos
                </span>
              )}
            </div>
          </div>

          <select
            value={selectedDriverFilter}
            onChange={(e) => {
              setSelectedDriverFilter(e.target.value);
              markDriverAlertsAsSeen(e.target.value);
            }}
            className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          >
            <option value="">Ver todos los conductores</option>
            {drivers.map((driver) => {
              const currentId = driverIdValue(driver);
              const hasUnread = !!driverChatAlerts[currentId];

              return (
                <option key={currentId} value={currentId}>
                  {hasUnread ? "• nuevo - " : ""}
                  {driver.name} - CC {driver.cedula} - {driver.vehicle}
                </option>
              );
            })}
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
          <div className="bg-white rounded-2xl shadow p-5 mb-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Recorrido total del conductor
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Jornada, puntos GPS y tiempos reales acumulados del día.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <input
                  type="date"
                  value={routeSummaryDate}
                  onChange={(e) => setRouteSummaryDate(e.target.value)}
                  className="bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
                />

                <button
                  type="button"
                  onClick={fetchSelectedDriverRouteSummary}
                  className="bg-slate-800 text-white px-4 py-3 rounded-xl font-semibold"
                >
                  Actualizar recorrido
                </button>
              </div>
            </div>

            {routeSummaryLoading ? (
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-8 text-center text-gray-500">
                Cargando recorrido del conductor...
              </div>
            ) : !routeShift ? (
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-8 text-center text-gray-500">
                No hay jornada registrada para esta fecha.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-blue-700 font-semibold">Estado jornada</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {routeShift.status || "—"}
                    </p>
                  </div>

                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-sm text-emerald-700 font-semibold">Kilómetros</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {Number(routeShift.totalDistanceKm || 0).toFixed(2)} km
                    </p>
                  </div>

                  <div className="bg-indigo-50 rounded-xl p-4">
                    <p className="text-sm text-indigo-700 font-semibold">Puntos GPS</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {Number(routeShift.totalPoints || 0)}
                    </p>
                  </div>

                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-sm text-amber-700 font-semibold">Tiempo jornada</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatDurationText(routeShift.shiftDurationSeconds)}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm text-purple-700 font-semibold">
                      Promedio real por entrega
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatDurationText(routeDeliveries?.avgRealDurationSeconds)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Inicio jornada</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {routeShift.startedAt
                        ? new Date(routeShift.startedAt).toLocaleString()
                        : "Sin dato"}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Fin jornada</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {routeShift.endedAt
                        ? new Date(routeShift.endedAt).toLocaleString()
                        : "Jornada activa"}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Entregas del día</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {routeDeliveries?.total || 0}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Entregas finalizadas</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {routeDeliveries?.finished || 0}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Puntos registrados en la ruta
                  </p>
                  <p className="text-sm text-gray-600">
                    {routePoints.length > 0
                      ? `Se registraron ${routePoints.length} puntos GPS para esta jornada.`
                      : "Aún no hay puntos GPS guardados para esta jornada."}
                  </p>
                </div>
              </>
            )}
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
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Pedidos asignados
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Por defecto se muestran los pedidos de hoy para evitar una lista demasiado larga.
              </p>
            </div>

            <div className="text-sm text-gray-600 font-medium">
              Total mostrados: {listFilteredDeliveries.length}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleListScopeChange("Hoy")}
              className={`px-4 py-2 rounded-xl font-semibold ${
                listScopeFilter === "Hoy"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              Ver hoy
            </button>

            <button
              type="button"
              onClick={() => handleListScopeChange("Todos")}
              className={`px-4 py-2 rounded-xl font-semibold ${
                listScopeFilter === "Todos"
                  ? "bg-slate-800 text-white"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              Ver todos
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <input
              type="date"
              value={listDateFilter}
              onChange={(e) => {
                setListDateFilter(e.target.value);
                setListScopeFilter("Todos");
              }}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select
              value={listDriverFilter}
              onChange={(e) => setListDriverFilter(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="">Todos los conductores</option>
              {drivers.map((driver) => (
                <option key={driverIdValue(driver)} value={driverIdValue(driver)}>
                  {driver.name} - CC {driver.cedula}
                </option>
              ))}
            </select>

            <select
              value={listStatusFilter}
              onChange={(e) => setListStatusFilter(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En curso">En curso</option>
              <option value="Finalizada">Finalizada</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setListDateFilter(todayDate);
                setListDriverFilter("");
                setListStatusFilter("Todos");
                setListScopeFilter("Hoy");
              }}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 font-semibold"
            >
              Reiniciar filtros
            </button>
          </div>

          {loadingDeliveries ? (
            <p className="text-gray-500">Cargando pedidos...</p>
          ) : listFilteredDeliveries.length === 0 ? (
            <p className="text-gray-500">No hay pedidos para este filtro.</p>
          ) : (
            <div className="space-y-4">
              {listFilteredDeliveries.map((delivery) => {
                const deliveryId = delivery._id || delivery.id;
                const assignedId = getDeliveryAssignedId(delivery);
                const hasUnread = !!driverChatAlerts[String(assignedId || "")];

                return (
                  <div
                    key={deliveryId}
                    className={`border rounded-xl p-4 ${
                      hasUnread ? "border-red-300 bg-red-50/40" : ""
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          Factura #{delivery.invoiceNumber}
                          {hasUnread ? (
                            <span className="ml-2 inline-block bg-red-100 text-red-700 px-2 py-1 rounded-full text-[11px] font-semibold align-middle">
                              mensaje nuevo
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Fecha: {getDeliveryReferenceDate(delivery) || "Sin fecha"}
                        </p>
                      </div>

                      <div>
                        <span
                          className={
                            delivery.status === "Finalizada"
                              ? "inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold"
                              : delivery.status === "En curso"
                              ? "inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold"
                              : "inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold"
                          }
                        >
                          {delivery.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mt-3">
                      Cliente: {delivery.clientName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Dirección: {delivery.address}
                    </p>
                    <p className="text-sm text-gray-600">
                      Teléfono: {delivery.clientPhone}
                    </p>

                    {delivery.neighborhood ? (
                      <p className="text-sm text-gray-600">
                        Barrio: {delivery.neighborhood}
                      </p>
                    ) : null}

                    {delivery.reference ? (
                      <p className="text-sm text-gray-600">
                        Referencia: {delivery.reference}
                      </p>
                    ) : null}

                    <p className="text-sm text-blue-600 font-semibold mt-2">
                      Asignado a:{" "}
                      {delivery.assignedDriverName ||
                        delivery.assignedDriverId?.name ||
                        "Sin nombre"}
                    </p>

                    <p className="text-sm text-gray-700 mt-1">
                      Valor factura:{" "}
                      <span className="font-semibold">
                        ${Number(delivery.invoiceValue || 0).toLocaleString()}
                      </span>
                    </p>

                    <p className="text-sm text-gray-700">
                      Método de pago:{" "}
                      <span className="font-semibold">
                        {delivery.paymentMethod || "Efectivo"}
                      </span>
                    </p>

                    {delivery.placeId ? (
                      <p className="text-xs text-gray-500 mt-1">
                        placeId: {delivery.placeId}
                      </p>
                    ) : null}

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

                    <div className="flex justify-end gap-2 mt-3 flex-wrap">
                      {assignedId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDriverFilter(String(assignedId));
                            markDriverAlertsAsSeen(String(assignedId));
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-semibold"
                        >
                          Abrir conductor
                        </button>
                      ) : null}

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