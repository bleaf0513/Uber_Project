import React, {
  useEffect,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useGSAP } from "@gsap/react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import "remixicon/fonts/remixicon.css";
import LocationSearchPanel from "../../components/LocationSearchPanel";
import VehiclePanel from "../../components/VehiclePanel";
import ConfirmedRide from "../../components/ConfirmedRide";
import FindingDriver from "../../components/FindingDriver";
import DriverSelected from "../../components/DriverSelected";
import axios from "axios";
import { SocketContext } from "../context/SocketContext";
import { UserDataContext } from "../context/UserContext";
import LiveTracking from "../../components/LiveTracking";
import { useGoogleMapsScript } from "../context/GoogleMapsLoadContext";
import { getApiBaseUrl } from "../apiBase";
import {
  requestPushPermissionAndRegister,
  listenForegroundPushNotifications,
} from "../services/pushNotifications";

const OFFER_TTL_MS = 60000;
const RECENT_PLACES_KEY = "centralgo_recent_places";
const CURRENT_LOCATION_KEY = "centralgo_current_location";

const CARGO_CATEGORIES = [
  { key: "market", label: "Mercado", icon: "ri-shopping-basket-2-fill" },
  { key: "boxes", label: "Cajas", icon: "ri-archive-2-fill" },
  { key: "packages", label: "Paquetes", icon: "ri-box-3-fill" },
  { key: "sacks", label: "Bultos", icon: "ri-stack-fill" },
  { key: "baskets", label: "Canastillas", icon: "ri-inbox-archive-fill" },
  { key: "general", label: "Mercancía general", icon: "ri-truck-fill" },
  { key: "other", label: "Otro", icon: "ri-add-circle-fill" },
];


function Home() {
  const submitHandler = (e) => {
    e.preventDefault();
  };

  const [pickup, setPickup] = useState(() => {
    try {
      const raw = localStorage.getItem(CURRENT_LOCATION_KEY);
      const saved = JSON.parse(raw || "null");

      if (saved?.address) {
        return saved.address;
      }

      if (saved?.lat && saved?.lng) {
        return `${Number(saved.lat).toFixed(6)}, ${Number(saved.lng).toFixed(6)}`;
      }

      return "";
    } catch {
      return "";
    }
  });

  const [destination, setDestination] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [stopsPanelOpen, setStopsPanelOpen] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [shipmentPanelOpen, setShipmentPanelOpen] = useState(false);
  const [vehiclePanel, setVehiclePanel] = useState(false);

  const [senderType, setSenderType] = useState("personal");
  const [cargoCategory, setCargoCategory] = useState("market");
  const [cargoQuantity, setCargoQuantity] = useState(1);
  const [approximateWeight, setApproximateWeight] = useState("");
  const [weightUnknown, setWeightUnknown] = useState(false);

  // Central GO - servicio inmediato o programado.
  const [serviceTiming, setServiceTiming] = useState("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [confirmRidePanel, setConfirmRidePanel] = useState(false);
  const [vehicleFound, setVehicleFound] = useState(false);
  const [driverSelected, setDriverSelected] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);

  const [prices, setPrices] = useState(null);
  const [distance, setDistance] = useState(null);
  const [pricingError, setPricingError] = useState(null);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [offeredPrice, setOfferedPrice] = useState(null);
  const [ride, setRide] = useState(null);
  // Chat del domicilio: el usuario puede abrir la misma conversación
  // que ya usa el conductor en CaptainRiding.
  const [rideChatOpen, setRideChatOpen] = useState(false);
  const [rideChatUnread, setRideChatUnread] = useState(0);
  const [rideChatMessages, setRideChatMessages] = useState([]);
  const [rideChatText, setRideChatText] = useState("");
  const [rideChatSending, setRideChatSending] = useState(false);
  const rideChatEndRef = useRef(null);

  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [offerNow, setOfferNow] = useState(Date.now());
  const [captainArrived, setCaptainArrived] = useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const [scheduledPublishedOpen, setScheduledPublishedOpen] = useState(false);
  const [creatingAdditionalRide, setCreatingAdditionalRide] = useState(false);
  const [cancellingScheduledRide, setCancellingScheduledRide] = useState(false);

  const [etaInfo, setEtaInfo] = useState({
    etaText: "",
    distanceText: "",
  });

  const [gpsStatus, setGpsStatus] = useState("idle");
  const [gpsError, setGpsError] = useState("");
  const [userCoords, setUserCoords] = useState(() => {
    try {
      const raw = localStorage.getItem(CURRENT_LOCATION_KEY);
      const saved = JSON.parse(raw || "null");

      if (saved?.lat && saved?.lng) {
        return {
          lat: Number(saved.lat),
          lng: Number(saved.lng),
        };
      }

      return null;
    } catch {
      return null;
    }
  });
  const [pickupDetected, setPickupDetected] = useState(false);
  const [hideGpsBanner, setHideGpsBanner] = useState(() => {
    try {
      return localStorage.getItem("centralgo_hide_gps_banner") === "1";
    } catch {
      return false;
    }
  });

  /*
   * HOTFIX ANTI-GEOCODING:
   * Estos estados guardan coordenadas reales cuando vienen de GPS o Places.
   * El usuario ve texto bonito, pero para APIs mandamos lat,lng.
   */
  const [pickupCoords, setPickupCoords] = useState(() => {
    try {
      const raw = localStorage.getItem(CURRENT_LOCATION_KEY);
      const saved = JSON.parse(raw || "null");

      if (saved?.lat && saved?.lng) {
        return {
          lat: Number(saved.lat),
          lng: Number(saved.lng),
        };
      }

      return null;
    } catch {
      return null;
    }
  });
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeStopCoords, setRouteStopCoords] = useState([]);

  const [recentPlaces, setRecentPlaces] = useState(() => {
    try {
      const raw = localStorage.getItem(RECENT_PLACES_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const vehicleRef = useRef(null);
  const vehicleFoundRef = useRef(null);
  const driverSelectedRef = useRef(null);
  const confirmRidePanelRef = useRef(null);
  const suggestionTimerRef = useRef(null);
  const suggestionSeqRef = useRef(0);
  const watchLocationRef = useRef(null);

  const restoringRideRef = useRef(false);
  const activeRideRestoredRef = useRef(false);

  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !user?._id) return;

    let unsubscribeForeground = null;
    let cancelled = false;

    const setupUserPushNotifications = async () => {
      try {
        const result = await requestPushPermissionAndRegister("user");

        if (!cancelled) {
          console.log("[push-user] Resultado registro:", result);
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

            console.log("[push-user] Notificación en primer plano:", {
              title,
              body,
              data,
            });

            if (document.visibilityState === "visible") {
              try {
                const audio = new Audio(
                  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
                );
                audio.volume = 0.25;
                audio.play().catch(() => {});
              } catch {
                // No bloqueamos si el navegador no permite audio.
              }
            }
          }
        );
      } catch (error) {
        console.warn("[push-user] No se pudo activar push:", error);
      }
    };

    setupUserPushNotifications();

    return () => {
      cancelled = true;

      if (typeof unsubscribeForeground === "function") {
        unsubscribeForeground();
      }
    };
  }, [user?._id]);

  const normalizeSocketRide = useCallback((payload) => {
    return payload?.data?.ride || payload?.ride || payload?.data || payload || null;
  }, []);

  const cleanRouteStops = useMemo(() => {
    return (Array.isArray(routeStops) ? routeStops : [])
      .map((stop) => String(stop || "").trim())
      .filter(Boolean);
  }, [routeStops]);

  const routeStopsCount = cleanRouteStops.length;

  const saveRecentPlace = useCallback((placeText) => {
    const clean = String(placeText || "").trim();
    if (!clean) return;

    setRecentPlaces((prev) => {
      const next = [clean, ...(prev || []).filter((p) => p !== clean)].slice(0, 5);

      try {
        localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("No se pudo guardar historial reciente:", error);
      }

      return next;
    });
  }, []);

  const coordsToText = useCallback((coords) => {
    if (!coords) return "";

    const lat = Number(coords.lat);
    const lng = Number(coords.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, []);

  const getPlaceCoordinates = useCallback(
    async (suggestion) => {
      try {
        if (!suggestion || typeof suggestion === "string") return null;

        if (suggestion.lat && suggestion.lng) {
          return {
            lat: Number(suggestion.lat),
            lng: Number(suggestion.lng),
          };
        }

        if (suggestion.location?.lat && suggestion.location?.lng) {
          return {
            lat: Number(suggestion.location.lat),
            lng: Number(suggestion.location.lng),
          };
        }

        if (!suggestion.place_id || !mapsApiLoaded || !window.google?.maps) {
          return null;
        }

        const { Place } = await window.google.maps.importLibrary("places");

        const place = new Place({
          id: suggestion.place_id,
        });

        await place.fetchFields({
          fields: ["location", "formattedAddress", "displayName"],
        });

        const location = place.location;

        if (!location) return null;

        const lat =
          typeof location.lat === "function" ? location.lat() : location.lat;

        const lng =
          typeof location.lng === "function" ? location.lng() : location.lng;

        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
          return null;
        }

        return {
          lat: Number(lat),
          lng: Number(lng),
        };
      } catch (error) {
        console.warn("No se pudieron obtener coordenadas del place:", error);
        return null;
      }
    },
    [mapsApiLoaded]
  );

  const getPickupForApi = useCallback(() => {
    return coordsToText(pickupCoords) || pickup;
  }, [coordsToText, pickupCoords, pickup]);

  const getDestinationForApi = useCallback(() => {
    return coordsToText(destinationCoords) || destination;
  }, [coordsToText, destinationCoords, destination]);

  const getStopsForApi = useCallback(() => {
    return cleanRouteStops.map((stop, index) => {
      return coordsToText(routeStopCoords[index]) || stop;
    });
  }, [cleanRouteStops, coordsToText, routeStopCoords]);

  const reverseGeocodeCoords = useCallback(
    async (lat, lng) => {
      /*
       * HOTFIX ANTI-COBRO GOOGLE:
       *
       * Antes aquí se usaba:
       * new window.google.maps.Geocoder().geocode(...)
       *
       * Eso consume Geocoding API cada vez que el usuario activa GPS
       * o cuando la app intenta detectar automáticamente su dirección.
       *
       * Por ahora NO convertimos coordenadas a dirección con Google.
       * Dejamos lat/lng como texto temporal para evitar más cobros.
       */
      if (!lat || !lng) return "";

      return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    },
    []
  );

  const emitUserLocation = useCallback(
    (lat, lng) => {
      if (!socket || !user?._id || !lat || !lng) return;

      socket.emit("update-location-user", {
        userId: user._id,
        location: {
          ltd: Number(lat),
          lng: Number(lng),
        },
      });
    },
    [socket, user?._id]
  );

  const requestGpsLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      setGpsError("Este dispositivo no permite usar la ubicación.");
      return null;
    }

    setGpsStatus("loading");
    setGpsError("");

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const coords = { lat, lng };

          setUserCoords(coords);
          setPickupCoords(coords);
          emitUserLocation(lat, lng);

          const detectedAddress = await reverseGeocodeCoords(lat, lng);
          const locationText =
            detectedAddress || `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

          setPickup(locationText);
          setPickupDetected(true);
          setGpsStatus("granted");
          setHideGpsBanner(true);

          try {
            localStorage.setItem("centralgo_hide_gps_banner", "1");
            localStorage.setItem(
              CURRENT_LOCATION_KEY,
              JSON.stringify({
                lat,
                lng,
                address: locationText,
                updatedAt: Date.now(),
              })
            );
          } catch {
            // No bloqueamos si localStorage falla.
          }

          resolve({
            lat,
            lng,
            address: locationText,
          });
        },
        (error) => {
          console.warn("No se pudo activar el GPS:", error);

          let message =
            "No pudimos acceder a tu ubicación. Puedes escribir el punto de recogida manualmente.";

          if (error?.code === 1) {
            message =
              "Permiso de ubicación rechazado. Actívalo para detectar automáticamente tu punto de recogida.";
          } else if (error?.code === 2) {
            message =
              "No pudimos encontrar tu ubicación. Verifica que el GPS del dispositivo esté activo.";
          } else if (error?.code === 3) {
            message = "La ubicación tardó demasiado. Inténtalo de nuevo.";
          }

          setGpsStatus("denied");
          setGpsError(message);

          setTimeout(() => {
            setHideGpsBanner(true);

            try {
              localStorage.setItem("centralgo_hide_gps_banner", "1");
            } catch {
              // No bloqueamos si localStorage falla.
            }
          }, 3500);

          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    });
  }, [emitUserLocation, reverseGeocodeCoords]);

  useEffect(() => {
    if (pickupCoords || pickup) return;
    if (!navigator.permissions || !navigator.geolocation) return;

    let cancelled = false;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((permissionStatus) => {
        if (cancelled) return;

        if (permissionStatus.state === "granted") {
          requestGpsLocation();
        }
      })
      .catch(() => {
        // Algunos navegadores no soportan permissions.query para geolocalización.
      });

    return () => {
      cancelled = true;
    };
  }, [pickup, pickupCoords, requestGpsLocation]);

  const dismissGpsBanner = () => {
    setHideGpsBanner(true);

    try {
      localStorage.setItem("centralgo_hide_gps_banner", "1");
    } catch {
      // No bloqueamos si localStorage falla.
    }
  };

  const startGpsWatch = useCallback(() => {
    if (!user?._id || !navigator.geolocation || !socket) return;

    if (watchLocationRef.current) {
      navigator.geolocation.clearWatch(watchLocationRef.current);
      watchLocationRef.current = null;
    }

    watchLocationRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const coords = { lat, lng };
        setUserCoords(coords);
        setPickupCoords((prev) => prev || coords);
        emitUserLocation(lat, lng);

        try {
          const currentRaw = localStorage.getItem(CURRENT_LOCATION_KEY);
          const currentSaved = JSON.parse(currentRaw || "null") || {};
          localStorage.setItem(
            CURRENT_LOCATION_KEY,
            JSON.stringify({
              ...currentSaved,
              lat,
              lng,
              address:
                currentSaved.address ||
                `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
              updatedAt: Date.now(),
            })
          );
        } catch {
          // No bloqueamos si localStorage falla.
        }
      },
      (error) => {
        console.warn("No se pudo actualizar la ubicación del usuario:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );
  }, [emitUserLocation, socket, user?._id]);

  useEffect(() => {
    return () => {
      if (watchLocationRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchLocationRef.current);
        watchLocationRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gpsStatus === "granted") {
      startGpsWatch();
    }
  }, [gpsStatus, startGpsWatch]);

  const syncRideState = useCallback(
    (rideData) => {
      if (!rideData?._id) return;

      setRide((prev) => ({
        ...(prev || {}),
        ...(rideData || {}),
        _id: rideData?._id || prev?._id,
        pickup: rideData?.pickup || prev?.pickup || pickup,
        destination: rideData?.destination || prev?.destination || destination,
        routeStops: rideData?.routeStops || prev?.routeStops || cleanRouteStops,
      }));

      if (rideData?.pickup) {
        setPickup(rideData.pickup);
      }

      if (rideData?.destination) {
        setDestination(rideData.destination);
      }

      if (Array.isArray(rideData?.routeStops)) {
        setRouteStops(rideData.routeStops);
      }

      const nextVehicle =
        rideData?.vehicleType ||
        rideData?.vehicle ||
        rideData?.selectedVehicle ||
        selectedVehicle ||
        null;

      if (nextVehicle) {
        setSelectedVehicle(nextVehicle);
      }

      const nextFare = Number(
        rideData?.offeredFare ||
          rideData?.fare ||
          rideData?.suggestedFare ||
          selectedPrice ||
          0
      );

      if (nextFare > 0) {
        setSelectedPrice(nextFare);
        setOfferedPrice(nextFare);
      }

      if (rideData?.status === "pending" || rideData?.status === "negotiating") {
        const isScheduled =
          rideData?.serviceTiming === "scheduled" ||
          (
            String(rideData?._id || "") === String(ride?._id || "") &&
            ride?.serviceTiming === "scheduled"
          );

        setVehicleFound(!isScheduled);
        setScheduledPublishedOpen(isScheduled);
        setCreatingAdditionalRide(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);
        setDriverSelected(false);
        setCaptainArrived(false);
      }

      if (rideData?.status === "accepted") {
        const isScheduled =
          rideData?.serviceTiming === "scheduled" ||
          Boolean(rideData?.schedule?.pickupStartAt);

        const dispatchStarted =
          Boolean(rideData?.scheduledDispatchStartedAt);

        setScheduledPublishedOpen(isScheduled && !dispatchStarted);
        setCreatingAdditionalRide(false);
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);
        setDriverSelected(!isScheduled || dispatchStarted);
        setCaptainArrived(false);
      }

      if (rideData?.status === "arrived" || rideData?.arrivedAtPickup) {
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);
        setDriverSelected(true);
        setCaptainArrived(true);
      }

      if (rideData?.status === "ongoing" || rideData?.status === "completed") {
        setScheduledPublishedOpen(false);
        setCreatingAdditionalRide(false);
        setCaptainArrived(false);
        setDriverSelected(false);
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);

        navigate("/riding", {
          state: {
            ride: rideData,
          },
        });
      }
    },
    [
      pickup,
      destination,
      cleanRouteStops,
      navigate,
      selectedPrice,
      selectedVehicle,
      ride?._id,
      ride?.serviceTiming,
    ]
  );

  const restoreActiveRideFromServer = useCallback(async () => {
    if (activeRideRestoredRef.current) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      activeRideRestoredRef.current = true;
      restoringRideRef.current = true;

      const response = await axios.get(`${getApiBaseUrl()}/rides/my-active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const activeRide = response?.data?.ride || null;

      if (!activeRide?._id) {
        restoringRideRef.current = false;
        return;
      }

      const restoredPickup = activeRide.pickup || "";
      const restoredDestination = activeRide.destination || "";
      const restoredStops = Array.isArray(activeRide.routeStops)
        ? activeRide.routeStops
        : [];

      const restoredVehicle =
        activeRide.vehicleType || activeRide.vehicle || selectedVehicle || "car";

      const restoredFare = Number(
        activeRide.offeredFare ||
          activeRide.fare ||
          activeRide.suggestedFare ||
          selectedPrice ||
          0
      );

      setRide(activeRide);
      setPickup(restoredPickup);
      setDestination(restoredDestination);
      setRouteStops(restoredStops);
      setSelectedVehicle(restoredVehicle);
      setSelectedPrice(restoredFare);
      setOfferedPrice(restoredFare);

      setPanelOpen(false);
      setStopsPanelOpen(false);
      setShipmentPanelOpen(false);
      setVehiclePanel(false);
      setConfirmRidePanel(false);
      setSuggestions([]);

      if (
        activeRide.status === "pending" ||
        activeRide.status === "negotiating"
      ) {
        const isScheduled =
          activeRide?.serviceTiming === "scheduled" ||
          Boolean(activeRide?.schedule?.pickupStartAt);

        setVehicleFound(!isScheduled);
        setScheduledPublishedOpen(isScheduled);
        setCreatingAdditionalRide(false);
        setDriverSelected(false);
        setCaptainArrived(false);
      } else if (
        activeRide.status === "accepted" ||
        activeRide.status === "arrived"
      ) {
        const isScheduled =
          activeRide?.serviceTiming === "scheduled" ||
          Boolean(activeRide?.schedule?.pickupStartAt);

        const dispatchStarted =
          Boolean(activeRide?.scheduledDispatchStartedAt);

        setVehicleFound(false);
        setScheduledPublishedOpen(
          isScheduled &&
          activeRide.status === "accepted" &&
          !dispatchStarted
        );
        setDriverSelected(
          activeRide.status === "arrived" ||
          !isScheduled ||
          dispatchStarted
        );
        setCaptainArrived(
          activeRide.status === "arrived" || Boolean(activeRide.arrivedAtPickup)
        );
      } else if (activeRide.status === "ongoing") {
        navigate("/riding", {
          state: {
            ride: activeRide,
          },
        });
      }

      setTimeout(() => {
        restoringRideRef.current = false;
      }, 600);
    } catch (error) {
      restoringRideRef.current = false;

      console.warn(
        "No se pudo restaurar la solicitud activa:",
        error?.response?.data?.message || error?.message
      );
    }
  }, [navigate, selectedPrice, selectedVehicle]);

  useEffect(() => {
    restoreActiveRideFromServer();
  }, [restoreActiveRideFromServer]);

  useEffect(() => {
    const timer = setInterval(() => {
      setOfferNow(Date.now());
    }, 500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket || !user?._id) return;

    const emitJoin = () => {
      try {
        socket.emit("join", {
          userType: "user",
          userId: user._id,
        });

        if (ride?._id) {
          socket.emit("join-ride", {
            rideId: ride._id,
          });
        }
      } catch (error) {
        console.error("Error enviando join del usuario:", error);
      }
    };

    const onConnect = () => {
      emitJoin();
    };

    const onReconnect = () => {
      emitJoin();
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on("connect", onConnect);
    socket.io?.on?.("reconnect", onReconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.io?.off?.("reconnect", onReconnect);
    };
  }, [socket, user?._id, ride?._id]);

  useEffect(() => {
    if (!socket) return;

    const onRideStarted = (payload) => {
      const nextRide = normalizeSocketRide(payload) || ride;

      if (!nextRide?._id) {
        alert("El viaje inició, pero no se pudo cargar la información completa.");
        return;
      }

      syncRideState(nextRide);

      navigate("/riding", {
        state: {
          ride: nextRide,
        },
      });
    };

    const onRideConfirmed = (payload) => {
      const rideData = normalizeSocketRide(payload);
      if (!rideData?._id) return;

      const isScheduled =
        rideData?.serviceTiming === "scheduled" ||
        Boolean(rideData?.schedule?.pickupStartAt);

      const dispatchStarted =
        Boolean(rideData?.scheduledDispatchStartedAt);

      setCaptainArrived(false);
      setVehicleFound(false);
      setConfirmRidePanel(false);
      setVehiclePanel(false);
      setPanelOpen(false);
      setStopsPanelOpen(false);
      setScheduledPublishedOpen(isScheduled && !dispatchStarted);
      setDriverSelected(!isScheduled || dispatchStarted);
      setRide(rideData);
    };

    const onRideOfferUpdated = (payload) => {
      const nextRide = normalizeSocketRide(payload);
      if (!nextRide?._id) return;

      setRide((prev) => ({
        ...(prev || {}),
        ...(nextRide || {}),
        _id: nextRide?._id || prev?._id,
        pickup: nextRide?.pickup || prev?.pickup || pickup,
        destination: nextRide?.destination || prev?.destination || destination,
        routeStops: nextRide?.routeStops || prev?.routeStops || cleanRouteStops,
      }));

      const nextFare = Number(
        nextRide?.offeredFare || nextRide?.fare || nextRide?.suggestedFare || 0
      );

      if (nextFare > 0) {
        setSelectedPrice(nextFare);
        setOfferedPrice(nextFare);
      }

      if (
        nextRide?.status === "pending" ||
        nextRide?.status === "negotiating"
      ) {
        const isScheduled =
          nextRide?.serviceTiming === "scheduled" ||
          (
            String(nextRide?._id || "") === String(ride?._id || "") &&
            ride?.serviceTiming === "scheduled"
          );

        setVehiclePanel(false);
        setConfirmRidePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);
        setDriverSelected(false);
        setVehicleFound(!isScheduled);
        setScheduledPublishedOpen(isScheduled);
        setCreatingAdditionalRide(false);
      }

      if (nextRide?.status === "accepted") {
        syncRideState(nextRide);
      }
    };

    const onScheduledDispatchStarted = (payload) => {
      const nextRide = normalizeSocketRide(payload);
      if (!nextRide?._id) return;

      setScheduledPublishedOpen(false);
      setRide(nextRide);
      setVehicleFound(false);
      setDriverSelected(true);
      setCaptainArrived(false);
    };

    const onRideUpdated = (payload) => {
      const nextRide = normalizeSocketRide(payload);
      if (!nextRide?._id) return;
      syncRideState(nextRide);
    };

    const onNearbyCaptains = (drivers) => {
      setNearbyDrivers(Array.isArray(drivers) ? drivers : []);
    };

    const onCaptainLocationUpdated = (payload) => {
      if (!payload?.captainId || !payload?.location) return;

      setNearbyDrivers((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];

        const idx = list.findIndex(
          (d) => String(d?._id || d?.captainId) === String(payload.captainId)
        );

        const updatedDriver = {
          ...(idx >= 0 ? list[idx] : {}),
          _id: idx >= 0 ? list[idx]._id : payload.captainId,
          captainId: payload.captainId,
          location: {
            ltd: Number(payload.location.ltd),
            lng: Number(payload.location.lng),
          },
          vehicleType:
            payload.vehicleType || (idx >= 0 ? list[idx]?.vehicleType : null),
          profileImage:
            payload.profileImage || (idx >= 0 ? list[idx]?.profileImage : ""),
          vehicle: payload.vehicle || (idx >= 0 ? list[idx]?.vehicle : null),
          fullname: payload.fullname || (idx >= 0 ? list[idx]?.fullname : null),
        };

        if (idx >= 0) {
          list[idx] = updatedDriver;
          return list;
        }

        return [...list, updatedDriver];
      });
    };

    const onCaptainArrived = (payload) => {
      setCaptainArrived(true);

      const nextRide = normalizeSocketRide(payload);

      if (nextRide?._id) {
        setRide(nextRide);
      }

      alert(payload?.message || "Tu conductor ya llegó al punto de recogida.");
    };

    const onRideChatMessage = (payload) => {
      const raw = payload?.data || payload || {};

      const messageRideId =
        raw?.rideId ||
        raw?.ride?._id ||
        payload?.rideId ||
        payload?.ride?._id;

      if (
        ride?._id &&
        messageRideId &&
        String(messageRideId) !== String(ride._id)
      ) {
        return;
      }

      const text =
        raw?.message ||
        raw?.text ||
        payload?.message ||
        payload?.text ||
        "";

      if (!text) return;

      const senderType =
        raw?.senderType ||
        raw?.from ||
        payload?.senderType ||
        payload?.from ||
        "captain";

      const nextMessage = {
        id:
          raw?._id ||
          payload?._id ||
          `${Date.now()}-${Math.random()}`,
        rideId: messageRideId || ride?._id,
        senderType,
        from: senderType,
        text,
        message: text,
        createdAt:
          raw?.createdAt ||
          payload?.createdAt ||
          new Date().toISOString(),
      };

      setRideChatMessages((prev) => {
        const exists = prev.some(
          (item) => String(item.id) === String(nextMessage.id)
        );

        if (exists) return prev;
        return [...prev, nextMessage];
      });

      if (
        !rideChatOpen &&
        senderType !== "user"
      ) {
        setRideChatUnread((prev) => prev + 1);
      }
    };

    const onRideCancelledByCaptain = (payload) => {
      setCaptainArrived(false);
      setRide(null);
      setDriverSelected(false);
      setVehicleFound(false);
      setPanelOpen(false);
      setStopsPanelOpen(false);

      const reasonText = payload?.reason ? `\nMotivo: ${payload.reason}` : "";

      alert(
        (payload?.message || "El conductor canceló la solicitud.") + reasonText
      );
    };

    socket.on("ride-started", onRideStarted);
    socket.on("ride-confirmed", onRideConfirmed);
    socket.on("ride-offer-updated", onRideOfferUpdated);
    socket.on("scheduled-dispatch-started", onScheduledDispatchStarted);
    socket.on("ride-updated", onRideUpdated);
    socket.on("nearby-captains", onNearbyCaptains);
    socket.on("captain-location-updated", onCaptainLocationUpdated);
    socket.on("captain-arrived", onCaptainArrived);
    socket.on("receive-message", onRideChatMessage);
    socket.on("ride-message", onRideChatMessage);
    socket.on("ride-chat-message", onRideChatMessage);
    socket.on("message-received", onRideChatMessage);
    socket.on("ride-cancelled-by-captain", onRideCancelledByCaptain);

    return () => {
      socket.off("ride-started", onRideStarted);
      socket.off("ride-confirmed", onRideConfirmed);
      socket.off("ride-offer-updated", onRideOfferUpdated);
      socket.off("scheduled-dispatch-started", onScheduledDispatchStarted);
      socket.off("ride-updated", onRideUpdated);
      socket.off("nearby-captains", onNearbyCaptains);
      socket.off("captain-location-updated", onCaptainLocationUpdated);
      socket.off("captain-arrived", onCaptainArrived);
      socket.off("receive-message", onRideChatMessage);
      socket.off("ride-message", onRideChatMessage);
      socket.off("ride-chat-message", onRideChatMessage);
      socket.off("message-received", onRideChatMessage);
      socket.off("ride-cancelled-by-captain", onRideCancelledByCaptain);
    };
  }, [
    socket,
    navigate,
    pickup,
    destination,
    cleanRouteStops,
    ride,
    normalizeSocketRide,
    syncRideState,
  ]);

  const sendRideChatMessage = async (presetText = "") => {
    const cleanText = String(presetText || rideChatText || "").trim();

    if (!cleanText || !ride?._id || rideChatSending) return;

    const token = localStorage.getItem("token");

    if (!token) {
      alert("No hay sesión activa.");
      return;
    }

    const tempMessage = {
      id: `local-${Date.now()}-${Math.random()}`,
      rideId: ride._id,
      senderType: "user",
      from: "user",
      text: cleanText,
      message: cleanText,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setRideChatMessages((prev) => [...prev, tempMessage]);
    setRideChatText("");

    try {
      setRideChatSending(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/chat-message`,
        {
          rideId: ride._id,
          message: cleanText,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const serverMessage =
        response?.data?.data ||
        response?.data?.messageData ||
        null;

      setRideChatMessages((prev) =>
        prev.map((item) =>
          item.id === tempMessage.id
            ? {
                ...item,
                id: serverMessage?._id || item.id,
                pending: false,
                failed: false,
                createdAt:
                  serverMessage?.createdAt ||
                  item.createdAt,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Error enviando chat del domicilio:", error);

      setRideChatMessages((prev) =>
        prev.map((item) =>
          item.id === tempMessage.id
            ? {
                ...item,
                pending: false,
                failed: true,
              }
            : item
        )
      );

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo enviar el mensaje."
      );
    } finally {
      setRideChatSending(false);
    }
  };

  useEffect(() => {
    if (!rideChatOpen) return;

    setRideChatUnread(0);

    const timer = setTimeout(() => {
      rideChatEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [rideChatOpen, rideChatMessages]);

  const normalizeSuggestionRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        description:
          row.description ||
          row.structured_formatting?.main_text ||
          row.formatted_address ||
          "",
        place_id: row.place_id || "",
        structured_formatting: row.structured_formatting || null,
        source: row.source || "backend",
        lat: row.lat || row.location?.lat || null,
        lng: row.lng || row.location?.lng || null,
        location: row.location || null,
      }))
      .filter((item) => item.description);

  const runFetchSuggestions = useCallback(
    async (query) => {
      const seq = ++suggestionSeqRef.current;

      if (mapsApiLoaded && window.google?.maps) {
        try {
          const { AutocompleteSuggestion } =
            await window.google.maps.importLibrary("places");

          const { suggestions: raw } =
            await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: query,
            });

          const mapped = (raw ?? [])
            .map((item) => item.placePrediction)
            .filter(Boolean)
            .map((prediction) => {
              const description =
                prediction.text?.text ??
                [prediction.mainText?.text, prediction.secondaryText?.text]
                  .filter(Boolean)
                  .join(", ");

              return {
                description: description || "",
                place_id: prediction.placeId || "",
                structured_formatting: {
                  main_text: prediction.mainText?.text || description || "",
                  secondary_text: prediction.secondaryText?.text || "",
                },
                source: "google_places_new",
              };
            })
            .filter((item) => item.description);

          if (seq !== suggestionSeqRef.current) return;

          if (mapped.length > 0) {
            setSuggestions(mapped);
            return;
          }
        } catch (error) {
          console.warn("Fallback de suggestions:", error?.message || error);
        }
      }

      try {
        const { data } = await axios.get(
          `${getApiBaseUrl()}/maps/get-suggestions`,
          {
            params: { address: query },
            timeout: 18000,
          }
        );

        if (seq !== suggestionSeqRef.current) return;

        setSuggestions(normalizeSuggestionRows(data));
      } catch (error) {
        console.error("Error fetching suggestions:", error);

        if (seq === suggestionSeqRef.current) {
          setSuggestions([]);
        }
      }
    },
    [mapsApiLoaded]
  );

  const fetchSuggestions = (query) => {
    if (!query || query.length < 3) {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }

      setSuggestions([]);
      return;
    }

    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
    }

    suggestionTimerRef.current = setTimeout(() => {
      suggestionTimerRef.current = null;
      runFetchSuggestions(query);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (restoringRideRef.current) return;
    if (ride?._id) return;

    setPrices(null);
    setDistance(null);
    setPricingError(null);
    setSelectedVehicle(null);
    setSelectedPrice(null);
    setOfferedPrice(null);
    setVehicleFound(false);
    setDriverSelected(false);
    setConfirmRidePanel(false);
    setCaptainArrived(false);
    setEtaInfo({ etaText: "", distanceText: "" });
  }, [pickup, destination, cleanRouteStops.length, ride?._id]);

  useEffect(() => {
    if (!vehiclePanel || !pickup || !destination || prices != null) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        setPricingError(null);

        const originForApi = getPickupForApi();
        const destinationForApi = getDestinationForApi();
        const stopsForApi = getStopsForApi();

        const [pricesRes, distRes] = await Promise.all([
          axios.get(`${getApiBaseUrl()}/maps/get-prices`, {
            params: {
              origin: originForApi,
              destination: destinationForApi,
              stops: stopsForApi.join("|"),
            },
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${getApiBaseUrl()}/maps/get-distance`, {
            params: {
              origin: originForApi,
              destination: destinationForApi,
              stops: stopsForApi.join("|"),
            },
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!cancelled) {
          setPrices(pricesRes.data ?? null);
          setDistance(distRes.data ?? null);
          setPricingError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const apiMsg = error?.response?.data?.message;

          const detail =
            typeof apiMsg === "string" && apiMsg.trim()
              ? apiMsg
              : error?.message ||
                "No se pudieron cargar los precios para esta ruta.";

          console.error("Error fetching fare or distance:", detail, error);
          setPrices(null);
          setDistance(null);
          setPricingError(detail);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    vehiclePanel,
    pickup,
    destination,
    cleanRouteStops,
    prices,
    getPickupForApi,
    getDestinationForApi,
    getStopsForApi,
  ]);

  const logoutUser = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.get(`${getApiBaseUrl()}/users/logout`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const closeRoutePanels = () => {
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setSuggestions([]);
  };

  const handleSuggestionSelect = async (suggestion) => {
    const selectedText =
      typeof suggestion === "string"
        ? suggestion
        : suggestion?.description || "";

    if (!selectedText) return;

    const coords = await getPlaceCoordinates(suggestion);

    if (activeInput === "pickup") {
      setPickup(selectedText);
      setPickupCoords(coords);
      setPickupDetected(false);
      setSuggestions([]);
      setPanelOpen(true);
      setStopsPanelOpen(false);
      setActiveInput("destination");
      return;
    }

    if (activeInput === "destination") {
      setDestination(selectedText);
      setDestinationCoords(coords);
      saveRecentPlace(selectedText);

      setSuggestions([]);
      setPanelOpen(true);
      setStopsPanelOpen(false);
      setActiveInput(null);
      return;
    }

    if (String(activeInput || "").startsWith("stop-")) {
      const index = Number(String(activeInput).replace("stop-", ""));

      if (Number.isInteger(index) && index >= 0) {
        setRouteStops((prev) => {
          const next = [...prev];
          next[index] = selectedText;
          return next;
        });

        setRouteStopCoords((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          next[index] = coords;
          return next;
        });
      }

      setSuggestions([]);
      setPanelOpen(true);
      setStopsPanelOpen(false);
      setActiveInput("destination");
      return;
    }

    setSuggestions([]);
  };

  const addEmptyStop = () => {
    setRouteStops((prev) => {
      const next = [...prev, ""];
      return next;
    });

    setRouteStopCoords((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next.push(null);
      return next;
    });

    setStopsPanelOpen(false);
    setPanelOpen(true);
    setSuggestions([]);

    setTimeout(() => {
      setActiveInput(`stop-${routeStops.length}`);
    }, 80);
  };

  const removeStop = (index) => {
    setRouteStops((prev) => prev.filter((_, i) => i !== index));

    setRouteStopCoords((prev) =>
      Array.isArray(prev) ? prev.filter((_, i) => i !== index) : []
    );
  };

  const openStopsManager = () => {
    setStopsPanelOpen(true);
    setPanelOpen(false);
    setSuggestions([]);
  };

  const handleFindDriver = async (forcedDestination = null) => {
    const finalDestination = String(forcedDestination || destination || "").trim();

    if (ride?._id && !creatingAdditionalRide) {
      if (ride.status === "pending" || ride.status === "negotiating") {
        const isScheduled =
          ride?.serviceTiming === "scheduled" ||
          Boolean(ride?.schedule?.pickupStartAt);

        setVehicleFound(!isScheduled);
        setScheduledPublishedOpen(isScheduled);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setVehiclePanel(false);
        setConfirmRidePanel(false);
        return;
      }

      if (ride.status === "accepted" || ride.status === "arrived") {
        const isScheduled =
          ride?.serviceTiming === "scheduled" ||
          Boolean(ride?.schedule?.pickupStartAt);

        const dispatchStarted =
          Boolean(ride?.scheduledDispatchStartedAt);

        setDriverSelected(
          ride.status === "arrived" ||
          !isScheduled ||
          dispatchStarted
        );
        setScheduledPublishedOpen(
          isScheduled &&
          ride.status === "accepted" &&
          !dispatchStarted
        );
        setVehicleFound(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setVehiclePanel(false);
        setConfirmRidePanel(false);
        return;
      }
    }

    if (!pickup || pickup.trim().length < 3) {
      const gpsResult = await requestGpsLocation();

      if (!gpsResult?.address && !gpsResult?.lat) {
        alert(
          "Primero activa tu ubicación o escribe manualmente tu punto de recogida."
        );
        return;
      }
    }

    if (!finalDestination || finalDestination.length < 3) {
      setPanelOpen(true);
      setActiveInput("destination");
      return;
    }

    if (forcedDestination) {
      setDestination(finalDestination);
      setDestinationCoords(null);
    }

    saveRecentPlace(finalDestination);
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setSuggestions([]);
    setShipmentPanelOpen(true);
  };

  const continueToVehicleSelection = () => {
    const safeQuantity = Math.max(1, Number(cargoQuantity) || 1);
    setCargoQuantity(safeQuantity);

    if (!cargoCategory) {
      alert("Selecciona qué tipo de mercancía vas a enviar.");
      return;
    }

    if (!weightUnknown) {
      const weight = Number(approximateWeight);

      if (!Number.isFinite(weight) || weight <= 0) {
        alert("Ingresa el peso aproximado o selecciona ‘No sé cuánto pesa’.");
        return;
      }
    }

    if (serviceTiming === "scheduled") {
      if (!scheduledDate || !scheduledStartTime) {
        alert("Selecciona la fecha y la hora de recogida.");
        return;
      }

      const scheduledStart = new Date(`${scheduledDate}T${scheduledStartTime}:00`);

      if (
        Number.isNaN(scheduledStart.getTime()) ||
        scheduledStart.getTime() <= Date.now()
      ) {
        alert("La fecha y hora programadas deben ser posteriores a la hora actual.");
        return;
      }

      if (scheduledEndTime) {
        const scheduledEnd = new Date(`${scheduledDate}T${scheduledEndTime}:00`);

        if (
          Number.isNaN(scheduledEnd.getTime()) ||
          scheduledEnd.getTime() <= scheduledStart.getTime()
        ) {
          alert("La hora final debe ser posterior a la hora inicial.");
          return;
        }
      }
    }

    setShipmentPanelOpen(false);
    setVehiclePanel(true);
  };

  const selectRecentDestination = (place) => {
    const clean = String(place || "").trim();

    if (!clean) return;

    setDestination(clean);
    setDestinationCoords(null);
    saveRecentPlace(clean);
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setSuggestions([]);
  };

  const selectRecentForActiveInput = (place) => {
    const clean = String(place || "").trim();

    if (!clean) return;

    if (String(activeInput || "").startsWith("stop-")) {
      const stopIndex = Number(String(activeInput).replace("stop-", ""));

      if (Number.isInteger(stopIndex) && stopIndex >= 0) {
        setRouteStops((prev) => {
          const next = [...prev];
          next[stopIndex] = clean;
          return next;
        });

        setRouteStopCoords((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          next[stopIndex] = null;
          return next;
        });
      }

      setSuggestions([]);
      setPanelOpen(true);
      setStopsPanelOpen(false);
      setActiveInput("destination");
      return;
    }

    setDestination(clean);
    setDestinationCoords(null);
    saveRecentPlace(clean);

    setSuggestions([]);
    setPanelOpen(true);
    setStopsPanelOpen(false);
    setActiveInput(null);
  };

  const buildSchedulePayload = () => {
    if (serviceTiming !== "scheduled") {
      return {
        pickupStartAt: null,
        pickupEndAt: null,
        timezone: "America/Bogota",
        notes: "",
      };
    }

    const pickupStartAt = new Date(
      `${scheduledDate}T${scheduledStartTime}:00`
    ).toISOString();

    const pickupEndAt = scheduledEndTime
      ? new Date(`${scheduledDate}T${scheduledEndTime}:00`).toISOString()
      : null;

    return {
      pickupStartAt,
      pickupEndAt,
      timezone: "America/Bogota",
      notes: "",
    };
  };

  const createRide = async (offeredFare) => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("No hay sesión activa.");
    }

    if (!pickup || !destination) {
      throw new Error("Debes ingresar origen y destino.");
    }

    if (!selectedVehicle) {
      throw new Error("No has seleccionado un vehículo.");
    }

    try {
      const finalOfferedFare =
        Number(offeredFare) || Number(selectedPrice) || 0;

      const pickupForApi = getPickupForApi();
      const destinationForApi = getDestinationForApi();
      const stopsForApi = getStopsForApi();

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/create`,
        {
          /*
           * Se manda coordenada si existe; si no, texto.
           * Con Geocoding apagado, lo ideal es que pickup/destination sean lat,lng.
           */
          pickup: pickupForApi,
          destination: destinationForApi,
          routeStops: stopsForApi,

          /*
           * Labels para que después backend pueda guardarlos y mostrar bonito.
           * Si backend aún no los usa, no afecta.
           */
          pickupLabel: pickup,
          destinationLabel: destination,
          routeStopLabels: cleanRouteStops,

          vehicle: selectedVehicle,
          offeredFare: finalOfferedFare,

          /*
           * Central GO - datos del servicio local y de la mercancía.
           * Estos campos viajan al controller -> service -> MongoDB.
           */
          serviceType: "local_delivery",
          senderType,
          serviceTiming,
          schedule: buildSchedulePayload(),
          cargo: {
            category:
              cargoCategory === "general"
                ? "general_merchandise"
                : cargoCategory,
            quantity: Math.max(1, Math.floor(Number(cargoQuantity) || 1)),
            approximateWeight: weightUnknown
              ? null
              : Number(approximateWeight) || null,
            weightUnit: "kg",
            weightUnknown,
            description: "",
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const rideData = response?.data ?? null;

      if (!rideData) {
        throw new Error("El servidor no devolvió la solicitud creada.");
      }

      const rideForUi = {
        ...rideData,
        pickupLabel: rideData.pickupLabel || pickup,
        destinationLabel: rideData.destinationLabel || destination,
        routeStopLabels: rideData.routeStopLabels || cleanRouteStops,
        serviceType: "local_delivery",
        senderType,
        serviceTiming,
        schedule: buildSchedulePayload(),
        cargo: {
          category:
            cargoCategory === "general"
              ? "general_merchandise"
              : cargoCategory,
          quantity: Math.max(1, Math.floor(Number(cargoQuantity) || 1)),
          approximateWeight: weightUnknown
            ? null
            : Number(approximateWeight) || null,
          weightUnit: "kg",
          weightUnknown,
          description: "",
        },
      };

      setOfferedPrice(finalOfferedFare);
      setRide(rideForUi);

      const isScheduled =
        rideForUi?.serviceTiming === "scheduled" ||
        Boolean(rideForUi?.schedule?.pickupStartAt);

      setPanelOpen(false);
      setStopsPanelOpen(false);
      setVehiclePanel(false);
      setConfirmRidePanel(false);
      setDriverSelected(false);
      setVehicleFound(!isScheduled);
      setScheduledPublishedOpen(isScheduled);
      setCreatingAdditionalRide(false);
      setCaptainArrived(false);

      return rideForUi;
    } catch (error) {
      console.error("Error creating ride:", error);

      const activeRide = error?.response?.data?.ride || null;
      const activeCode = error?.response?.data?.code || "";

      if (activeRide?._id && activeCode === "ACTIVE_RIDE_EXISTS") {
        syncRideState(activeRide);
        return activeRide;
      }

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo crear la solicitud."
      );

      setVehicleFound(false);
      setConfirmRidePanel(true);

      throw error;
    }
  };

  const prepareMarketplaceNavigation = () => {
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setShipmentPanelOpen(false);
    setVehiclePanel(false);
    setConfirmRidePanel(false);
    setVehicleFound(false);
    setDriverSelected(false);
    setSuggestions([]);
  };

  const goToMarketplaceLogistico = () => {
    prepareMarketplaceNavigation();

    /*
     * Navegación fuerte:
     * En producción la URL sí cambiaba, pero la vista no montaba hasta hacer F5.
     * Con assign() se hace el cambio de ruta y la carga completa automáticamente.
     */
    window.location.assign("/available-offers");
  };

  const getOfferExpiresAtMs = (offer) => {
    if (offer?.expiresAt) {
      const t = new Date(offer.expiresAt).getTime();
      if (Number.isFinite(t)) return t;
    }

    const createdAt = offer?.createdAt
      ? new Date(offer.createdAt).getTime()
      : Date.now();

    return createdAt + OFFER_TTL_MS;
  };

  const liveOffers = useMemo(() => {
    const offers = ride?.activeDriverOffers || ride?.driverOffers || [];

    return (Array.isArray(offers) ? offers : [])
      .filter((offer) => offer?.status === "pending")
      .map((offer) => ({
        ...offer,
        remainingMs: Math.max(0, getOfferExpiresAtMs(offer) - offerNow),
      }))
      .sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
  }, [ride, offerNow]);

  useEffect(() => {
    const shouldWatchOffers =
      vehicleFound ||
      (
        (
          ride?.serviceTiming === "scheduled" ||
          Boolean(ride?.schedule?.pickupStartAt)
        ) &&
        !creatingAdditionalRide &&
        (ride?.status === "pending" || ride?.status === "negotiating")
      );

    if (!shouldWatchOffers) return;
    if (driverSelected) return;
    if (!ride?._id) return;

    const token = localStorage.getItem("token");

    if (!token) return;

    let cancelled = false;

    const fetchOffers = async () => {
      try {
        const response = await axios.get(
          `${getApiBaseUrl()}/rides/${ride._id}/offers`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (cancelled) return;

        const data = response?.data || {};

        setRide((prev) => ({
          ...(prev || {}),
          _id: prev?._id || data?.rideId || ride._id,
          pickup: prev?.pickup || pickup,
          destination: prev?.destination || destination,
          routeStops: prev?.routeStops || cleanRouteStops,
          pickupLabel: prev?.pickupLabel || pickup,
          destinationLabel: prev?.destinationLabel || destination,
          routeStopLabels: prev?.routeStopLabels || cleanRouteStops,
          status: data?.status || prev?.status,
          negotiationStatus: data?.negotiationStatus || prev?.negotiationStatus,
          offeredFare: data?.offeredFare ?? prev?.offeredFare,
          fare: data?.fare ?? prev?.fare,
          activeDriverOffers: Array.isArray(data?.activeDriverOffers)
            ? data.activeDriverOffers
            : [],
          driverOffers: Array.isArray(data?.driverOffers)
            ? data.driverOffers
            : prev?.driverOffers || [],
          captain: data?.captain || prev?.captain || null,
        }));
      } catch (error) {
        console.warn(
          "No se pudieron actualizar las ofertas:",
          error?.response?.data?.message || error?.message
        );
      }
    };

    fetchOffers();

    /*
     * HOTFIX:
     * Antes estaba en 2000ms.
     * Lo bajamos a 5000ms para reducir presión sobre backend y APIs.
     */
    const interval = setInterval(fetchOffers, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    vehicleFound,
    driverSelected,
    ride?._id,
    ride?.serviceTiming,
    ride?.status,
    creatingAdditionalRide,
    pickup,
    destination,
    cleanRouteStops,
  ]);

  const getCaptainPhoto = (captain) =>
    captain?.profileImage ||
    captain?.photo ||
    captain?.avatar ||
    captain?.image ||
    captain?.profilePic ||
    "";

  const getVehicleColor = (captain) =>
    captain?.vehicle?.color ||
    captain?.vehicleColor ||
    captain?.color ||
    "";

  const getVehiclePlate = (captain) =>
    captain?.vehicle?.plate || captain?.plate || "";

  const getVehicleName = (captain) =>
    captain?.vehicle?.vehicleType ||
    captain?.vehicle?.type ||
    captain?.vehicleType ||
    selectedVehicle ||
    "car";

  const acceptOffer = async (captainId) => {
    const selectedOffer = liveOffers.find((offer) => {
      const offerCaptainId = String(offer?.captain?._id || offer?.captain || "");
      return offerCaptainId === String(captainId);
    });

    const offerKey = selectedOffer?._id || captainId;

    try {
      const token = localStorage.getItem("token");

      if (!ride?._id || !captainId || !token) return;

      setAcceptingOfferId(offerKey);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/respond-offer`,
        {
          rideId: ride._id,
          captainId,
          action: "accepted",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const nextRide = response?.data?.ride || response?.data || ride;

      if (nextRide?._id) {
        const isScheduled =
          nextRide?.serviceTiming === "scheduled" ||
          Boolean(nextRide?.schedule?.pickupStartAt);

        const dispatchStarted =
          Boolean(nextRide?.scheduledDispatchStartedAt);

        setRide(nextRide);
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setPanelOpen(false);
        setStopsPanelOpen(false);
        setShipmentPanelOpen(false);
        setScheduledPublishedOpen(isScheduled && !dispatchStarted);
        setDriverSelected(!isScheduled || dispatchStarted);
        setCaptainArrived(false);
        return;
      }

      alert("Oferta aceptada, pero no se pudo cargar la información completa.");
    } catch (error) {
      console.error("Error aceptando oferta:", error);

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "No se pudo aceptar la oferta.";

      try {
        const token = localStorage.getItem("token");

        if (token) {
          const activeResponse = await axios.get(
            `${getApiBaseUrl()}/rides/my-active`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const activeRide = activeResponse?.data?.ride || null;

          if (
            activeRide?._id &&
            String(activeRide._id) === String(ride?._id) &&
            activeRide?.status === "accepted"
          ) {
            const isScheduled =
              activeRide?.serviceTiming === "scheduled" ||
              Boolean(activeRide?.schedule?.pickupStartAt);

            const dispatchStarted =
              Boolean(activeRide?.scheduledDispatchStartedAt);

            setRide(activeRide);
            setVehicleFound(false);
            setConfirmRidePanel(false);
            setVehiclePanel(false);
            setPanelOpen(false);
            setStopsPanelOpen(false);
            setScheduledPublishedOpen(
              isScheduled && !dispatchStarted
            );
            setDriverSelected(!isScheduled || dispatchStarted);
            setCaptainArrived(false);
            return;
          }
        }
      } catch (activeError) {
        console.warn(
          "No se pudo validar carrera activa después de error:",
          activeError?.response?.data?.message || activeError?.message
        );
      }

      alert(message);
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const rejectOffer = async (captainId) => {
    try {
      const token = localStorage.getItem("token");

      if (!ride?._id || !captainId) return;

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/respond-offer`,
        {
          rideId: ride._id,
          captainId,
          action: "rejected",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setRide(response?.data || ride);
    } catch (error) {
      console.error("Error rechazando oferta:", error);

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo rechazar la oferta."
      );
    }
  };

  const cancelScheduledRide = async () => {
    if (!ride?._id || cancellingScheduledRide) return;

    const confirmed = window.confirm(
      "¿Seguro que deseas cancelar este domicilio programado? Esta acción lo quitará también para los conductores."
    );

    if (!confirmed) return;

    try {
      setCancellingScheduledRide(true);

      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No hay sesión activa.");
      }

      await axios.post(
        `${getApiBaseUrl()}/rides/cancel`,
        {
          rideId: ride._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setRide(null);
      setScheduledPublishedOpen(false);
      setCreatingAdditionalRide(false);
      setVehicleFound(false);
      setDriverSelected(false);
      setCaptainArrived(false);
      setPanelOpen(false);
      setStopsPanelOpen(false);
      setShipmentPanelOpen(false);
      setVehiclePanel(false);
      setConfirmRidePanel(false);
      setSuggestions([]);
      setSelectedVehicle(null);
      setSelectedPrice(null);
      setOfferedPrice(null);
      setPrices(null);
      setDistance(null);
      setPricingError(null);
      setRouteStops([]);
      setRouteStopCoords([]);
      setDestination("");
      setDestinationCoords(null);
      setServiceTiming("now");
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndTime("");

      alert("Domicilio programado cancelado correctamente.");
    } catch (error) {
      console.error("Error cancelando domicilio programado:", error);

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo cancelar el domicilio programado."
      );
    } finally {
      setCancellingScheduledRide(false);
    }
  };

  const startNewDelivery = (timing = "now") => {
    setCreatingAdditionalRide(true);
    setScheduledPublishedOpen(false);
    setServiceTiming(timing === "scheduled" ? "scheduled" : "now");

    setDestination("");
    setDestinationCoords(null);
    setRouteStops([]);
    setRouteStopCoords([]);
    setSelectedVehicle(null);
    setSelectedPrice(null);
    setOfferedPrice(null);
    setPrices(null);
    setDistance(null);
    setPricingError(null);
    setSuggestions([]);
    setConfirmRidePanel(false);
    setVehiclePanel(false);
    setVehicleFound(false);
    setDriverSelected(false);
    setShipmentPanelOpen(false);
    setStopsPanelOpen(false);

    if (timing === "scheduled") {
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndTime("");
    }

    setPanelOpen(true);
    setActiveInput("destination");
  };

  const openCurrentScheduledRide = () => {
    if (!ride?._id || ride?.serviceTiming !== "scheduled") return;

    setCreatingAdditionalRide(false);
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setShipmentPanelOpen(false);
    setVehiclePanel(false);
    setConfirmRidePanel(false);
    setScheduledPublishedOpen(true);
  };

  const formatScheduledPickup = (rideData) => {
    const raw = rideData?.schedule?.pickupStartAt;

    if (!raw) return "Horario programado";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Horario programado";

    return new Intl.DateTimeFormat("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(date);
  };

  const activeScheduledRide =
    (
      ride?.serviceTiming === "scheduled" ||
      Boolean(ride?.schedule?.pickupStartAt)
    ) &&
    !creatingAdditionalRide &&
    !driverSelected &&
    (
      ride?.status === "pending" ||
      ride?.status === "negotiating" ||
      (
        ride?.status === "accepted" &&
        !ride?.scheduledDispatchStartedAt
      )
    );

  useGSAP(() => {
    if (vehiclePanel) {
      gsap.to(vehicleRef.current, { y: "0%", delay: 0.3 });
    } else {
      gsap.to(vehicleRef.current, { y: "100%" });
    }
  }, [vehiclePanel]);

  useGSAP(() => {
    if (driverSelected) {
      gsap.to(driverSelectedRef.current, { y: "0%", delay: 0.3 });
    } else {
      gsap.to(driverSelectedRef.current, { y: "100%" });
    }
  }, [driverSelected]);

  useGSAP(() => {
    if (vehicleFound) {
      gsap.to(vehicleFoundRef.current, { y: "0%", delay: 0.3 });
    } else {
      gsap.to(vehicleFoundRef.current, { y: "100%" });
    }
  }, [vehicleFound]);

  useGSAP(() => {
    if (confirmRidePanel) {
      gsap.to(confirmRidePanelRef.current, { y: "0%", delay: 0.3 });
    } else {
      gsap.to(confirmRidePanelRef.current, { y: "100%" });
    }
  }, [confirmRidePanel]);

  return (
    <div className="h-screen relative w-screen overflow-hidden bg-white">
      <div className="absolute inset-0 z-10">
        <LiveTracking
          pickup={
            driverSelected
              ? ride?.pickup || getPickupForApi()
              : getPickupForApi()
          }
          destination={
            driverSelected
              ? ride?.destination || getDestinationForApi()
              : getDestinationForApi()
          }
          routeStops={
            driverSelected
              ? ride?.routeStops || getStopsForApi()
              : getStopsForApi()
          }
          nearbyDrivers={nearbyDrivers}
          showPickupRadar={vehicleFound && !driverSelected && !activeScheduledRide}
          selectedCaptainId={ride?.captain?._id || null}
          showRouteToPickup={driverSelected}
          onEtaUpdate={setEtaInfo}
        />
      </div>

      <div className="absolute top-5 left-4 z-40">
        <img
          className="w-16 drop-shadow-xl"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <button
        type="button"
        onClick={logoutUser}
        className="absolute top-5 right-4 w-11 h-11 rounded-full bg-white/95 flex items-center justify-center z-40 shadow-lg border border-gray-200"
        aria-label="Cerrar sesión"
      >
        <i className="ri-logout-box-line text-xl text-gray-900"></i>
      </button>

      {gpsStatus !== "granted" &&
        !hideGpsBanner &&
        !vehicleFound &&
        !driverSelected && (
          <div className="absolute top-4 left-4 right-4 z-50">
            <div className="rounded-[26px] bg-white/95 backdrop-blur border border-purple-100 shadow-2xl overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-user-fill text-2xl"></i>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-black text-gray-900 leading-tight">
                    {gpsStatus === "loading"
                      ? "Detectando tu ubicación"
                      : "Activa tu ubicación"}
                  </p>

                  <p className="text-[13px] text-gray-600 mt-1 leading-snug">
                    {gpsStatus === "loading"
                      ? "Estamos ubicándote para mejorar la precisión del servicio."
                      : "Así podremos mostrarte conductores y rutas más cercanas."}
                  </p>

                  {gpsError ? (
                    <p className="text-[12px] mt-2 text-red-600 font-semibold leading-snug">
                      {gpsError}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2 mt-3">
                    {gpsStatus !== "loading" && (
                      <button
                        type="button"
                        onClick={requestGpsLocation}
                        className="rounded-full bg-purple-800 text-white px-4 py-2 text-sm font-black shadow"
                      >
                        Activar ubicación
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={dismissGpsBanner}
                      className="rounded-full bg-gray-100 text-gray-700 px-4 py-2 text-sm font-bold"
                    >
                      Ahora no
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={dismissGpsBanner}
                  className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                  aria-label="Cerrar aviso de ubicación"
                >
                  <i className="ri-close-line text-xl text-gray-800"></i>
                </button>
              </div>
            </div>
          </div>
        )}

      {pickup &&
        destination &&
        !panelOpen &&
        !stopsPanelOpen &&
        !shipmentPanelOpen &&
        !vehiclePanel &&
        !vehicleFound &&
        !driverSelected && (
          <div className="absolute top-20 left-4 right-4 z-40">
            <div className="rounded-[24px] bg-white/95 backdrop-blur shadow-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setPanelOpen(true);
                  setActiveInput("pickup");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left"
              >
                <i className="ri-map-pin-user-fill text-2xl text-purple-800 shrink-0"></i>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-500">De</p>
                  <p className="text-[16px] font-bold text-gray-900 truncate">
                    {pickup}
                  </p>
                </div>

                <span className="rounded-full bg-purple-50 text-purple-900 text-xs font-bold px-3 py-1">
                  Actual
                </span>
              </button>

              <div className="w-full flex items-center gap-3 px-4 py-3">
                <i className="ri-flag-2-fill text-2xl text-gray-900 shrink-0"></i>

                <button
                  type="button"
                  onClick={openStopsManager}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs font-semibold text-gray-500">
                    {routeStopsCount > 0
                      ? `${routeStopsCount} domicilio(s) de ruta`
                      : "A"}
                  </p>

                  <p className="text-[16px] font-bold text-gray-900 truncate">
                    {destination}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={addEmptyStop}
                  className="h-9 rounded-full bg-purple-700 text-white flex items-center gap-1 px-3 shadow-lg"
                >
                  <i className="ri-add-line text-lg"></i>
                  <span className="text-xs font-black">Domicilio</span>
                </button>
              </div>
            </div>
          </div>
        )}

      {vehicleFound && !activeScheduledRide && liveOffers.length > 0 && (
        <div className="absolute top-24 left-0 right-0 z-40 px-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {liveOffers.map((offer, index) => {
              const captain = offer?.captain || {};
              const captainId = captain?._id || offer?.captain;

              const captainName = `${
                captain?.fullname?.firstname || "Conductor"
              } ${captain?.fullname?.lastname || ""}`.trim();

              const photo = getCaptainPhoto(captain);
              const plate = getVehiclePlate(captain);
              const color = getVehicleColor(captain);
              const vehicleName = getVehicleName(captain);

              const secondsLeft = Math.max(
                0,
                Math.ceil((offer?.remainingMs || 0) / 1000)
              );

              return (
                <div
                  key={offer?._id || `${captain?._id || "captain"}-${index}`}
                  className="min-w-[310px] max-w-[310px] rounded-3xl bg-white/95 backdrop-blur shadow-2xl border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    {photo ? (
                      <img
                        src={photo}
                        alt={captainName}
                        className="w-14 h-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center">
                        <i className="ri-user-3-line text-2xl text-gray-600"></i>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {captainName}
                      </p>

                      <p className="text-xs text-gray-600 truncate">
                        {vehicleName}
                        {color ? ` · ${color}` : ""}
                        {plate ? ` · ${plate}` : ""}
                      </p>

                      <p className="text-xs text-orange-600 font-semibold mt-1">
                        {secondsLeft > 0
                          ? `Expira en ${secondsLeft}s`
                          : "Validando disponibilidad"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-extrabold text-purple-800">
                        {new Intl.NumberFormat("es-CO", {
                          style: "currency",
                          currency: "COP",
                          maximumFractionDigits: 0,
                        }).format(Math.ceil(Number(offer?.price || 0)))}
                      </p>
                    </div>
                  </div>

                  {!!offer?.message && (
                    <p className="text-sm text-gray-700 mt-3">
                      {offer.message}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => rejectOffer(captainId)}
                      className="w-full rounded-2xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700"
                    >
                      Rechazar
                    </button>

                    <button
                      type="button"
                      disabled={
                        acceptingOfferId === (offer?._id || captainId) ||
                        !captainId
                      }
                      onClick={() => acceptOffer(captainId)}
                      className="w-full rounded-2xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 bg-gradient-to-r from-purple-700 to-purple-950"
                    >
                      {acceptingOfferId === (offer?._id || captainId)
                        ? "Aceptando..."
                        : "Aceptar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHAT:
          Se habilita desde que hay conductor asignado y la operación fue aceptada.
          NO inicia el domicilio ni activa el seguimiento.
      */}
      {ride?._id &&
        ride?.captain &&
        !scheduledPublishedOpen &&
        ["accepted", "arrived", "ongoing"].includes(String(ride?.status || "")) && (
          <button
            type="button"
            onClick={() => {
              setRideChatUnread(0);
              setRideChatOpen(true);
            }}
            className="absolute top-[168px] right-3 z-[48] flex items-center gap-2 rounded-full bg-purple-800 px-4 py-3 text-white shadow-2xl border border-purple-700"
            aria-label="Abrir chat con el conductor"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <i className="ri-chat-3-fill text-lg"></i>
              {rideChatUnread > 0 && (
                <span className="absolute -right-2 -top-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center">
                  {rideChatUnread > 9 ? "9+" : rideChatUnread}
                </span>
              )}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-bold text-purple-100">
                Domicilio activo
              </span>
              <span className="block text-xs font-black">
                Chat con conductor
              </span>
            </span>
          </button>
        )}

      {driverSelected &&
        (etaInfo?.etaText || etaInfo?.distanceText || captainArrived) && (
          <div className="absolute top-24 left-3 right-3 z-40">
            <div className="rounded-3xl bg-white/95 backdrop-blur border border-gray-200 shadow-2xl px-4 py-3">
              <p className="text-sm font-bold text-gray-900">
                {captainArrived
                  ? "Tu conductor ya llegó"
                  : "Tu conductor va en camino"}
              </p>

              <p className="text-xs text-gray-600 mt-1">
                {captainArrived
                  ? "Ya puedes encontrarte con el conductor en el punto de recogida."
                  : `${etaInfo?.etaText ? `Llega en ${etaInfo.etaText}` : ""}${
                      etaInfo?.etaText && etaInfo?.distanceText ? " · " : ""
                    }${etaInfo?.distanceText || ""}`}
              </p>
            </div>
          </div>
        )}

      {activeScheduledRide && scheduledPublishedOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[65]">
          <div className="mx-auto w-full max-w-[520px] rounded-t-[30px] bg-white shadow-[0_-16px_55px_rgba(0,0,0,0.22)] border-t border-purple-100 overflow-hidden">
            <div className="px-4 pt-3 pb-4 max-h-[68vh] overflow-y-auto">
              <div className="mx-auto w-11 h-1.5 rounded-full bg-gray-300 mb-3"></div>

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setScheduledPublishedOpen(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 flex items-center justify-center shrink-0"
                  aria-label="Volver"
                >
                  <i className="ri-arrow-left-line text-xl"></i>
                </button>

                <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <i className="ri-calendar-check-fill text-2xl"></i>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase">
                      Publicado
                    </span>
                    <span className="rounded-full bg-purple-100 text-purple-700 px-2.5 py-1 text-[10px] font-black uppercase">
                      Programado
                    </span>
                  </div>

                  <h2 className="mt-2 text-[18px] leading-tight font-black text-gray-950">
                    Tu domicilio quedó programado
                  </h2>
                  <p className="mt-1 text-[12px] leading-5 text-gray-500">
                    No necesitas esperar aquí. Te avisaremos cuando lleguen ofertas.
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-[20px] border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-purple-700 flex items-center justify-center shrink-0">
                    <i className="ri-time-fill text-xl"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Recogida
                    </p>
                    <p className="text-sm font-black text-gray-900 capitalize">
                      {formatScheduledPickup(ride)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Ruta
                  </p>
                  <div className="mt-2 flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="w-0.5 h-7 border-l-2 border-dotted border-gray-300"></span>
                      <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {ride?.pickupLabel || pickup}
                      </p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {ride?.destinationLabel || destination}
                      </p>
                    </div>
                  </div>

                  {cleanRouteStops.length > 0 && (
                    <p className="mt-2 text-xs font-black text-purple-700">
                      {cleanRouteStops.length + 1} entregas en total
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-[18px] bg-purple-50 border border-purple-100 px-3 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="ri-notification-3-fill text-purple-700 text-lg"></i>
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-purple-950">
                      {ride?.status === "accepted"
                        ? "Conductor asignado"
                        : liveOffers.length > 0
                        ? `${liveOffers.length} oferta${liveOffers.length === 1 ? "" : "s"} recibida${liveOffers.length === 1 ? "" : "s"}`
                        : "Esperando ofertas"}
                    </p>
                    <p className="text-[10px] text-purple-700">
                      {ride?.status === "accepted"
                        ? "El seguimiento iniciará cuando el conductor toque “Iniciar domicilio”."
                        : "Recibirás una notificación cuando un conductor oferte"}
                    </p>
                  </div>
                </div>

                {liveOffers.length > 0 && (
                  <span className="min-w-7 h-7 px-2 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                    {liveOffers.length}
                  </span>
                )}
              </div>

              {ride?.captain &&
                ["accepted", "arrived", "ongoing"].includes(
                  String(ride?.status || "")
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRideChatUnread(0);
                      setRideChatOpen(true);
                    }}
                    className="mt-3 w-full rounded-[18px] bg-purple-800 px-4 py-3.5 text-white shadow-lg shadow-purple-800/15 flex items-center justify-center gap-2 font-black"
                  >
                    <span className="relative flex items-center justify-center">
                      <i className="ri-chat-3-fill text-lg"></i>
                      {rideChatUnread > 0 && (
                        <span className="absolute -right-3 -top-3 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-black flex items-center justify-center">
                          {rideChatUnread > 9 ? "9+" : rideChatUnread}
                        </span>
                      )}
                    </span>
                    Chat con conductor
                  </button>
                )}

              {liveOffers.length > 0 && (
                <div className="mt-3 space-y-3">
                  <p className="text-[12px] font-black uppercase tracking-wider text-gray-500">
                    Ofertas recibidas
                  </p>

                  {liveOffers.map((offer, index) => {
                    const captain = offer?.captain || {};
                    const captainId = captain?._id || offer?.captain;
                    const captainName = `${
                      captain?.fullname?.firstname || "Conductor"
                    } ${captain?.fullname?.lastname || ""}`.trim();
                    const photo = getCaptainPhoto(captain);
                    const vehicleName = getVehicleName(captain);
                    const plate = getVehiclePlate(captain);

                    return (
                      <div
                        key={offer?._id || `${captainId || "captain"}-${index}`}
                        className="rounded-[18px] border border-gray-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {photo ? (
                            <img
                              src={photo}
                              alt={captainName}
                              className="w-11 h-11 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center">
                              <i className="ri-user-3-line text-xl text-gray-600"></i>
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-gray-900 truncate">
                              {captainName}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {vehicleName}{plate ? ` · ${plate}` : ""}
                            </p>
                          </div>

                          <p className="text-[16px] font-black text-purple-800">
                            {new Intl.NumberFormat("es-CO", {
                              style: "currency",
                              currency: "COP",
                              maximumFractionDigits: 0,
                            }).format(Math.ceil(Number(offer?.price || 0)))}
                          </p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => rejectOffer(captainId)}
                            className="rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-700"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            disabled={
                              acceptingOfferId === (offer?._id || captainId) ||
                              !captainId
                            }
                            onClick={() => acceptOffer(captainId)}
                            className="rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white disabled:opacity-60"
                          >
                            Aceptar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startNewDelivery("now")}
                  className="rounded-[18px] bg-gray-950 text-white py-3 text-xs font-black"
                >
                  <i className="ri-add-line mr-1"></i>
                  Otro domicilio
                </button>

                <button
                  type="button"
                  onClick={goToMarketplaceLogistico}
                  className="rounded-[18px] bg-purple-100 text-purple-800 py-3 text-xs font-black"
                >
                  <i className="ri-store-3-fill mr-1"></i>
                  Marketplace
                </button>
              </div>

              <button
                type="button"
                onClick={cancelScheduledRide}
                disabled={cancellingScheduledRide}
                className="mt-3 w-full rounded-[18px] border border-red-200 bg-red-50 py-3 text-sm font-black text-red-600 disabled:opacity-60"
              >
                <i className="ri-close-circle-line mr-1"></i>
                {cancellingScheduledRide
                  ? "Cancelando..."
                  : "Cancelar domicilio"}
              </button>

              <button
                type="button"
                onClick={() => setScheduledPublishedOpen(false)}
                className="mt-1 w-full py-2.5 text-sm font-black text-purple-800"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )}

      {!panelOpen &&
        !stopsPanelOpen &&
        !shipmentPanelOpen &&
        !vehiclePanel &&
        !vehicleFound &&
        !driverSelected &&
        !scheduledPublishedOpen && (
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <div className="bg-white rounded-t-[30px] shadow-[0_-10px_45px_rgba(0,0,0,0.16)] px-4 pt-3 pb-4 max-h-[56vh] overflow-y-auto">
              <div className="mx-auto w-11 h-1.5 rounded-full bg-gray-300 mb-4"></div>

              {activeScheduledRide && (
                <button
                  type="button"
                  onClick={openCurrentScheduledRide}
                  className="mb-3 w-full rounded-[20px] border border-purple-200 bg-purple-50 px-3 py-3 flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-800 text-white flex items-center justify-center shrink-0">
                    <i className="ri-calendar-check-fill text-xl"></i>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-purple-950">
                      Domicilio programado activo
                    </p>
                    <p className="text-[11px] text-purple-700 truncate capitalize">
                      {formatScheduledPickup(ride)}
                    </p>
                  </div>

                  {liveOffers.length > 0 && (
                    <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center">
                      {liveOffers.length}
                    </span>
                  )}

                  <i className="ri-arrow-right-s-line text-xl text-purple-800"></i>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCreatingAdditionalRide(true);
                  setServiceTiming("now");
                  setPanelOpen(true);
                  setActiveInput("destination");
                }}
                className="w-full rounded-[22px] bg-[#f5f5f5] px-4 py-4 flex items-center justify-between border border-gray-200 active:scale-[0.99] transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <i className="ri-search-line text-[28px] text-gray-950 shrink-0"></i>

                  <span className="text-[17px] font-black text-gray-900 leading-snug text-left">
                    ¿Dónde hacemos la primera entrega?
                  </span>
                </div>

                <i className="ri-arrow-right-s-line text-2xl text-gray-700 shrink-0"></i>
              </button>

              <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-3 backdrop-blur">
                <button
                  type="button"
                  onClick={() => handleFindDriver()}
                  disabled={!destination || destination.trim().length < 3}
                  className="w-full rounded-[18px] bg-gradient-to-r from-purple-700 to-purple-950 py-3.5 text-white text-[15px] font-black shadow-lg disabled:opacity-40 disabled:shadow-none"
                >
                  <i className="ri-truck-line mr-2"></i>
                  Solicitar domicilio
                </button>
              </div>

              {recentPlaces.length > 0 && (
                <div className="mt-4 space-y-3">
                  {recentPlaces.slice(0, 2).map((place, index) => (
                    <button
                      key={`${place}-${index}`}
                      type="button"
                      onClick={() => {
                        setCreatingAdditionalRide(true);
                        setServiceTiming("now");
                        selectRecentDestination(place);
                        setTimeout(() => handleFindDriver(place), 0);
                      }}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <div className="w-10 h-10 rounded-full border border-gray-300 bg-white flex items-center justify-center shrink-0">
                        <i className="ri-history-line text-xl text-gray-700"></i>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-black text-gray-900 truncate">
                          {place}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Destino reciente
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => startNewDelivery("now")}
                  className="min-h-[112px] rounded-[20px] bg-gradient-to-b from-purple-700 to-purple-900 px-3 py-3 text-left text-white shadow-lg active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/15 flex items-center justify-center">
                    <i className="ri-truck-fill text-xl"></i>
                  </div>
                  <p className="mt-2 text-[13px] font-black leading-tight">
                    Domicilio Ahora
                  </p>
                  <p className="mt-1 text-[10px] leading-3 text-white/75">
                    Entrega inmediata
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => startNewDelivery("scheduled")}
                  className="min-h-[112px] rounded-[20px] bg-blue-50 border border-blue-100 px-3 py-3 text-left text-blue-950 active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <i className="ri-calendar-schedule-fill text-xl"></i>
                  </div>
                  <p className="mt-2 text-[13px] font-black leading-tight">
                    Programar
                  </p>
                  <p className="mt-1 text-[10px] leading-3 text-blue-700/70">
                    Elige fecha y hora
                  </p>
                </button>

                <button
                  type="button"
                  onClick={goToMarketplaceLogistico}
                  className="min-h-[112px] rounded-[20px] bg-emerald-50 border border-emerald-100 px-3 py-3 text-left text-emerald-950 active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <i className="ri-store-3-fill text-xl"></i>
                  </div>
                  <p className="mt-2 text-[13px] font-black leading-tight">
                    Marketplace
                  </p>
                  <p className="mt-1 text-[10px] leading-3 text-emerald-700/70">
                    Cargas y cupos
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

      {panelOpen && !shipmentPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
        <>
          <div
            className="fixed inset-0 bg-black/25 z-40"
            onClick={() => {
              setPanelOpen(false);
              setSuggestions([]);
            }}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-2xl max-h-[82vh] overflow-hidden">
            <div className="px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mb-4"></div>

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[20px] font-extrabold text-gray-900">
                  Introduce tu ruta
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(false);
                    setSuggestions([]);
                  }}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center"
                  aria-label="Volver"
                >
                  <i className="ri-arrow-left-line text-2xl text-gray-900"></i>
                </button>
              </div>

              <form className="mt-4" onSubmit={submitHandler}>
                <div className="space-y-3">
                  <div className="relative">
                    <i className="ri-map-pin-user-fill absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-purple-800"></i>

                    <input
                      value={pickup}
                      onFocus={() => setActiveInput("pickup")}
                      onClick={() => setActiveInput("pickup")}
                      onChange={(e) => {
                        setPickup(e.target.value);
                        setPickupCoords(null);
                        setPickupDetected(false);
                        setActiveInput("pickup");
                        fetchSuggestions(e.target.value);
                      }}
                      type="text"
                      placeholder="De"
                      className="w-full rounded-[18px] bg-[#f2f2f2] border border-gray-200 pl-14 pr-4 py-4 text-[18px] font-medium text-gray-900 outline-none"
                    />
                  </div>

                  {routeStops.map((stop, index) => (
                    <div className="relative" key={`stop-${index}`}>
                      <i className="ri-map-pin-line absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-purple-700"></i>

                      <input
                        value={stop}
                        onFocus={() => setActiveInput(`stop-${index}`)}
                        onClick={() => setActiveInput(`stop-${index}`)}
                        onChange={(e) => {
                          const value = e.target.value;

                          setRouteStops((prev) => {
                            const next = [...prev];
                            next[index] = value;
                            return next;
                          });

                          setRouteStopCoords((prev) => {
                            const next = Array.isArray(prev) ? [...prev] : [];
                            next[index] = null;
                            return next;
                          });

                          setActiveInput(`stop-${index}`);
                          fetchSuggestions(value);
                        }}
                        type="text"
                        placeholder={`Domicilio ${index + 1}`}
                        className="w-full rounded-[18px] bg-purple-50 border border-purple-100 pl-14 pr-14 py-4 text-[18px] font-medium text-gray-900 outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => removeStop(index)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white flex items-center justify-center border border-purple-100"
                      >
                        <i className="ri-close-line text-xl text-purple-900"></i>
                      </button>
                    </div>
                  ))}

                  <div className="relative">
                    <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-900"></i>

                    <input
                      value={destination}
                      onFocus={() => setActiveInput("destination")}
                      onClick={() => setActiveInput("destination")}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setDestinationCoords(null);
                        setActiveInput("destination");
                        fetchSuggestions(e.target.value);
                      }}
                      type="text"
                      placeholder="A"
                      className="w-full rounded-[18px] bg-[#f2f2f2] border-[2px] border-gray-800 pl-14 pr-[115px] py-4 text-[18px] font-medium text-gray-900 outline-none"
                    />

                    <button
                      type="button"
                      onClick={addEmptyStop}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 rounded-full bg-purple-700 text-white flex items-center gap-1 px-3"
                    >
                      <i className="ri-add-line text-lg"></i>
                      <span className="text-xs font-black">Domicilio</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="overflow-auto max-h-[42vh] px-5 py-4">
              {suggestions.length > 0 ? (
                <LocationSearchPanel
                  vehiclePanel={vehiclePanel}
                  setVehiclePanel={setVehiclePanel}
                  panelOpen={panelOpen}
                  setPanelOpen={setPanelOpen}
                  setConfirmRidePanel={setConfirmRidePanel}
                  suggestions={suggestions}
                  onSuggestionSelect={handleSuggestionSelect}
                />
              ) : (
                <div className="space-y-4">
                  {recentPlaces.length > 0 ? (
                    recentPlaces.map((place, index) => (
                      <button
                        key={`${place}-${index}`}
                        type="button"
                        onClick={() => selectRecentForActiveInput(place)}
                        className="w-full flex items-start gap-3 text-left"
                      >
                        <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                          <i className="ri-history-line text-xl text-gray-700"></i>
                        </div>

                        <div className="min-w-0 flex-1 border-b border-gray-100 pb-4">
                          <p className="text-[18px] font-bold text-gray-900 truncate">
                            {place}
                          </p>

                          <p className="text-sm text-gray-500 truncate">
                            Destino reciente
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Empieza escribiendo tu destino para ver sugerencias.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleFindDriver()}
                className="w-full rounded-[22px] bg-gradient-to-r from-purple-700 via-purple-800 to-purple-950 text-white py-4 font-extrabold text-[18px] shadow-lg"
              >
                Encontrar conductor
              </button>
            </div>
          </div>
        </>
      )}

      {stopsPanelOpen && !shipmentPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
        <>
          <div
            className="fixed inset-0 bg-black/45 z-40"
            onClick={() => setStopsPanelOpen(false)}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStopsPanelOpen(false)}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <i className="ri-arrow-left-line text-2xl text-gray-900"></i>
                </button>

                <h3 className="text-[19px] font-extrabold text-gray-900">
                  Dirección de destino
                </h3>

                <button
                  type="button"
                  onClick={addEmptyStop}
                  className="h-10 rounded-full bg-purple-700 text-white flex items-center gap-1 px-3"
                >
                  <i className="ri-add-line text-lg"></i>
                  <span className="text-xs font-black">Domicilio</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              {cleanRouteStops.length > 0 ? (
                cleanRouteStops.map((stop, index) => (
                  <div key={`${stop}-${index}`} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center text-sm font-black">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-gray-900 truncate">
                        {stop}
                      </p>
                      <p className="text-sm text-gray-500">Domicilio de ruta</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeStop(index)}
                      className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                    >
                      <i className="ri-close-line text-2xl text-gray-900"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4 text-purple-900">
                  <p className="text-sm font-bold">No tienes domicilios agregadas.</p>
                  <p className="text-xs mt-1">
                    Agrega otro domicilio para organizar la ruta antes del destino final.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-8 flex justify-center">
                  <i className="ri-flag-2-fill text-2xl text-gray-900"></i>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-gray-900 truncate">
                    {destination || "Destino final"}
                  </p>
                  <p className="text-sm text-gray-500">Destino final</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStopsPanelOpen(false);
                    setPanelOpen(true);
                    setActiveInput("destination");
                  }}
                  className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center"
                >
                  <i className="ri-edit-line text-xl text-purple-800"></i>
                </button>
              </div>
            </div>

            <div className="px-5 pb-6 pt-2">
              <button
                type="button"
                onClick={addEmptyStop}
                className="w-full rounded-[22px] bg-purple-50 text-purple-900 py-4 font-extrabold text-base border border-purple-100"
              >
                + Agregar domicilio
              </button>
            </div>
          </div>
        </>
      )}

      {shipmentPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
        <>
          <div
            className="fixed inset-0 bg-black/35 z-40"
            onClick={() => setShipmentPanelOpen(false)}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white px-5 pt-4 pb-4 border-b border-gray-100">
              <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mb-4"></div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-700">
                    Servicio local
                  </p>
                  <h3 className="text-[22px] font-black text-gray-950 leading-tight mt-1">
                    ¿Qué vas a enviar?
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Cuéntanos lo básico para recomendarte el vehículo adecuado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShipmentPanelOpen(false)}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                  aria-label="Cerrar información del envío"
                >
                  <i className="ri-close-line text-2xl text-gray-900"></i>
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-6">
              <section>
                <p className="text-sm font-black text-gray-900 mb-3">¿Quién envía?</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "personal", label: "Personal", icon: "ri-user-3-fill" },
                    { key: "business", label: "Empresa", icon: "ri-building-2-fill" },
                  ].map((option) => {
                    const active = senderType === option.key;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSenderType(option.key)}
                        className={`rounded-[22px] border px-4 py-4 flex items-center gap-3 text-left transition ${
                          active
                            ? "bg-purple-50 border-purple-700 shadow-[0_8px_20px_rgba(88,28,135,0.12)]"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                            active ? "bg-purple-800 text-white" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <i className={`${option.icon} text-xl`}></i>
                        </div>

                        <div>
                          <p className="font-black text-gray-950">{option.label}</p>
                          <p className="text-[11px] text-gray-500">
                            {option.key === "personal" ? "Envío particular" : "Envío comercial"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="text-sm font-black text-gray-900 mb-3">Tipo de mercancía</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {CARGO_CATEGORIES.map((category) => {
                    const active = cargoCategory === category.key;

                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setCargoCategory(category.key)}
                        className={`rounded-[20px] border px-3 py-3 flex items-center gap-3 text-left transition ${
                          active
                            ? "bg-purple-50 border-purple-700 text-purple-950"
                            : "bg-white border-gray-200 text-gray-800"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            active ? "bg-purple-800 text-white" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <i className={`${category.icon} text-xl`}></i>
                        </div>
                        <span className="text-sm font-extrabold leading-tight">
                          {category.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-[22px] border border-gray-200 p-4">
                  <p className="text-sm font-black text-gray-900">Cantidad</p>
                  <p className="text-xs text-gray-500 mt-0.5">Unidades, cajas, bultos o paquetes</p>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCargoQuantity((value) => Math.max(1, Number(value || 1) - 1))}
                      className="w-11 h-11 rounded-full bg-gray-100 text-gray-900 flex items-center justify-center"
                    >
                      <i className="ri-subtract-line text-xl"></i>
                    </button>

                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={cargoQuantity}
                      onChange={(e) => setCargoQuantity(e.target.value)}
                      className="w-24 text-center text-2xl font-black text-gray-950 outline-none bg-transparent"
                    />

                    <button
                      type="button"
                      onClick={() => setCargoQuantity((value) => Math.max(1, Number(value || 1) + 1))}
                      className="w-11 h-11 rounded-full bg-purple-800 text-white flex items-center justify-center shadow"
                    >
                      <i className="ri-add-line text-xl"></i>
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-gray-200 p-4">
                  <p className="text-sm font-black text-gray-900">Peso aproximado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Peso total de todo el envío</p>

                  <div className={`mt-4 flex items-center rounded-2xl border px-3 ${weightUnknown ? "bg-gray-100 border-gray-200 opacity-60" : "bg-white border-purple-200"}`}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      disabled={weightUnknown}
                      value={approximateWeight}
                      onChange={(e) => setApproximateWeight(e.target.value)}
                      placeholder="Ej. 25"
                      className="w-full py-3 text-lg font-black text-gray-950 outline-none bg-transparent disabled:cursor-not-allowed"
                    />
                    <span className="text-sm font-black text-purple-800">kg</span>
                  </div>

                  <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={weightUnknown}
                      onChange={(e) => {
                        setWeightUnknown(e.target.checked);
                        if (e.target.checked) setApproximateWeight("");
                      }}
                      className="w-4 h-4 accent-purple-800"
                    />
                    <span className="text-xs font-bold text-gray-600">No sé cuánto pesa</span>
                  </label>
                </div>
              </section>

              <div className="rounded-[22px] bg-purple-50 border border-purple-100 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-800 text-white flex items-center justify-center shrink-0">
                  <i className="ri-route-fill text-xl"></i>
                </div>
                          <div className="mt-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
              ¿Cuándo necesitas el servicio?
            </p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceTiming("now")}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  serviceTiming === "now"
                    ? "border-purple-600 bg-purple-50 text-purple-800"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <div className="text-lg">⚡</div>
                <div className="mt-1 text-sm font-black">Ahora</div>
                <div className="text-[11px] text-gray-500">
                  Buscar conductor inmediatamente
                </div>
              </button>

              <button
                type="button"
                onClick={() => setServiceTiming("scheduled")}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  serviceTiming === "scheduled"
                    ? "border-purple-600 bg-purple-50 text-purple-800"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <div className="text-lg">📅</div>
                <div className="mt-1 text-sm font-black">Programar</div>
                <div className="text-[11px] text-gray-500">
                  Publicar para una fecha futura
                </div>
              </button>
            </div>

            {serviceTiming === "scheduled" && (
              <div className="mt-3 rounded-2xl border border-purple-100 bg-purple-50/60 p-3">
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">
                  Fecha de recogida
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-purple-500"
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
                      Desde
                    </label>
                    <input
                      type="time"
                      value={scheduledStartTime}
                      onChange={(e) => setScheduledStartTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
                      Hasta (opcional)
                    </label>
                    <input
                      type="time"
                      value={scheduledEndTime}
                      onChange={(e) => setScheduledEndTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  La solicitud quedará publicada para que un conductor pueda aceptarla con anticipación.
                </p>
              </div>
            )}
          </div>

<div className="min-w-0">
                  <p className="text-sm font-black text-purple-950">Tu ruta ya está lista</p>
                  <p className="text-xs text-purple-800 mt-0.5 truncate">
                    {pickup} → {destination}
                  </p>
                  {routeStopsCount > 0 && (
                    <p className="text-xs font-bold text-purple-700 mt-1">
                      + {routeStopsCount} domicilio(s) adicional(es)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 pt-3 pb-6">
              <button
                type="button"
                onClick={continueToVehicleSelection}
                className="w-full rounded-[22px] bg-gradient-to-r from-purple-700 via-purple-800 to-purple-950 text-white py-4 font-black text-[18px] shadow-lg flex items-center justify-center gap-2"
              >
                Continuar
                <i className="ri-arrow-right-line text-xl"></i>
              </button>
            </div>
          </div>
        </>
      )}

      {rideChatOpen && ride?._id && ride?.captain && (
        <div className="fixed inset-0 z-[999] bg-black/45 flex items-end">
          <div className="w-full max-h-[88vh] rounded-t-[28px] bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-center pt-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-black text-purple-700">
                  Chat del domicilio
                </p>
                <h3 className="text-lg font-black text-gray-950 truncate">
                  {ride?.captain?.fullname?.firstname ||
                    ride?.captain?.name ||
                    "Conductor asignado"}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {ride?.serviceTiming === "scheduled" ||
                  ride?.schedule?.pickupStartAt
                    ? "Servicio programado · Coordina antes de iniciar"
                    : "Servicio activo"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRideChatOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                aria-label="Cerrar chat"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="px-3 py-3 bg-purple-50 border-b border-purple-100 flex gap-2 overflow-x-auto">
              {[
                "La mercancía está lista",
                "¿A qué hora llegas?",
                "Te espero en la entrada",
                "¿Dónde puedes parquear?",
              ].map((quickText) => (
                <button
                  key={quickText}
                  type="button"
                  disabled={rideChatSending}
                  onClick={() => sendRideChatMessage(quickText)}
                  className="shrink-0 rounded-full bg-white border border-purple-100 px-3 py-2 text-xs font-bold text-purple-800 disabled:opacity-50"
                >
                  {quickText}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-[280px] overflow-y-auto px-4 py-4 bg-gray-50 space-y-3">
              {rideChatMessages.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <i className="ri-chat-3-fill text-2xl"></i>
                  </div>
                  <p className="mt-3 font-black text-gray-900">
                    Chat con tu conductor
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Pueden coordinar el domicilio aunque todavía esté programado.
                  </p>
                </div>
              ) : (
                rideChatMessages.map((msg) => {
                  const mine =
                    msg?.senderType === "user" ||
                    msg?.from === "user";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        mine
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          mine
                            ? "bg-purple-700 text-white rounded-br-md"
                            : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.text || msg.message}
                        </p>

                        {msg.pending && (
                          <p className="mt-1 text-[10px] opacity-70">
                            Enviando...
                          </p>
                        )}

                        {msg.failed && (
                          <p className="mt-1 text-[10px] text-red-200">
                            No enviado
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={rideChatEndRef}></div>
            </div>

            <div className="p-3 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rideChatText}
                  onChange={(e) =>
                    setRideChatText(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendRideChatMessage();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm outline-none"
                />

                <button
                  type="button"
                  disabled={
                    rideChatSending ||
                    !rideChatText.trim()
                  }
                  onClick={() => sendRideChatMessage()}
                  className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center disabled:opacity-50"
                >
                  <i className="ri-send-plane-fill text-xl"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={vehicleRef}
        className="fixed min-h-[35%] bottom-0 w-screen translate-y-full max-h-[50%] rounded-t-[28px] bg-white overflow-auto z-50"
      >
        <VehiclePanel
          setVehiclePanel={setVehiclePanel}
          setConfirmRidePanel={setConfirmRidePanel}
          prices={prices}
          distance={distance}
          pricingError={pricingError}
          setSelectedPrice={setSelectedPrice}
          setSelectedVehicle={setSelectedVehicle}
        />
      </div>

      <div
        ref={confirmRidePanelRef}
        className="fixed bottom-0 w-screen translate-y-full rounded-t-[28px] bg-white overflow-hidden z-50"
      >
        <ConfirmedRide
          setConfirmRidePanel={setConfirmRidePanel}
          setVehiclePanel={setVehiclePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          routeStops={cleanRouteStops}
          createRide={createRide}
        />
      </div>

      <div
        ref={vehicleFoundRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-[26px] bg-white overflow-hidden h-[58%] max-h-[620px] shadow-2xl"
      >
        <FindingDriver
          setConfirmRidePanel={setConfirmRidePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={offeredPrice ?? selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          routeStops={cleanRouteStops}
          ride={ride}
          onRideUpdated={(updatedRide) => {
            if (!updatedRide?._id) return;

            const nextFare = Number(
              updatedRide.offeredFare ||
                updatedRide.fare ||
                updatedRide.suggestedFare ||
                0
            );

            setRide(updatedRide);

            if (nextFare > 0) {
              setSelectedPrice(nextFare);
              setOfferedPrice(nextFare);
            }
          }}
        />
      </div>

      <div
        ref={driverSelectedRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-[24px] bg-white overflow-auto max-h-[72%] shadow-2xl"
      >
        <DriverSelected
          ride={ride}
          captainArrived={captainArrived}
          etaInfo={etaInfo}
          socket={socket}
          user={user}
          openChatOnMount={rideChatOpen}
          onChatOpened={() => {
            setRideChatUnread(0);
            setRideChatOpen(false);
          }}
        />
      </div>
    </div>
  );
}

export default Home;