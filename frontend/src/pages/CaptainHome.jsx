import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import "remixicon/fonts/remixicon.css";
import CaptainDetails from "../../components/CaptainDetails";
import RidePopup from "../../components/RidePopup";
import { CaptainDataContext } from "../context/CaptainContext";
import { SocketContext } from "../context/SocketContext";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import LiveTracking from "../../components/LiveTracking";
import {
  requestPushPermissionAndRegister,
  listenForegroundPushNotifications,
} from "../services/pushNotifications";
import { formatCOP, getMyWallet } from "../services/walletService";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_DEEP_GRADIENT =
  "linear-gradient(135deg, #4C1D95 0%, #7E22CE 45%, #C026D3 100%)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";
const GPS_SOFT = "linear-gradient(135deg, #FAF5FF 0%, #FDF4FF 100%)";
const DARK_GLASS = "rgba(17, 24, 39, 0.94)";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const GPS_LAST_SUCCESS_PREFIX = "centralgo:gps-last-success:";
const GPS_DISMISSED_PREFIX = "centralgo:gps-dismissed:";
const GPS_RECENT_WINDOW_MS = 5 * 60 * 1000;

/*
 * CENTRAL GO - ocultamiento temporal por conductor.
 * AHORA: 5 minutos.
 * PROGRAMADO: 30 minutos.
 *
 * Se guarda en localStorage para que una recarga de pantalla no haga
 * reaparecer inmediatamente una solicitud que el conductor acaba de cerrar.
 */
const RIDE_SNOOZE_PREFIX = "centralgo:ride-snooze:";

const getRideSnoozeKey = (captainId, rideId) =>
  `${RIDE_SNOOZE_PREFIX}${captainId || "anonymous"}:${rideId || "unknown"}`;

const getRideSnoozeUntil = (captainId, rideId) => {
  if (!captainId || !rideId) return 0;

  const key = getRideSnoozeKey(captainId, rideId);
  const until = Number(localStorage.getItem(key) || 0);

  if (!Number.isFinite(until) || until <= Date.now()) {
    localStorage.removeItem(key);
    return 0;
  }

  return until;
};

const snoozeRideForCaptain = (captainId, rideData) => {
  if (!captainId || !rideData?._id) return 0;

  const minutes = rideData?.serviceTiming === "scheduled" ? 30 : 5;
  const until = Date.now() + minutes * 60 * 1000;

  localStorage.setItem(
    getRideSnoozeKey(captainId, String(rideData._id)),
    String(until)
  );

  return until;
};

const getGpsLastSuccessKey = (captainId) =>
  `${GPS_LAST_SUCCESS_PREFIX}${captainId || "anonymous"}`;

const getGpsDismissedKey = (captainId) =>
  `${GPS_DISMISSED_PREFIX}${captainId || "anonymous"}`;

const hasRecentGpsSuccess = (captainId) => {
  if (!captainId) return false;

  const raw = Number(
    localStorage.getItem(getGpsLastSuccessKey(captainId)) || 0
  );

  return Number.isFinite(raw) && Date.now() - raw < GPS_RECENT_WINDOW_MS;
};

const getCaptainToken = () =>
  localStorage.getItem("captainToken") ||
  localStorage.getItem("token") ||
  "";

const CaptainHome = () => {
  const ridePopupRef = useRef(null);
  const rideDetailsRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const lastLocationSentRef = useRef(0);
  const availableRidesIntervalRef = useRef(null);
  const activeRideCheckRef = useRef(false);
  const gpsResumeTimeoutRef = useRef(null);

  const navigate = useNavigate();

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);
  const [ridePopup, setRidePopup] = useState(false);
  const [rideDetailsOpen, setRideDetailsOpen] = useState(false);
  const [ride, setRide] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);

  const [profilePanelOpen, setProfilePanelOpen] = useState(false);

  const [walletData, setWalletData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingRideId, setProcessingRideId] = useState(null);

  const [geoSupported, setGeoSupported] = useState(true);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [locationError, setLocationError] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);
  const [gpsPromptDismissed, setGpsPromptDismissed] = useState(false);
  const [openingLocationSettings, setOpeningLocationSettings] = useState(false);

  useEffect(() => {
    if (!captain?._id) return;

    const recentSuccess = hasRecentGpsSuccess(captain._id);
    const dismissedThisSession =
      sessionStorage.getItem(getGpsDismissedKey(captain._id)) === "1";

    if (recentSuccess) {
      setLocationReady(true);
      setLocationPermission("granted");
      setShowGpsPrompt(false);
      setGpsPromptDismissed(false);
      setLocationError("");
    } else if (dismissedThisSession) {
      setGpsPromptDismissed(true);
    }
  }, [captain?._id]);

  useEffect(() => {
    const token =
      getCaptainToken();

    if (!token || !captain?._id) return;

    let unsubscribeForeground = null;
    let cancelled = false;

    const setupCaptainPushNotifications = async () => {
      try {
        const result = await requestPushPermissionAndRegister("captain");

        if (!cancelled) {
          console.log("[push-captain] Resultado registro:", result);
        }

        unsubscribeForeground = await listenForegroundPushNotifications(
          (payload) => {
            const notification = payload?.notification || {};
            const data = payload?.data || {};

            const title = notification.title || data.title || "Central Go";

            const body =
              notification.body ||
              data.body ||
              "Tienes una nueva notificación.";

            console.log("[push-captain] Notificación en primer plano:", {
              title,
              body,
              data,
            });

            if (document.visibilityState === "visible") {
              try {
                const audio = new Audio(
                  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
                );
                audio.volume = 0.35;
                audio.play().catch(() => {});
              } catch {
                // No bloqueamos si el navegador no permite audio.
              }
            }
          }
        );
      } catch (error) {
        console.warn("[push-captain] No se pudo activar push:", error);
      }
    };

    setupCaptainPushNotifications();

    return () => {
      cancelled = true;

      if (typeof unsubscribeForeground === "function") {
        unsubscribeForeground();
      }
    };
  }, [captain?._id]);

  const formatCOPShort = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const loadCaptainWallet = useCallback(async () => {
    try {
      setWalletLoading(true);

      const data = await getMyWallet();

      setWalletData(data);
    } catch (error) {
      console.warn(
        "[captain-home] No se pudo cargar billetera:",
        error?.response?.data?.message || error?.message
      );
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!captain?._id) return;

    loadCaptainWallet();
  }, [captain?._id, loadCaptainWallet]);

  const normalizeDistanceToKm = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }

    if (number > 300) {
      return number / 1000;
    }

    return number;
  };

  const formatKm = (value) => {
    const km = normalizeDistanceToKm(value);

    if (!Number.isFinite(km) || km <= 0) {
      return "-- km";
    }

    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }

    if (km >= 1000) {
      return "-- km";
    }

    return `${km.toFixed(1)} km`;
  };

  const formatShortAddress = (address = "") => {
    const safe = String(address || "").trim();

    if (!safe) return "Dirección no disponible";

    const parts = safe
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length <= 2) return safe;

    return `${parts[0]}, ${parts[1]}`;
  };

  const CARGO_LABELS = {
    market: "Mercado",
    boxes: "Cajas",
    packages: "Paquetes",
    sacks: "Bultos",
    baskets: "Canastillas",
    general_merchandise: "Mercancía general",
    other: "Otro",
  };

  const VEHICLE_LABELS = {
    motorcycle: "Moto",
    car: "Carro",
    light_cargo: "Carga liviana",
    motocarro: "Motocarguero",
    pickup: "Pickup",
    van: "Van",
    truck: "Camión",
    moving: "Mudanza",
  };

  const getSenderLabel = (rideData) =>
    rideData?.senderType === "business" ? "EMPRESA" : "PERSONAL";

  const getTimingLabel = (rideData) =>
    rideData?.serviceTiming === "scheduled" ? "PROGRAMADO" : "AHORA";

  const getCargoLabel = (rideData) =>
    CARGO_LABELS[rideData?.cargo?.category] || "Mercancía";

  const getVehicleLabel = (rideData) =>
    VEHICLE_LABELS[rideData?.vehicleType] ||
    VEHICLE_LABELS[rideData?.vehicle] ||
    "Vehículo";

  const getDeliveryCount = (rideData) =>
    getRouteStops(rideData).length + (rideData?.destination ? 1 : 0);

  const formatSchedule = (rideData) => {
    if (rideData?.serviceTiming !== "scheduled") return "Lo antes posible";

    const startRaw = rideData?.schedule?.pickupStartAt;
    const endRaw = rideData?.schedule?.pickupEndAt;

    if (!startRaw) return "Fecha programada";

    const start = new Date(startRaw);
    const end = endRaw ? new Date(endRaw) : null;

    if (Number.isNaN(start.getTime())) return "Fecha programada";

    const dateText = new Intl.DateTimeFormat("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "America/Bogota",
    }).format(start);

    const startTime = new Intl.DateTimeFormat("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(start);

    if (end && !Number.isNaN(end.getTime())) {
      const endTime = new Intl.DateTimeFormat("es-CO", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Bogota",
      }).format(end);

      return `${dateText} · ${startTime} - ${endTime}`;
    }

    return `${dateText} · ${startTime}`;
  };

  const getCargoSummary = (rideData) => {
    const cargo = rideData?.cargo || {};
    const quantity = Math.max(1, Number(cargo?.quantity) || 1);
    const category = getCargoLabel(rideData);

    const weightText = cargo?.weightUnknown
      ? "peso por confirmar"
      : Number(cargo?.approximateWeight) > 0
        ? `${Number(cargo.approximateWeight)} ${cargo?.weightUnit || "kg"}`
        : "peso no informado";

    return `${quantity} ${category.toLowerCase()} · ${weightText}`;
  };

  const getRouteStops = (rideData) => {
    return Array.isArray(rideData?.routeStops)
      ? rideData.routeStops.map((stop) => String(stop || "").trim()).filter(Boolean)
      : [];
  };

  const getUserName = (rideData) => {
    const user = rideData?.user || {};
    const fullname = user?.fullname || {};

    return (
      [fullname?.firstname, fullname?.lastname].filter(Boolean).join(" ") ||
      user?.name ||
      "Usuario"
    );
  };

  const getUserRating = (rideData) => {
    const value = Number(rideData?.user?.rating);
    return Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 5;
  };

  const getUserRatingCount = (rideData) => {
    const value = Number(rideData?.user?.ratingCount);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  };

  const getUserRatingLabel = (rideData) => {
    const count = getUserRatingCount(rideData);

    if (count <= 0) return "Nuevo";

    return `${count} calificación${count === 1 ? "" : "es"}`;
  };

  const getRideFare = (rideData) => {
    return Number(
      rideData?.offeredFare ?? rideData?.fare ?? rideData?.suggestedFare ?? 0
    );
  };

  const getDriverToPickupKm = (rideData) => {
    return (
      rideData?.metrics?.driverToPickupKm ??
      rideData?.metrics?.driverToPickup ??
      null
    );
  };

  const getPickupToDestinationKm = (rideData) => {
    const metricValue =
      rideData?.metrics?.pickupToDestinationKm ??
      rideData?.metrics?.pickupToDestination ??
      null;

    if (metricValue != null) {
      return normalizeDistanceToKm(metricValue);
    }

    return normalizeDistanceToKm(rideData?.distance);
  };

  const getQuickOfferValues = (rideData) => {
    const base = getRideFare(rideData);

    if (!base || base <= 0) {
      return [8000, 10000, 12000];
    }

    const option1 = Math.ceil((base * 1.08) / 500) * 500;
    const option2 = Math.ceil((base * 1.18) / 500) * 500;
    const option3 = Math.ceil((base * 1.3) / 500) * 500;

    return [option1, option2, option3];
  };

  const isScheduledReservedRide = useCallback((rideData) => {
    if (!rideData?._id) return false;

    const isScheduled =
      rideData?.serviceTiming === "scheduled" ||
      Boolean(rideData?.schedule?.pickupStartAt);

    const dispatchStarted =
      Boolean(rideData?.scheduledDispatchStartedAt);

    return (
      isScheduled &&
      rideData?.status === "accepted" &&
      !dispatchStarted
    );
  }, []);

  const goToActiveRide = useCallback(
    (rideData) => {
      if (!rideData?._id) return;

      if (isScheduledReservedRide(rideData)) {
        setRide(rideData);
        setRidePopup(false);
        setRideDetailsOpen(false);
        return;
      }

      setRide(rideData);
      setRidePopup(false);
      setRideDetailsOpen(false);

      setAvailableRides((prev) =>
        prev.filter((item) => String(item?._id) !== String(rideData._id))
      );

      navigate("/captain-riding", {
        state: {
          ride: rideData,
        },
      });
    },
    [navigate, isScheduledReservedRide]
  );

  const fetchCaptainActiveRide = useCallback(
    async ({ redirect = false } = {}) => {
      try {
        const token = getCaptainToken();

        if (!token) return null;

        const response = await axios.get(
          `${getApiBaseUrl()}/rides/captain/active`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const activeRide = response?.data?.ride || null;

        if (activeRide?._id) {
          if (redirect && !isScheduledReservedRide(activeRide)) {
            goToActiveRide(activeRide);
          } else if (isScheduledReservedRide(activeRide)) {
            setRide(activeRide);
          }

          return activeRide;
        }

        return null;
      } catch (error) {
        console.warn(
          "[captain-home] No se pudo consultar carrera activa:",
          error?.response?.data?.message || error?.message
        );

        return null;
      }
    },
    [goToActiveRide, isScheduledReservedRide]
  );

  const upsertAvailableRide = useCallback((rideData) => {
    if (!rideData?._id) return;

    const rideId = String(rideData._id);

    if (getRideSnoozeUntil(captain?._id, rideId)) return;

    setAvailableRides((prev) => {
      const exists = prev.some((item) => String(item._id) === rideId);

      if (exists) {
        return prev.map((item) =>
          String(item._id) === rideId ? { ...item, ...rideData } : item
        );
      }

      return [rideData, ...prev];
    });
  }, [captain?._id]);

  const removeAvailableRide = useCallback(
    (rideId) => {
      if (!rideId) return;

      setAvailableRides((prev) =>
        prev.filter((item) => String(item._id) !== String(rideId))
      );

      if (String(ride?._id || "") === String(rideId)) {
        setRidePopup(false);
        setRideDetailsOpen(false);
        setRide(null);
      }
    },
    [ride?._id]
  );

  const emitCaptainJoin = useCallback(() => {
    if (!captain?._id) {
      console.warn("[captain-home] no hay captain._id para join");
      return;
    }

    if (!socket?.connected) {
      console.warn("[captain-home] socket no conectado todavía");
      return;
    }

    socket.emit("join", {
      userId: captain._id,
      userType: "captain",
    });
  }, [captain?._id, socket]);

  const emitCaptainLocation = useCallback(
    (coords, source = "unknown") => {
      if (!captain?._id || !socket?.connected) return;

      const ltd = Number(coords?.latitude);
      const lng = Number(coords?.longitude);

      if (!Number.isFinite(ltd) || !Number.isFinite(lng)) return;

      const now = Date.now();
      const elapsed = now - lastLocationSentRef.current;

      if (elapsed < 1500 && source !== "connect-refresh") return;

      lastLocationSentRef.current = now;
      setLocationReady(true);
      setLocationError("");
      setShowGpsPrompt(false);
      setGpsPromptDismissed(false);
      setLocationPermission("granted");

      localStorage.setItem(
        getGpsLastSuccessKey(captain._id),
        String(now)
      );
      sessionStorage.removeItem(
        getGpsDismissedKey(captain._id)
      );

      socket.emit("update-location-captain", {
        userId: captain._id,
        location: { ltd, lng },
      });
    },
    [captain?._id, socket]
  );

  const getGeolocationErrorMessage = (error) => {
    const code = error?.code;

    if (code === 1) {
      return "Debes permitir el acceso a la ubicación para continuar.";
    }

    if (code === 2) {
      return "No se pudo detectar tu ubicación. Activa el GPS del dispositivo.";
    }

    if (code === 3) {
      return "La ubicación tardó demasiado. Intenta nuevamente.";
    }

    return error?.message || "No se pudo obtener la ubicación.";
  };

  const requestAndEmitCurrentLocation = useCallback(
    (source = "manual-request", forcePrompt = false) => {
      if (!navigator.geolocation) {
        setGeoSupported(false);
        setLocationReady(false);
        setShowGpsPrompt(true);
        setLocationError(
          "Este dispositivo o navegador no soporta geolocalización."
        );
        return;
      }

      setRequestingLocation(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          emitCaptainLocation(position.coords, source);
          setRequestingLocation(false);
        },
        (firstError) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              emitCaptainLocation(position.coords, `${source}-fallback`);
              setRequestingLocation(false);
            },
            (secondError) => {
              const message = getGeolocationErrorMessage(secondError || firstError);

              setRequestingLocation(false);
              setLocationReady(false);
              setLocationError(message);
              setShowGpsPrompt(true);

              if (secondError?.code === 1 || firstError?.code === 1) {
                setLocationPermission("denied");
              }
            },
            {
              enableHighAccuracy: false,
              maximumAge: 60000,
              timeout: 25000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        }
      );
    },
    [emitCaptainLocation]
  );

  const stopLocationTracking = useCallback(() => {
    if (locationWatchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }

    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(() => {
    if (!captain?._id || !socket || !navigator.geolocation) return;

    stopLocationTracking();

    requestAndEmitCurrentLocation("initial-getCurrentPosition");

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        emitCaptainLocation(position.coords, "watchPosition");
      },
      (error) => {
        const message = getGeolocationErrorMessage(error);

        setLocationReady(false);
        setLocationError(message);
        setShowGpsPrompt(true);

        if (error?.code === 1) {
          setLocationPermission("denied");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    locationIntervalRef.current = setInterval(() => {
      requestAndEmitCurrentLocation("interval-refresh");
    }, 15000);
  }, [
    captain?._id,
    socket,
    emitCaptainLocation,
    requestAndEmitCurrentLocation,
    stopLocationTracking,
  ]);

  const openLocationSettings = useCallback(async () => {
    setGpsPromptDismissed(false);
    setOpeningLocationSettings(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await BackgroundGeolocation.openSettings();
        return;
      }

      requestAndEmitCurrentLocation("web-location-settings", true);
    } catch (error) {
      console.warn(
        "[captain-home] No se pudieron abrir los ajustes de ubicación:",
        error?.message || error
      );

      requestAndEmitCurrentLocation("settings-fallback", true);
    } finally {
      setOpeningLocationSettings(false);
    }
  }, [requestAndEmitCurrentLocation]);

  const handleEnableGps = useCallback(async () => {
    setGpsPromptDismissed(false);

    if (
      locationPermission === "denied" ||
      (locationPermission === "granted" && !locationReady && locationError)
    ) {
      await openLocationSettings();
      return;
    }

    requestAndEmitCurrentLocation("manual-enable-gps", true);
  }, [
    locationPermission,
    locationReady,
    locationError,
    openLocationSettings,
    requestAndEmitCurrentLocation,
  ]);

  const handleDismissGpsPrompt = useCallback(() => {
    setGpsPromptDismissed(true);

    if (captain?._id) {
      sessionStorage.setItem(
        getGpsDismissedKey(captain._id),
        "1"
      );
    }
  }, [captain?._id]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoSupported(false);
      setShowGpsPrompt(true);
      setLocationError(
        "Este dispositivo o navegador no soporta geolocalización."
      );
      return;
    }

    setGeoSupported(true);

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setLocationPermission(result.state);

          if (result.state !== "granted") {
            setShowGpsPrompt(true);
          }

          result.onchange = () => {
            setLocationPermission(result.state);

            if (result.state === "granted") {
              setShowGpsPrompt(false);
              setGpsPromptDismissed(false);
              setLocationError("");
              setLocationReady(false);
              requestAndEmitCurrentLocation("permission-changed-granted");
            } else {
              setLocationReady(false);
              setShowGpsPrompt(true);
            }
          };
        })
        .catch(() => {
          setShowGpsPrompt(true);
          requestAndEmitCurrentLocation("initial-auto-request", true);
        });
    } else {
      setShowGpsPrompt(true);
      requestAndEmitCurrentLocation("initial-auto-request", true);
    }
  }, [requestAndEmitCurrentLocation]);

  useEffect(() => {
    if (!captain?._id) return;

    const reconnectLocation = () => {
      if (document.visibilityState !== "visible") return;

      if (gpsResumeTimeoutRef.current) {
        clearTimeout(gpsResumeTimeoutRef.current);
      }

      gpsResumeTimeoutRef.current = setTimeout(() => {
        requestAndEmitCurrentLocation("app-resume-auto-reconnect", false);
      }, 500);
    };

    document.addEventListener("visibilitychange", reconnectLocation);
    window.addEventListener("focus", reconnectLocation);

    return () => {
      document.removeEventListener("visibilitychange", reconnectLocation);
      window.removeEventListener("focus", reconnectLocation);

      if (gpsResumeTimeoutRef.current) {
        clearTimeout(gpsResumeTimeoutRef.current);
        gpsResumeTimeoutRef.current = null;
      }
    };
  }, [captain?._id, requestAndEmitCurrentLocation]);

  const fetchAvailableRidesForCaptain = useCallback(async () => {
    try {
      if (!captain?._id) return;

      const token = getCaptainToken();
      if (!token) return;

      const activeRide = await fetchCaptainActiveRide({ redirect: false });

      if (activeRide?._id) {
        if (!isScheduledReservedRide(activeRide)) {
          goToActiveRide(activeRide);
          return;
        }

        setRide(activeRide);
      }

      const response = await axios.get(
        `${getApiBaseUrl()}/rides/available-for-captain`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const rides = Array.isArray(response?.data?.rides)
        ? response.data.rides
        : [];

      const filteredRides = rides.filter((item) => {
        if (!item?._id) return false;

        return !getRideSnoozeUntil(
          captain?._id,
          String(item._id)
        );
      });

      setAvailableRides(filteredRides);
    } catch (error) {
      console.warn(
        "[captain-home] No se pudieron consultar viajes abiertos:",
        error?.response?.data?.message || error?.message
      );
    }
  }, [
    captain?._id,
    fetchCaptainActiveRide,
    goToActiveRide,
    isScheduledReservedRide,
  ]);

  useEffect(() => {
    if (!captain?._id) return;
    if (activeRideCheckRef.current) return;

    activeRideCheckRef.current = true;

    fetchCaptainActiveRide({ redirect: true });
  }, [captain?._id, fetchCaptainActiveRide]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setSocketReady(true);
      emitCaptainJoin();

      setTimeout(() => {
        requestAndEmitCurrentLocation("connect-refresh");
      }, 500);

      setTimeout(() => {
        fetchCaptainActiveRide({ redirect: true });
      }, 650);

      setTimeout(() => {
        fetchAvailableRidesForCaptain();
      }, 900);
    };

    const onDisconnect = () => {
      setSocketReady(false);
    };

    const onNewRide = (rideData) => {
      if (!rideData?._id) return;
      upsertAvailableRide(rideData);
    };

    const onRideNoLongerAvailable = (payload) => {
      const payloadRideId = String(payload?.rideId || payload?._id || "");

      if (!payloadRideId) return;

      removeAvailableRide(payloadRideId);
    };

    const onRideOfferRejected = (payload) => {
      const rideId = String(payload?._id || payload?.rideId || "");

      alert("El usuario rechazó tu oferta para este viaje.");

      setRidePopup(false);
      setRideDetailsOpen(false);
      setRide(null);

      if (rideId) {
        setTimeout(() => {
          fetchAvailableRidesForCaptain();
        }, 800);
      }
    };

    const onRideOfferAccepted = (payload) => {
      const acceptedRide = payload?.ride || payload;
      const acceptedRideId = String(
        acceptedRide?._id || payload?.rideId || ""
      );

      if (!acceptedRideId) return;

      const acceptedCaptainId = String(
        acceptedRide?.captain?._id || acceptedRide?.captain || ""
      );

      const currentCaptainId = String(captain?._id || "");
      const currentRideId = String(ride?._id || "");

      const belongsToMe =
        acceptedCaptainId && currentCaptainId
          ? acceptedCaptainId === currentCaptainId
          : true;

      if (belongsToMe) {
        if (isScheduledReservedRide(acceptedRide)) {
          setRide(acceptedRide);
          removeAvailableRide(acceptedRideId);
          return;
        }

        goToActiveRide(acceptedRide);
        return;
      }

      if (currentRideId && acceptedRideId === currentRideId) {
        if (isScheduledReservedRide(acceptedRide)) {
          setRide(acceptedRide);
          removeAvailableRide(acceptedRideId);
          return;
        }

        goToActiveRide(acceptedRide);
        return;
      }

      removeAvailableRide(acceptedRideId);
    };

    const onRideUpdated = (payload) => {
      const updatedRide = payload?.ride || payload;
      const updatedRideId = String(updatedRide?._id || payload?.rideId || "");

      if (!updatedRideId) return;

      const updatedCaptainId = String(
        updatedRide?.captain?._id || updatedRide?.captain || ""
      );

      if (
        updatedCaptainId &&
        captain?._id &&
        updatedCaptainId === String(captain._id) &&
        ["accepted", "arrived", "ongoing"].includes(updatedRide?.status)
      ) {
        if (isScheduledReservedRide(updatedRide)) {
          setRide(updatedRide);
          removeAvailableRide(updatedRideId);
          return;
        }

        goToActiveRide(updatedRide);
        return;
      }

      upsertAvailableRide(updatedRide);
    };

    const onRideUserOfferUpdated = (payload) => {
      const updatedRide = payload?.ride || payload?.data || payload;
      if (!updatedRide?._id) return;
      upsertAvailableRide(updatedRide);
    };

    const onWalletUpdated = () => {
      loadCaptainWallet();
    };

    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("new-ride", onNewRide);
    socket.off("ride-no-longer-available", onRideNoLongerAvailable);
    socket.off("ride-offer-rejected", onRideOfferRejected);
    socket.off("ride-offer-accepted", onRideOfferAccepted);
    socket.off("ride-updated", onRideUpdated);
    socket.off("ride-user-offer-updated", onRideUserOfferUpdated);
    socket.off("wallet-updated", onWalletUpdated);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-ride", onNewRide);
    socket.on("ride-no-longer-available", onRideNoLongerAvailable);
    socket.on("ride-offer-rejected", onRideOfferRejected);
    socket.on("ride-offer-accepted", onRideOfferAccepted);
    socket.on("ride-updated", onRideUpdated);
    socket.on("ride-user-offer-updated", onRideUserOfferUpdated);
    socket.on("wallet-updated", onWalletUpdated);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-ride", onNewRide);
      socket.off("ride-no-longer-available", onRideNoLongerAvailable);
      socket.off("ride-offer-rejected", onRideOfferRejected);
      socket.off("ride-offer-accepted", onRideOfferAccepted);
      socket.off("ride-updated", onRideUpdated);
      socket.off("ride-user-offer-updated", onRideUserOfferUpdated);
      socket.off("wallet-updated", onWalletUpdated);
    };
  }, [
    socket,
    emitCaptainJoin,
    requestAndEmitCurrentLocation,
    ride?._id,
    captain?._id,
    fetchCaptainActiveRide,
    fetchAvailableRidesForCaptain,
    upsertAvailableRide,
    removeAvailableRide,
    goToActiveRide,
    loadCaptainWallet,
  ]);

  useEffect(() => {
    if (!captain?._id || !socket || !geoSupported) return;

    if (locationPermission === "granted") {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [
    captain?._id,
    socket,
    geoSupported,
    locationPermission,
    startLocationTracking,
    stopLocationTracking,
  ]);

  useEffect(() => {
    if (!captain?._id) return;

    fetchAvailableRidesForCaptain();

    availableRidesIntervalRef.current = setInterval(() => {
      fetchAvailableRidesForCaptain();
    }, 15000);

    return () => {
      if (availableRidesIntervalRef.current) {
        clearInterval(availableRidesIntervalRef.current);
        availableRidesIntervalRef.current = null;
      }
    };
  }, [captain?._id, fetchAvailableRidesForCaptain]);

  const sendRideOffer = async ({ targetRide, price, message = "" }) => {
    try {
      const rideToOffer = targetRide || ride;

      if (!rideToOffer?._id) return;

      setProcessing(true);
      setProcessingRideId(String(rideToOffer._id));

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/captain-offer`,
        {
          rideId: rideToOffer._id,
          price,
          message,
        },
        {
          headers: {
            Authorization: `Bearer ${getCaptainToken()}`,
          },
        }
      );

      const updatedRide = response?.data || rideToOffer;

      setRide(updatedRide);
      setRidePopup(false);
      setRideDetailsOpen(false);

      setAvailableRides((prev) =>
        prev.filter((item) => String(item._id) !== String(rideToOffer._id))
      );

      alert("Oferta enviada al usuario correctamente.");
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          "No se pudo enviar la oferta del viaje."
      );
    } finally {
      setProcessing(false);
      setProcessingRideId(null);
    }
  };

  const confirmRide = async (targetRide = null) => {
    try {
      const rideToConfirm = targetRide || ride;

      if (!rideToConfirm?._id) return;

      const currentFare = getRideFare(rideToConfirm);

      if (!currentFare || currentFare <= 0) {
        alert("No hay un valor válido para aceptar este viaje.");
        return;
      }

      await sendRideOffer({
        targetRide: rideToConfirm,
        price: currentFare,
        message: "Acepto el valor propuesto por el usuario.",
      });
    } catch (error) {
      console.error("[captain-home] Error aceptando valor del usuario:", error);
    }
  };

  const handleCounterOffer = async ({ value, message }) => {
    await sendRideOffer({
      targetRide: ride,
      price: Number(value || 0),
      message: message || "Contraoferta del conductor.",
    });
  };

  const sendQuickOffer = async (value) => {
    if (!ride?._id) return;

    await sendRideOffer({
      targetRide: ride,
      price: Number(value || 0),
      message: "Oferta rápida del conductor.",
    });
  };

  const openCustomCounterOffer = () => {
    if (!ride?._id) return;
    setRidePopup(true);
  };

  const openRideDetails = (rideData) => {
    if (!rideData?._id) return;

    setRide(rideData);
    setRideDetailsOpen(true);
  };

  const closeRideDetails = () => {
    setRideDetailsOpen(false);
  };

  const ignoreRide = (rideData = null) => {
    const rideToIgnore = rideData || ride;

    if (rideToIgnore?._id) {
      snoozeRideForCaptain(captain?._id, rideToIgnore);
      removeAvailableRide(rideToIgnore._id);
    }

    setRidePopup(false);
    setRideDetailsOpen(false);
    setRide(null);
  };

  const goToGoodsOffer = () => {
    navigate("/captain/offers/goods");
  };

  const goToLoadMarketplace = () => {
    navigate("/captain/offers/space");
  };

  const goToSeatOffer = () => {
    navigate("/captain/offers/seats");
  };

  const goToReceivedBids = () => {
    navigate("/captain/offers/received");
  };

  useGSAP(
    () => {
      if (ridePopup) {
        gsap.to(ridePopupRef.current, {
          y: "0%",
          delay: 0.1,
          duration: 0.25,
          ease: "power2.out",
        });
      } else {
        gsap.to(ridePopupRef.current, {
          y: "100%",
          duration: 0.2,
          ease: "power2.inOut",
        });
      }
    },
    [ridePopup]
  );

  useGSAP(
    () => {
      if (rideDetailsOpen) {
        gsap.to(rideDetailsRef.current, {
          y: "0%",
          delay: 0.05,
          duration: 0.25,
          ease: "power2.out",
        });
      } else {
        gsap.to(rideDetailsRef.current, {
          y: "110%",
          duration: 0.2,
          ease: "power2.inOut",
        });
      }
    },
    [rideDetailsOpen]
  );

  const gpsBlocked = !locationReady || locationPermission !== "granted";

  const shouldShowGpsPrompt =
    showGpsPrompt &&
    !gpsPromptDismissed &&
    (!locationReady || locationPermission !== "granted");

  const gpsPrimaryActionLabel = openingLocationSettings
    ? "Abriendo ajustes..."
    : requestingLocation
      ? "Comprobando ubicación..."
      : locationPermission === "denied"
        ? "Abrir permisos de ubicación"
        : locationPermission === "granted" && !locationReady
          ? "Abrir ajustes del GPS"
          : "Permitir ubicación";

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute top-0 left-0 ml-7 py-7 z-30">
        <Link to="/">
          <img className="w-20" src="/logo-centralgo.png" alt="Central Go" />
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black flex items-center justify-center z-50"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 rounded-2xl bg-white/95 shadow-xl border border-purple-100 px-3 py-2 backdrop-blur-md">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            socketReady ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          }`}>
            <i className={socketReady ? "ri-wifi-line" : "ri-wifi-off-line"}></i>
          </div>

          <div className="leading-tight">
            <p className="text-[9px] uppercase tracking-[0.14em] font-black text-gray-400">
              Estado operativo
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[11px] font-black ${
                socketReady ? "text-emerald-700" : "text-red-600"
              }`}>
                {socketReady ? "En línea" : "Reconectando"}
              </span>
              <span className="text-gray-300">•</span>
              <span className={`text-[11px] font-black ${
                locationReady ? "text-emerald-700" : "text-amber-700"
              }`}>
                {locationReady ? "GPS listo" : "GPS pendiente"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute w-screen h-[100%] top-0 z-20">
        <LiveTracking
          pickup={rideDetailsOpen && ride ? ride.pickup : ""}
          destination={rideDetailsOpen && ride ? ride.destination : ""}
          routeStops={rideDetailsOpen && ride ? getRouteStops(ride) : []}
          showPickupRadar={false}
          autoFetchNearbyDrivers={false}
        />
      </div>

      {availableRides.length > 0 && !rideDetailsOpen && (
        <div className="absolute top-[92px] left-0 right-0 bottom-[54%] z-40 px-3 pointer-events-none">
          <div className="flex items-center justify-between px-1 mb-2 pointer-events-auto">
            <div
              className="rounded-full px-4 py-2 shadow-lg text-white text-xs font-black"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              {availableRides.length} solicitudes disponibles
            </div>

            <button
              type="button"
              onClick={fetchAvailableRidesForCaptain}
              className="w-10 h-10 rounded-full bg-white shadow-lg border border-purple-100 flex items-center justify-center"
            >
              <i className="ri-refresh-line text-xl text-purple-700"></i>
            </button>
          </div>

          <div className="h-full overflow-y-auto space-y-2 pr-1 pb-6 pointer-events-auto overscroll-contain">
            {availableRides.map((item) => {
              const rideId = String(item?._id || "");
              const driverToPickupKm = getDriverToPickupKm(item);
              const pickupToDestinationKm = getPickupToDestinationKm(item);
              const fare = getRideFare(item);
              const stops = getRouteStops(item);

              return (
                <button
                  key={rideId}
                  type="button"
                  onClick={() => openRideDetails(item)}
                  className="w-full text-left rounded-[20px] bg-white/95 shadow-xl border border-purple-100 overflow-hidden active:scale-[0.99] transition"
                >
                  <div
                    className="h-1"
                    style={{
                      background: PURPLE_GRADIENT,
                    }}
                  />

                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 shrink-0 flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <i
                            className={`${
                              item?.senderType === "business"
                                ? "ri-building-2-fill"
                                : "ri-user-3-fill"
                            } text-purple-700 text-lg`}
                          ></i>
                        </div>

                        <div className="mt-1 flex items-center gap-0.5">
                          <i className="ri-star-fill text-yellow-500 text-[11px]"></i>
                          <span className="text-[10px] font-black text-gray-800">
                            {getUserRating(item).toFixed(1)}
                          </span>
                          <span className="text-[9px] font-bold text-gray-500">
                            {getUserRatingCount(item) > 0
                              ? `(${getUserRatingCount(item)})`
                              : "(Nuevo)"}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="rounded-full bg-purple-100 px-2 py-1 text-[9px] font-black text-purple-800">
                            {getSenderLabel(item)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-black ${
                              item?.serviceTiming === "scheduled"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {getTimingLabel(item)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black text-gray-700">
                            {getVehicleLabel(item)}
                          </span>
                        </div>

                        {item?.serviceTiming === "scheduled" && (
                          <p className="mb-2 text-[11px] font-black text-amber-700">
                            <i className="ri-calendar-event-line mr-1"></i>
                            {formatSchedule(item)}
                          </p>
                        )}

                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-purple-700">
                              {formatKm(driverToPickupKm)} de ti
                            </p>

                            <h4 className="text-base font-black text-gray-950 truncate">
                              {getUserName(item)}
                            </h4>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xl font-black text-purple-900 leading-6">
                              {formatCOP(fare)}
                            </p>
                            <p className="text-[10px] font-bold text-gray-500">
                              ruta {formatKm(pickupToDestinationKm)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 rounded-xl bg-purple-50 px-2.5 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-purple-700">
                            <i className="ri-box-3-fill mr-1"></i>
                            {getCargoSummary(item)}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-gray-500">
                            {getDeliveryCount(item)} entrega{getDeliveryCount(item) === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="mt-2 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <span className="mt-1 w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-700" />
                            </span>
                            <p className="text-xs font-bold text-gray-800 leading-4 line-clamp-1">
                              {formatShortAddress(item?.pickup)}
                            </p>
                          </div>

                          {stops.slice(0, 2).map((stop, index) => (
                            <div
                              key={`${rideId}-stop-${index}`}
                              className="flex items-start gap-1.5"
                            >
                              <span className="mt-1 w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-black text-violet-700">
                                  {index + 1}
                                </span>
                              </span>
                              <p className="text-xs font-bold text-gray-800 leading-4 line-clamp-1">
                                {formatShortAddress(stop)}
                              </p>
                            </div>
                          ))}

                          {stops.length > 2 && (
                            <p className="text-[10px] font-black text-purple-700 pl-6">
                              +{stops.length - 2} entrega(s) más
                            </p>
                          )}

                          <div className="flex items-start gap-1.5">
                            <span className="mt-1 w-4 h-4 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-700" />
                            </span>
                            <p className="text-xs font-bold text-gray-800 leading-4 line-clamp-1">
                              {formatShortAddress(item?.destination)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-black text-purple-700">
                            {getDeliveryCount(item)} entrega{getDeliveryCount(item) === 1 ? "" : "s"}
                          </span>

                          <i className="ri-arrow-right-s-line text-2xl text-purple-700"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {shouldShowGpsPrompt && (
        <div className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-md rounded-[34px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] overflow-hidden border border-white/60">
            <div
              className="px-6 pt-6 pb-6 text-white relative overflow-hidden"
              style={{ background: PURPLE_DEEP_GRADIENT }}
            >
              <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute -bottom-20 -left-14 w-52 h-52 rounded-full bg-fuchsia-300/20 blur-3xl" />

              <div className="relative z-10 flex items-start gap-4">
                <div className="w-16 h-16 rounded-[22px] bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-lg">
                  <i className="ri-navigation-fill text-3xl text-white"></i>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                      Ubicación requerida
                    </span>
                  </div>

                  <h2 className="text-2xl font-black leading-tight mt-3">
                    Mantente visible para recibir viajes
                  </h2>

                  <p className="text-sm text-white/80 mt-2 leading-5">
                    Central Go necesita tu ubicación para mostrarte servicios cercanos, calcular distancias y seguir tu ruta correctamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-2xl border p-3 ${
                  locationPermission === "granted"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    locationPermission === "granted"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    <i className={locationPermission === "granted" ? "ri-check-line" : "ri-lock-unlock-line"}></i>
                  </div>
                  <p className="mt-2 text-[10px] uppercase font-black text-gray-400">Permiso</p>
                  <p className="text-xs font-black text-gray-900 mt-0.5">
                    {locationPermission === "granted" ? "Concedido" : "Pendiente"}
                  </p>
                </div>

                <div className={`rounded-2xl border p-3 ${
                  locationReady
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    locationReady
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    <i className={locationReady ? "ri-check-line" : "ri-map-pin-line"}></i>
                  </div>
                  <p className="mt-2 text-[10px] uppercase font-black text-gray-400">GPS</p>
                  <p className="text-xs font-black text-gray-900 mt-0.5">
                    {locationReady ? "Activo" : "Pendiente"}
                  </p>
                </div>

                <div className={`rounded-2xl border p-3 ${
                  socketReady
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-200 bg-gray-50"
                }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    socketReady
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    <i className={socketReady ? "ri-wifi-line" : "ri-wifi-off-line"}></i>
                  </div>
                  <p className="mt-2 text-[10px] uppercase font-black text-gray-400">Central Go</p>
                  <p className="text-xs font-black text-gray-900 mt-0.5">
                    {socketReady ? "En línea" : "Conectando"}
                  </p>
                </div>
              </div>

              {!!locationError && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <i className="ri-information-line text-xl text-amber-700"></i>
                  </div>

                  <div>
                    <p className="text-sm font-black text-amber-950">
                      Falta un paso
                    </p>
                    <p className="text-xs text-amber-800 mt-1 leading-5">
                      {locationError}
                    </p>
                  </div>
                </div>
              )}

              {locationPermission === "denied" && (
                <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 leading-5">
                  El permiso está bloqueado. Abre los ajustes de Central Go, permite la ubicación y vuelve a la app. La conexión se comprobará automáticamente.
                </div>
              )}

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleEnableGps}
                  disabled={requestingLocation || openingLocationSettings || !geoSupported}
                  className="w-full rounded-2xl text-white font-black py-4 px-4 disabled:opacity-60 shadow-lg shadow-purple-900/20 active:scale-[0.99] transition flex items-center justify-center gap-2"
                  style={{ background: PURPLE_GRADIENT }}
                >
                  <i className={
                    locationPermission === "denied" ||
                    (locationPermission === "granted" && !locationReady)
                      ? "ri-settings-3-line text-xl"
                      : "ri-map-pin-user-line text-xl"
                  }></i>
                  {gpsPrimaryActionLabel}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGpsPromptDismissed(false);
                    requestAndEmitCurrentLocation("retry-location");
                  }}
                  disabled={requestingLocation || openingLocationSettings || !geoSupported}
                  className="w-full rounded-2xl border border-purple-100 bg-purple-50 text-purple-800 font-black py-3.5 px-4 disabled:opacity-60 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  <i className="ri-refresh-line text-lg"></i>
                  Comprobar ubicación
                </button>

                <button
                  type="button"
                  onClick={handleDismissGpsPrompt}
                  className="w-full rounded-2xl border border-gray-200 bg-white text-gray-600 font-bold py-3.5 px-4 active:scale-[0.99] transition"
                >
                  Continuar por ahora
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                <div className="flex items-start gap-2">
                  <i className="ri-shield-check-line text-lg text-purple-700 mt-0.5"></i>
                  <p className="text-[11px] text-gray-500 leading-5">
                    Si abres los ajustes y activas el GPS, al regresar a Central Go la app intentará reconectarse automáticamente. No tendrás que pulsar “reintentar” cada vez.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOME MÓVIL DEL CONDUCTOR - diseño compacto con protagonismo del mapa */}
      <div className="absolute left-0 right-0 bottom-0 z-30 pointer-events-none">
        <div className="pointer-events-auto rounded-t-[30px] bg-white shadow-[0_-14px_45px_rgba(38,18,73,0.18)] border-t border-purple-100 max-h-[52vh] overflow-y-auto overscroll-contain pb-[92px] scroll-smooth">
          <div className="bg-white rounded-t-[30px]">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-11 h-1.5 rounded-full bg-purple-200"></div>
            </div>

            {/* Perfil + estado, como en la referencia */}
            <div className="px-4 pt-1.5 pb-2 flex items-center gap-2.5">
              <div className="relative w-12 h-12 rounded-full bg-[linear-gradient(135deg,#ede9fe,#f5d0fe)] border-2 border-purple-500 flex items-center justify-center shrink-0 shadow-sm">
                <i className="ri-user-3-fill text-2xl text-purple-700"></i>
                <span className={`absolute -right-0.5 bottom-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  socketReady && locationReady ? "bg-emerald-500" : "bg-amber-500"
                }`}></span>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] leading-5 font-black text-[#17103f] truncate">
                  Hola {captain?.fullname?.firstname || captain?.name || "Conductor"} <span aria-hidden="true">👋</span>
                </h2>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5">
                  Transportador Central Go
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (gpsBlocked) {
                    setGpsPromptDismissed(false);
                    setShowGpsPrompt(true);
                  } else {
                    requestAndEmitCurrentLocation("status-refresh");
                  }
                }}
                className={`h-9 px-2.5 rounded-full flex items-center gap-2 font-black text-[11px] shrink-0 ${
                  gpsBlocked
                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${gpsBlocked ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                {gpsBlocked ? "Revisar GPS" : "En línea"}
              </button>
            </div>

            {/* Métricas compactas */}
            <div className="px-4 pb-2 grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={fetchAvailableRidesForCaptain}
                className="rounded-[16px] bg-[#faf8ff] border border-purple-50 py-2 px-1 text-center"
              >
                <div className="w-6 h-6 mx-auto rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <i className="ri-box-3-fill text-sm"></i>
                </div>
                <p className="text-[12px] font-black text-[#17103f] mt-0.5">{availableRides.length}</p>
                <p className="text-[7px] font-bold text-gray-400">Solicitudes</p>
              </button>

              <Link
                to="/captain-wallet"
                className="rounded-[16px] bg-[#faf8ff] border border-purple-50 py-2 px-1 text-center"
              >
                <div className="w-6 h-6 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <i className="ri-wallet-3-fill text-sm"></i>
                </div>
                <p className="text-[10px] leading-4 font-black text-[#17103f] mt-0.5 truncate px-0.5">
                  {walletLoading ? "..." : formatCOP(walletData?.wallet?.balance || 0)}
                </p>
                <p className="text-[7px] font-bold text-gray-400">Saldo</p>
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (gpsBlocked) {
                    setGpsPromptDismissed(false);
                    setShowGpsPrompt(true);
                  } else {
                    requestAndEmitCurrentLocation("quick-gps-check");
                  }
                }}
                className="rounded-[16px] bg-[#faf8ff] border border-purple-50 py-2 px-1 text-center"
              >
                <div className="w-6 h-6 mx-auto rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                  <i className="ri-navigation-fill text-sm"></i>
                </div>
                <p className="text-[10px] font-black text-[#17103f] mt-0.5">
                  {locationReady ? "Activo" : "Revisar"}
                </p>
                <p className="text-[7px] font-bold text-gray-400">GPS</p>
              </button>

              <div className="rounded-[16px] bg-[#faf8ff] border border-purple-50 py-2 px-1 text-center">
                <div className="w-6 h-6 mx-auto rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
                  <i className="ri-star-fill text-sm"></i>
                </div>
                <p className="text-[12px] font-black text-[#17103f] mt-0.5">5.0</p>
                <p className="text-[7px] font-bold text-gray-400">Calificación</p>
              </div>
            </div>
          </div>

          <div className="px-4 pt-1 space-y-3">
            {/* Hero / oportunidad */}
            <button
              type="button"
              onClick={goToLoadMarketplace}
              className="w-full relative overflow-hidden rounded-[22px] bg-[linear-gradient(120deg,#31106f_0%,#6d28d9_52%,#a21caf_100%)] p-4 text-left text-white shadow-[0_12px_28px_rgba(109,40,217,0.24)]"
            >
              <div className="absolute -right-7 -bottom-8 text-[86px] text-white/10">
                <i className="ri-truck-fill"></i>
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <div className="max-w-[62%]">
                  <h3 className="text-[17px] leading-5 font-black">
                    Tu próxima oportunidad puede estar más cerca
                  </h3>
                  <p className="text-[10px] leading-4 text-white/70 mt-1">
                    Explora cargas y encuentra nuevas oportunidades.
                  </p>
                </div>
                <span className="rounded-full bg-white text-purple-800 px-3 py-2 text-[10px] font-black whitespace-nowrap">
                  Explorar cargas
                  <i className="ri-arrow-right-s-line ml-1"></i>
                </span>
              </div>
            </button>

            {/* Solicitudes disponibles */}
            
            {isScheduledReservedRide(ride) && (
              <section className="mt-3">
                <div className="rounded-[22px] border border-purple-200 bg-purple-50 px-3.5 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-800 text-white flex items-center justify-center shrink-0">
                      <i className="ri-calendar-check-fill text-xl"></i>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase font-black tracking-wide text-purple-600">
                        Domicilio programado reservado
                      </p>
                      <p className="text-sm font-black text-purple-950 truncate">
                        {ride?.pickup || "Recogida programada"}
                      </p>
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        Puedes seguir operando. Solo se activa cuando pulses “Iniciar domicilio”.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/captain-riding", {
                        state: { ride },
                      })
                    }
                    className="mt-3 w-full rounded-2xl bg-purple-800 text-white py-3 text-xs font-black flex items-center justify-center gap-2"
                  >
                    <i className="ri-eye-line text-base"></i>
                    Ver servicio reservado
                  </button>
                </div>
              </section>
            )}

<section className="rounded-[22px] bg-white border border-purple-50 shadow-[0_7px_22px_rgba(76,29,149,0.08)] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-black text-[#17103f]">
                  Solicitudes disponibles
                </h3>
                <button
                  type="button"
                  onClick={fetchAvailableRidesForCaptain}
                  className="text-[10px] font-black text-purple-700"
                >
                  Actualizar
                </button>
              </div>

              {availableRides.length === 0 ? (
                <div className="rounded-[17px] bg-[#faf8ff] border border-purple-50 px-3 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <i className="ri-radar-line text-lg"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-[#17103f]">
                      Buscando servicios cerca de ti
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      Mantén tu GPS activo para recibir solicitudes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableRides.slice(0, 2).map((item) => (
                    <button
                      key={String(item?._id || "")}
                      type="button"
                      onClick={() => openRideDetails(item)}
                      className="w-full rounded-[17px] bg-[#faf8ff] border border-purple-50 p-3 text-left active:scale-[0.99] transition"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <i className={item?.senderType === "business" ? "ri-building-2-fill" : "ri-box-3-fill"}></i>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-purple-700">
                                {item?.serviceTiming === "scheduled" ? formatSchedule(item) : "Disponible ahora"}
                              </p>
                              <h4 className="text-[12px] leading-4 font-black text-[#17103f] truncate">
                                {getUserName(item)}
                              </h4>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[16px] leading-5 font-black text-purple-700">
                                {formatCOP(getRideFare(item))}
                              </p>
                              <p className="text-[7px] font-bold text-gray-400">
                                {formatKm(getPickupToDestinationKm(item))}
                              </p>
                            </div>
                          </div>

                          <p className="text-[9px] text-gray-500 mt-1 truncate">
                            <i className="ri-map-pin-2-fill text-purple-500 mr-1"></i>
                            {formatShortAddress(item?.pickup)}
                          </p>
                          <p className="text-[9px] text-gray-500 mt-0.5 truncate">
                            <i className="ri-flag-fill text-fuchsia-500 mr-1"></i>
                            {formatShortAddress(item?.destination)}
                          </p>

                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[8px] font-black uppercase">
                              {getCargoSummary(item)}
                            </span>
                            <span className="rounded-full bg-white text-gray-500 border border-gray-100 px-2 py-0.5 text-[8px] font-black">
                              {getDeliveryCount(item)} entrega{getDeliveryCount(item) === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>

                        <i className="ri-arrow-right-s-line text-xl text-purple-700 self-center"></i>
                      </div>
                    </button>
                  ))}

                  {availableRides.length > 2 && (
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="w-full text-center text-[10px] font-black text-purple-700 py-1"
                    >
                      + {availableRides.length - 2} solicitudes más en el mapa
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Acciones rápidas */}
            <section className="rounded-[22px] bg-white border border-purple-50 shadow-[0_7px_22px_rgba(76,29,149,0.08)] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-black text-[#17103f]">Acciones rápidas</h3>
                <button
                  type="button"
                  onClick={goToLoadMarketplace}
                  className="text-[10px] font-black text-purple-700"
                >
                  Ver más
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={goToGoodsOffer}
                  className="rounded-[17px] bg-purple-50 px-1.5 py-3 text-center"
                >
                  <div className="w-8 h-8 mx-auto rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <i className="ri-box-3-fill text-lg"></i>
                  </div>
                  <p className="text-[9px] leading-3 font-black text-[#24104d] mt-2">
                    Publicar<br />mercancía
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToLoadMarketplace}
                  className="rounded-[17px] bg-blue-50 px-1.5 py-3 text-center"
                >
                  <div className="w-8 h-8 mx-auto rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <i className="ri-truck-fill text-lg"></i>
                  </div>
                  <p className="text-[9px] leading-3 font-black text-[#132c64] mt-2">
                    Buscar<br />cargas
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToSeatOffer}
                  className="rounded-[17px] bg-emerald-50 px-1.5 py-3 text-center"
                >
                  <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <i className="ri-user-3-fill text-lg"></i>
                  </div>
                  <p className="text-[9px] leading-3 font-black text-[#075c45] mt-2">
                    Publicar<br />cupos
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToReceivedBids}
                  className="rounded-[17px] bg-orange-50 px-1.5 py-3 text-center"
                >
                  <div className="w-8 h-8 mx-auto rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <i className="ri-mail-open-fill text-lg"></i>
                  </div>
                  <p className="text-[9px] leading-3 font-black text-[#7c2d12] mt-2">
                    Ofertas<br />recibidas
                  </p>
                </button>
              </div>
            </section>
</div>
        </div>

        {/* Navegación inferior fija, pensada para app móvil */}
        <nav className="pointer-events-auto absolute left-0 right-0 bottom-0 h-[74px] bg-white/95 backdrop-blur-xl border-t border-purple-100 shadow-[0_-8px_28px_rgba(30,12,70,0.08)] px-3 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="h-full grid grid-cols-5 items-center">
            <button type="button" className="flex flex-col items-center justify-center text-purple-700">
              <i className="ri-home-5-fill text-[21px]"></i>
              <span className="text-[8px] font-black mt-0.5">Inicio</span>
            </button>

            <button
              type="button"
              onClick={goToLoadMarketplace}
              className="flex flex-col items-center justify-center text-gray-400"
            >
              <i className="ri-briefcase-4-line text-[21px]"></i>
              <span className="text-[8px] font-bold mt-0.5">Oportunidades</span>
            </button>

            <button
              type="button"
              onClick={goToGoodsOffer}
              className="relative -top-4 flex flex-col items-center justify-center"
            >
              <span className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#6d28d9,#a21caf)] text-white shadow-[0_8px_22px_rgba(109,40,217,0.35)] border-4 border-white flex items-center justify-center">
                <i className="ri-add-line text-3xl"></i>
              </span>
              <span className="text-[8px] font-black text-purple-700 -mt-0.5">Publicar</span>
            </button>

            <button
              type="button"
              onClick={goToReceivedBids}
              className="flex flex-col items-center justify-center text-gray-400"
            >
              <i className="ri-route-line text-[21px]"></i>
              <span className="text-[8px] font-bold mt-0.5">Ofertas</span>
            </button>

            <button
              type="button"
              onClick={() => setProfilePanelOpen(true)}
              className="flex flex-col items-center justify-center text-gray-400"
            >
              <i className="ri-user-3-line text-[21px]"></i>
              <span className="text-[8px] font-bold mt-0.5">Mi cuenta</span>
            </button>
          </div>
        </nav>
      </div>

      {profilePanelOpen && (
        <div className="fixed inset-0 z-[85] bg-slate-950/45 backdrop-blur-[2px] flex items-end">
          <div className="w-full max-h-[88vh] overflow-y-auto rounded-t-[30px] bg-[#f8f7fc] shadow-[0_-18px_60px_rgba(15,23,42,0.28)] pb-6">
            <div className="sticky top-0 z-20 bg-[#f8f7fc]/95 backdrop-blur-xl rounded-t-[30px] border-b border-purple-100">
              <div className="flex justify-center pt-2">
                <div className="w-12 h-1.5 rounded-full bg-purple-200"></div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] font-black text-purple-600">
                    Mi cuenta
                  </p>
                  <h2 className="text-xl font-black text-[#17103f]">
                    Perfil y rendimiento
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setProfilePanelOpen(false)}
                  className="w-10 h-10 rounded-full bg-white border border-purple-100 flex items-center justify-center text-gray-700 shadow-sm"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>

            <div className="pt-3">
              <CaptainDetails />

              <div className="px-4 mt-3">
                <Link
                  to="/captain-wallet"
                  className="w-full rounded-[22px] bg-[linear-gradient(135deg,#111827,#3b0764)] text-white p-4 flex items-center gap-3 shadow-lg"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <i className="ri-wallet-3-fill text-xl"></i>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.14em] font-black text-white/45">
                      Billetera
                    </p>
                    <p className="text-lg font-black mt-0.5">
                      {walletLoading ? "Cargando..." : formatCOP(walletData?.wallet?.balance || 0)}
                    </p>
                  </div>

                  <i className="ri-arrow-right-s-line text-2xl text-white/50"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={rideDetailsRef}
        className="fixed z-[80] left-0 right-0 bottom-0 translate-y-[110%] rounded-t-[28px] overflow-hidden shadow-2xl"
        style={{
          background: DARK_GLASS,
        }}
      >
        {ride && (
          <div className="max-h-[82vh] overflow-y-auto pb-5">
            <div className="flex justify-center py-3">
              <div className="w-16 h-1.5 rounded-full bg-white/30"></div>
            </div>

            <div className="px-5 pb-2 flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-black uppercase">
                  {getSenderLabel(ride)} · {getTimingLabel(ride)}
                </p>
                <h2 className="text-white text-xl font-black">
                  {formatCOP(getRideFare(ride))}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeRideDetails}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              >
                <i className="ri-close-line text-white text-2xl"></i>
              </button>
            </div>

            <div className="mx-5 mt-3 rounded-[24px] bg-white/10 border border-white/10 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <i
                    className={`${
                      ride?.senderType === "business"
                        ? "ri-building-2-fill"
                        : "ri-user-3-fill"
                    } text-white text-xl`}
                  ></i>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-white text-lg font-black truncate">
                    {getUserName(ride)}
                  </h3>

                  <div className="flex items-center gap-2 mt-1">
                    <i className="ri-star-fill text-yellow-400"></i>
                    <span className="text-white text-sm font-black">5.0</span>
                    <span className="text-white/60 text-sm">Central Go</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-white/60 text-xs font-black">
                    A recoger
                  </p>
                  <p className="text-white text-base font-black">
                    {formatKm(getDriverToPickupKm(ride))}
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-5 mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/50">
                  Cuándo
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  {formatSchedule(ride)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/50">
                  Mercancía
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  {getCargoSummary(ride)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/50">
                  Vehículo
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  {getVehicleLabel(ride)}
                </p>
              </div>
            </div>

            <div className="mx-5 mt-3 rounded-[24px] bg-white p-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className="rounded-2xl border border-purple-100 p-3"
                  style={{ background: PURPLE_SOFT }}
                >
                  <p className="text-[10px] text-purple-700 font-black uppercase">
                    Tú al cliente
                  </p>
                  <p className="text-2xl font-black text-gray-950 mt-1">
                    {formatKm(getDriverToPickupKm(ride))}
                  </p>
                </div>

                <div
                  className="rounded-2xl border border-purple-100 p-3"
                  style={{ background: PURPLE_SOFT }}
                >
                  <p className="text-[10px] text-purple-700 font-black uppercase">
                    Recorrido
                  </p>
                  <p className="text-2xl font-black text-gray-950 mt-1">
                    {formatKm(getPickupToDestinationKm(ride))}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {getRouteStops(ride).length > 0
                      ? `${getDeliveryCount(ride)} entregas en la ruta`
                      : `${getDeliveryCount(ride)} entrega`}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                    <i className="ri-map-pin-range-fill text-purple-700"></i>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-gray-500">
                      Recogida
                    </p>
                    <p className="text-sm font-black text-gray-950 leading-5">
                      {formatShortAddress(ride?.pickup)}
                    </p>
                  </div>
                </div>

                {getRouteStops(ride).map((stop, index) => (
                  <div
                    key={`${stop}-${index}`}
                    className="flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-violet-700">
                        {index + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-gray-500">
                        Entrega {index + 1}
                      </p>
                      <p className="text-sm font-black text-gray-950 leading-5">
                        {formatShortAddress(stop)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-fuchsia-100 flex items-center justify-center shrink-0">
                    <i className="ri-flag-fill text-fuchsia-700"></i>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-gray-500">
                      Entrega {getRouteStops(ride).length + 1} · Última
                    </p>
                    <p className="text-sm font-black text-gray-950 leading-5">
                      {formatShortAddress(ride?.destination)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 mt-4">
              <button
                type="button"
                disabled={processing && processingRideId === String(ride?._id)}
                onClick={() => confirmRide(ride)}
                className="w-full rounded-2xl py-4 text-white text-base font-black disabled:opacity-60"
                style={{
                  background: PURPLE_GRADIENT,
                }}
              >
                {processing && processingRideId === String(ride?._id)
                  ? "Enviando..."
                  : `Aceptar por ${formatCOP(getRideFare(ride))}`}
              </button>
            </div>

            <div className="px-5 mt-4">
              <p className="text-white/70 text-sm font-bold text-center mb-3">
                Ofrece tu tarifa
              </p>

              <div className="grid grid-cols-3 gap-2">
                {getQuickOfferValues(ride).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={processing}
                    onClick={() => sendQuickOffer(value)}
                    className="rounded-2xl py-3 bg-white/10 border border-white/10 text-white text-sm font-black disabled:opacity-60"
                  >
                    {formatCOPShort(value)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={openCustomCounterOffer}
                disabled={processing}
                className="w-full mt-3 rounded-2xl py-3 bg-white text-purple-800 text-sm font-black disabled:opacity-60"
              >
                Personalizar oferta
              </button>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => ignoreRide(ride)}
                  className="rounded-2xl py-3 bg-white/10 border border-white/10 text-white text-sm font-black disabled:opacity-60"
                >
                  Ocultar
                </button>

                <button
                  type="button"
                  onClick={closeRideDetails}
                  className="rounded-2xl py-3 bg-white/10 border border-white/10 text-white text-sm font-black"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        ref={ridePopupRef}
        className="fixed z-[90] bottom-0 w-screen translate-y-full rounded-t-[24px] bg-white overflow-scroll shadow-2xl"
      >
        <RidePopup
          setRidePopup={setRidePopup}
          ride={ride}
          confirmRide={() => confirmRide(ride)}
          onIgnoreRide={() => ignoreRide(ride)}
          onCounterOffer={handleCounterOffer}
          isSubmitting={processing}
        />
      </div>
    </div>
  );
};

export default CaptainHome;