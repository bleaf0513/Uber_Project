import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
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

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";
const DARK_GLASS = "rgba(17, 24, 39, 0.94)";

const CaptainHome = () => {
  const ridePopupRef = useRef(null);
  const rideDetailsRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const lastLocationSentRef = useRef(0);
  const availableRidesIntervalRef = useRef(null);
  const ignoredRideIdsRef = useRef(new Set());
  const activeRideCheckRef = useRef(false);

  const navigate = useNavigate();

  const { captain } = useContext(CaptainDataContext);
  const { socket } = useContext(SocketContext);

  const [ridePopup, setRidePopup] = useState(false);
  const [rideDetailsOpen, setRideDetailsOpen] = useState(false);
  const [ride, setRide] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);

  const [socketReady, setSocketReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingRideId, setProcessingRideId] = useState(null);

  const [geoSupported, setGeoSupported] = useState(true);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [locationError, setLocationError] = useState("");
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("captainToken") || localStorage.getItem("token");

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

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const formatCOPShort = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

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

  const goToActiveRide = useCallback(
    (rideData) => {
      if (!rideData?._id) return;

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
    [navigate]
  );

  const fetchCaptainActiveRide = useCallback(
    async ({ redirect = false } = {}) => {
      try {
        const token = localStorage.getItem("token");

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
          if (redirect) {
            goToActiveRide(activeRide);
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
    [goToActiveRide]
  );

  const upsertAvailableRide = useCallback((rideData) => {
    if (!rideData?._id) return;

    const rideId = String(rideData._id);

    if (ignoredRideIdsRef.current.has(rideId)) return;

    setAvailableRides((prev) => {
      const exists = prev.some((item) => String(item._id) === rideId);

      if (exists) {
        return prev.map((item) =>
          String(item._id) === rideId ? { ...item, ...rideData } : item
        );
      }

      return [rideData, ...prev];
    });
  }, []);

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
      setLocationPermission("granted");

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
        (error) => {
          const message = getGeolocationErrorMessage(error);

          setRequestingLocation(false);
          setLocationReady(false);
          setLocationError(message);
          setShowGpsPrompt(true);

          if (error?.code === 1) {
            setLocationPermission("denied");
          } else if (forcePrompt) {
            setLocationPermission("prompt");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
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
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    locationIntervalRef.current = setInterval(() => {
      requestAndEmitCurrentLocation("interval-refresh");
    }, 10000);
  }, [
    captain?._id,
    socket,
    emitCaptainLocation,
    requestAndEmitCurrentLocation,
    stopLocationTracking,
  ]);

  const handleEnableGps = useCallback(() => {
    requestAndEmitCurrentLocation("manual-enable-gps", true);
  }, [requestAndEmitCurrentLocation]);

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

  const fetchAvailableRidesForCaptain = useCallback(async () => {
    try {
      if (!captain?._id) return;

      const token = localStorage.getItem("token");
      if (!token) return;

      const activeRide = await fetchCaptainActiveRide({ redirect: false });

      if (activeRide?._id) {
        goToActiveRide(activeRide);
        return;
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
        return !ignoredRideIdsRef.current.has(String(item._id));
      });

      setAvailableRides(filteredRides);
    } catch (error) {
      console.warn(
        "[captain-home] No se pudieron consultar viajes abiertos:",
        error?.response?.data?.message || error?.message
      );
    }
  }, [captain?._id, fetchCaptainActiveRide, goToActiveRide]);

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
        goToActiveRide(acceptedRide);
        return;
      }

      if (currentRideId && acceptedRideId === currentRideId) {
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

    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
    socket.off("new-ride", onNewRide);
    socket.off("ride-no-longer-available", onRideNoLongerAvailable);
    socket.off("ride-offer-rejected", onRideOfferRejected);
    socket.off("ride-offer-accepted", onRideOfferAccepted);
    socket.off("ride-updated", onRideUpdated);
    socket.off("ride-user-offer-updated", onRideUserOfferUpdated);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-ride", onNewRide);
    socket.on("ride-no-longer-available", onRideNoLongerAvailable);
    socket.on("ride-offer-rejected", onRideOfferRejected);
    socket.on("ride-offer-accepted", onRideOfferAccepted);
    socket.on("ride-updated", onRideUpdated);
    socket.on("ride-user-offer-updated", onRideUserOfferUpdated);

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
    }, 4000);

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
            Authorization: `Bearer ${localStorage.getItem("token")}`,
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
      ignoredRideIdsRef.current.add(String(rideToIgnore._id));
      removeAvailableRide(rideToIgnore._id);
    }

    setRidePopup(false);
    setRideDetailsOpen(false);
    setRide(null);
  };

  const goToGoodsOffer = () => {
    navigate("/captain/offers/goods");
  };

  const goToSpaceOffer = () => {
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

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute top-0 left-0 ml-7 py-7 z-30">
        <Link to="/">
          <img className="w-20" src="/logo-centralgo.png" alt="Central Go" />
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-50"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 rounded-full bg-white/95 shadow-lg border border-gray-200 px-4 py-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              socketReady ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs font-semibold text-gray-700">
            {socketReady ? "Conectado" : "Reconectando..."}
          </span>
          <span className="text-gray-300">|</span>
          <span
            className={`text-xs font-semibold ${
              locationReady ? "text-emerald-700" : "text-amber-600"
            }`}
          >
            {locationReady ? "Ubicación activa" : "GPS pendiente"}
          </span>
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
        <div className="absolute top-[92px] left-0 right-0 bottom-[43%] z-40 px-3 pointer-events-none">
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
                          <i className="ri-user-3-fill text-purple-700 text-lg"></i>
                        </div>

                        <div className="mt-1 flex items-center gap-0.5">
                          <i className="ri-star-fill text-yellow-500 text-[11px]"></i>
                          <span className="text-[10px] font-black text-gray-800">
                            5.0
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
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
                              viaje {formatKm(pickupToDestinationKm)}
                            </p>
                          </div>
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
                              +{stops.length - 2} parada(s) más
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
                            {stops.length > 0
                              ? `${stops.length} parada(s)`
                              : "Tocar para ver detalle"}
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

      {showGpsPrompt && (
        <div className="fixed inset-0 z-[90] bg-black/55 flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl p-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-map-pin-user-fill text-3xl text-emerald-700"></i>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Activa tu ubicación
            </h2>

            <p className="text-sm text-gray-600 text-center mt-3 leading-6">
              Para usar Central Go como conductor debes permitir el acceso al GPS
              y mantener la ubicación activa en tiempo real.
            </p>

            {!!locationError && (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                {locationError}
              </div>
            )}

            {!geoSupported && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Tu dispositivo o navegador no permite obtener la ubicación.
              </div>
            )}

            {locationPermission === "denied" && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                El permiso fue bloqueado. Debes habilitar la ubicación desde la
                configuración del navegador o del teléfono y luego volver a
                intentar.
              </div>
            )}

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={handleEnableGps}
                disabled={requestingLocation || !geoSupported}
                className="w-full rounded-2xl bg-emerald-600 text-white font-bold py-4 px-4 disabled:opacity-60"
              >
                {requestingLocation ? "Activando GPS..." : "Activar GPS ahora"}
              </button>

              <button
                type="button"
                onClick={() => requestAndEmitCurrentLocation("retry-location")}
                disabled={requestingLocation || !geoSupported}
                className="w-full rounded-2xl border border-gray-300 bg-white text-gray-800 font-semibold py-4 px-4 disabled:opacity-60"
              >
                Reintentar ubicación
              </button>
            </div>

            <p className="text-[12px] text-gray-500 text-center mt-4 leading-5">
              Sin ubicación activa el conductor no podrá ser monitoreado ni
              recibir correctamente servicios en tiempo real.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white absolute bottom-0 w-screen rounded-t-[24px] overflow-y-auto overflow-x-hidden z-30 shadow-2xl max-h-[42%]">
        <div className="pt-2">
          <div className="flex justify-center py-2">
            <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <div className="px-5 pb-2 flex items-center justify-between gap-3">
            <p
              className="inline-flex items-center rounded-full px-4 py-2 text-sm font-black text-white"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              Panel del transportador
            </p>

            <div className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 px-3 py-2 text-xs font-black">
              {availableRides.length} solicitudes
            </div>
          </div>

          {gpsBlocked && (
            <div className="px-4 pb-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <i className="ri-map-pin-line text-xl text-amber-700"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">
                    Ubicación requerida
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Debes activar el GPS para operar como conductor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEnableGps}
                  className="rounded-xl bg-amber-600 text-white text-xs font-bold px-3 py-2"
                >
                  Activar
                </button>
              </div>
            </div>
          )}

          <CaptainDetails />

          <div className="px-4 pb-5">
            <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4 mt-2">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Oportunidades en ruta
                  </h3>
                  <p className="text-sm text-gray-600">
                    Publica mercancía, espacio libre o cupos disponibles.
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <i className="ri-road-map-line text-2xl text-violet-700"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={goToGoodsOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center mb-2">
                    <i className="ri-shopping-basket-2-line text-xl text-orange-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar mercancía
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Vende productos que llevas en ruta.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToSpaceOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center mb-2">
                    <i className="ri-inbox-archive-line text-xl text-blue-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar espacio
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Ofrece capacidad libre para carga.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToSeatOffer}
                  className="rounded-2xl bg-white border border-gray-200 p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center mb-2">
                    <i className="ri-user-3-line text-xl text-emerald-600"></i>
                  </div>
                  <h4 className="text-base font-bold text-gray-900">
                    Publicar cupos
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Comparte puestos para pasajeros.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToReceivedBids}
                  className="rounded-2xl bg-black p-4 text-left shadow-sm"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center mb-2">
                    <i className="ri-mail-open-line text-xl text-white"></i>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Ofertas recibidas
                  </h4>
                  <p className="text-xs text-white/80 mt-1">
                    Revisa, acepta o contraoferta.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  Solicitud de viaje
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
                  <i className="ri-user-3-fill text-white text-xl"></i>
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
                      ? `Incluye ${getRouteStops(ride).length} parada(s)`
                      : "Origen a destino"}
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
                      Punto A - Recoger
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
                        Parada {index + 1}
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
                      Punto final - Destino
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