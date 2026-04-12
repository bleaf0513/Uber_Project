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

const EnterpriseLogistics = () => {
  const todayDate = new Date().toISOString().slice(0, 10);

  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  const [listDriverFilter, setListDriverFilter] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState("Todos");
  const [listDateFilter, setListDateFilter] = useState(todayDate);
  const [listScopeFilter, setListScopeFilter] = useState("Hoy");

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);

  const [globalIncomingBanner, setGlobalIncomingBanner] = useState(null);
  const [driverChatAlerts, setDriverChatAlerts] = useState({});

  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const addressBoxRef = useRef(null);

  const driversRequestSeqRef = useRef(0);
  const deliveriesRequestSeqRef = useRef(0);
  const driversPollingBusyRef = useRef(false);
  const deliveriesPollingBusyRef = useRef(false);

  const chatPollingBusyRef = useRef(false);
  const knownLastDriverMessageByDeliveryRef = useRef({});
  const chatMonitorInitializedRef = useRef(false);
  const audioContextRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const originalTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Panel de Logística"
  );

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

  const normalizeSuggestionRows = (rows) => {
    const normalized = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        description:
          row.description ||
          row.structured_formatting?.main_text ||
          row.formatted_address ||
          "",
        place_id: row.place_id || "",
      }))
      .filter((r) => r.description);

    const priorityMatches = normalized.filter((item) => {
      const text = item.description.toLowerCase();
      return (
        text.includes("colombia") ||
        text.includes("antioquia") ||
        text.includes("medellín") ||
        text.includes("medellin") ||
        text.includes("itagüí") ||
        text.includes("itagui")
      );
    });

    return priorityMatches.length > 0 ? priorityMatches : normalized;
  };

  const runFetchSuggestions = useCallback(async (query) => {
    const seq = ++suggestionSeqRef.current;

    try {
      const searchQuery = normalizeAddressQuery(query);

      const { data } = await axios.get(`${API_BASE}/maps/get-suggestions`, {
        params: { address: searchQuery },
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
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (audioContextRef.current && typeof audioContextRef.current.close === "function") {
        audioContextRef.current.close().catch(() => {});
      }
      if (typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
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

          <Link
            to="/enterprise-dashboard"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Volver
          </Link>
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
                placeholder="Dirección o lugar de entrega"
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
                Escribe mínimo 3 letras. La búsqueda prioriza resultados de Colombia.
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
