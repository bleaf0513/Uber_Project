import React, {
  useEffect,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useGSAP } from "@gsap/react";
import { Link, useNavigate } from "react-router-dom";
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

const OFFER_TTL_MS = 60000;
const RECENT_PLACES_KEY = "centralgo_recent_places";

function Home() {
  const submitHandler = (e) => {
    e.preventDefault();
  };

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [stopsPanelOpen, setStopsPanelOpen] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [vehiclePanel, setVehiclePanel] = useState(false);
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

  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [offerNow, setOfferNow] = useState(Date.now());
  const [captainArrived, setCaptainArrived] = useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);

  const [etaInfo, setEtaInfo] = useState({
    etaText: "",
    distanceText: "",
  });

  const [gpsStatus, setGpsStatus] = useState("idle");
  const [gpsError, setGpsError] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const [pickupDetected, setPickupDetected] = useState(false);

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

  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const navigate = useNavigate();

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

  const formatAddressFromGeocoder = (result) => {
    if (!result) return "";

    const formatted = result.formatted_address || "";

    if (!formatted) return "";

    return formatted.replace(/, Colombia$/i, "").trim();
  };

  const reverseGeocodeCoords = useCallback(
    async (lat, lng) => {
      if (!lat || !lng) return "";

      if (mapsApiLoaded && window.google?.maps?.Geocoder) {
        try {
          const geocoder = new window.google.maps.Geocoder();

          const result = await new Promise((resolve, reject) => {
            geocoder.geocode(
              {
                location: {
                  lat: Number(lat),
                  lng: Number(lng),
                },
              },
              (results, status) => {
                if (status === "OK" && Array.isArray(results) && results[0]) {
                  resolve(results[0]);
                } else {
                  reject(new Error(status || "No se pudo detectar dirección"));
                }
              }
            );
          });

          const address = formatAddressFromGeocoder(result);

          if (address) return address;
        } catch (error) {
          console.warn("No se pudo geocodificar el GPS:", error);
        }
      }

      return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    },
    [mapsApiLoaded]
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

          setUserCoords({ lat, lng });
          emitUserLocation(lat, lng);

          const detectedAddress = await reverseGeocodeCoords(lat, lng);

          if (detectedAddress) {
            setPickup(detectedAddress);
            setPickupDetected(true);
          }

          setGpsStatus("granted");

          resolve({
            lat,
            lng,
            address: detectedAddress,
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

        setUserCoords({ lat, lng });
        emitUserLocation(lat, lng);
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

      if (rideData?.status === "accepted") {
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setDriverSelected(true);
        setCaptainArrived(false);
      }

      if (rideData?.status === "arrived" || rideData?.arrivedAtPickup) {
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setDriverSelected(true);
        setCaptainArrived(true);
      }

      if (rideData?.status === "ongoing" || rideData?.status === "completed") {
        setCaptainArrived(false);
        setDriverSelected(false);
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);

        navigate("/riding", {
          state: {
            ride: rideData,
          },
        });
      }
    },
    [pickup, destination, cleanRouteStops, navigate]
  );

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

      setCaptainArrived(false);
      setVehicleFound(false);
      setConfirmRidePanel(false);
      setVehiclePanel(false);
      setDriverSelected(true);
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

      if (
        nextRide?.status === "pending" ||
        nextRide?.status === "negotiating"
      ) {
        setVehiclePanel(false);
        setConfirmRidePanel(false);
        setDriverSelected(false);
        setVehicleFound(true);
      }

      if (nextRide?.status === "accepted") {
        syncRideState(nextRide);
      }
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

    const onRideCancelledByCaptain = (payload) => {
      setCaptainArrived(false);
      setRide(null);
      setDriverSelected(false);
      setVehicleFound(false);

      const reasonText = payload?.reason ? `\nMotivo: ${payload.reason}` : "";

      alert(
        (payload?.message || "El conductor canceló la solicitud.") + reasonText
      );
    };

    socket.on("ride-started", onRideStarted);
    socket.on("ride-confirmed", onRideConfirmed);
    socket.on("ride-offer-updated", onRideOfferUpdated);
    socket.on("ride-updated", onRideUpdated);
    socket.on("nearby-captains", onNearbyCaptains);
    socket.on("captain-location-updated", onCaptainLocationUpdated);
    socket.on("captain-arrived", onCaptainArrived);
    socket.on("ride-cancelled-by-captain", onRideCancelledByCaptain);

    return () => {
      socket.off("ride-started", onRideStarted);
      socket.off("ride-confirmed", onRideConfirmed);
      socket.off("ride-offer-updated", onRideOfferUpdated);
      socket.off("ride-updated", onRideUpdated);
      socket.off("nearby-captains", onNearbyCaptains);
      socket.off("captain-location-updated", onCaptainLocationUpdated);
      socket.off("captain-arrived", onCaptainArrived);
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
    if (query.length < 3) {
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
    setPrices(null);
    setDistance(null);
    setPricingError(null);
    setSelectedVehicle(null);
    setSelectedPrice(null);
    setOfferedPrice(null);
    setRide(null);
    setVehicleFound(false);
    setDriverSelected(false);
    setConfirmRidePanel(false);
    setCaptainArrived(false);
    setEtaInfo({ etaText: "", distanceText: "" });
  }, [pickup, destination, cleanRouteStops.length]);

  useEffect(() => {
    if (!vehiclePanel || !pickup || !destination || prices != null) return;

    const token = localStorage.getItem("token");

    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        setPricingError(null);

        const [pricesRes, distRes] = await Promise.all([
          axios.get(`${getApiBaseUrl()}/maps/get-prices`, {
            params: {
              origin: pickup,
              destination,
              stops: cleanRouteStops.join("|"),
            },
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${getApiBaseUrl()}/maps/get-distance`, {
            params: {
              origin: pickup,
              destination,
              stops: cleanRouteStops.join("|"),
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
  }, [vehiclePanel, pickup, destination, cleanRouteStops, prices]);

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

  const handleSuggestionSelect = (suggestion) => {
    const selectedText =
      typeof suggestion === "string"
        ? suggestion
        : suggestion?.description || "";

    if (!selectedText) return;

    if (activeInput === "pickup") {
      setPickup(selectedText);
      setPickupDetected(false);
    } else if (activeInput === "destination") {
      setDestination(selectedText);
      saveRecentPlace(selectedText);
    } else if (String(activeInput || "").startsWith("stop-")) {
      const index = Number(String(activeInput).replace("stop-", ""));

      if (Number.isInteger(index) && index >= 0) {
        setRouteStops((prev) => {
          const next = [...prev];
          next[index] = selectedText;
          return next;
        });
      }
    }

    setSuggestions([]);

    const nextPickup = activeInput === "pickup" ? selectedText : pickup;
    const nextDestination =
      activeInput === "destination" ? selectedText : destination;

    if (nextPickup && nextDestination && activeInput === "destination") {
      setPanelOpen(false);
      setVehiclePanel(true);
    }
  };

  const addEmptyStop = () => {
    setRouteStops((prev) => [...prev, ""]);
    setPanelOpen(true);
    setStopsPanelOpen(false);

    setTimeout(() => {
      setActiveInput(`stop-${routeStops.length}`);
    }, 80);
  };

  const removeStop = (index) => {
    setRouteStops((prev) => prev.filter((_, i) => i !== index));
  };

  const openStopsManager = () => {
    setStopsPanelOpen(true);
    setPanelOpen(false);
    setSuggestions([]);
  };

  const handleFindDriver = async () => {
    if (!pickup || pickup.trim().length < 3) {
      const gpsResult = await requestGpsLocation();

      if (!gpsResult?.address && !gpsResult?.lat) {
        alert(
          "Primero activa tu ubicación o escribe manualmente tu punto de recogida."
        );
        return;
      }
    }

    if (!destination || destination.trim().length < 3) {
      setPanelOpen(true);
      setActiveInput("destination");
      alert("Ingresa tu destino para encontrar conductor.");
      return;
    }

    saveRecentPlace(destination);
    setPanelOpen(false);
    setStopsPanelOpen(false);
    setSuggestions([]);
    setVehiclePanel(true);
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

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/create`,
        {
          pickup,
          destination,
          routeStops: cleanRouteStops,
          vehicle: selectedVehicle,
          offeredFare: finalOfferedFare,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const rideData = response?.data ?? null;

      if (!rideData) {
        throw new Error("El servidor no devolvió la solicitud creada.");
      }

      setOfferedPrice(finalOfferedFare);
      setRide(rideData);

      setVehiclePanel(false);
      setConfirmRidePanel(false);
      setDriverSelected(false);
      setVehicleFound(true);
      setCaptainArrived(false);

      return rideData;
    } catch (error) {
      console.error("Error creating ride:", error);

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

  const goToAvailableOffers = () => {
    navigate("/available-offers");
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
    if (!vehicleFound) return;
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

    const interval = setInterval(fetchOffers, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [vehicleFound, driverSelected, ride?._id, pickup, destination, cleanRouteStops]);

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
        setRide(nextRide);
        setVehicleFound(false);
        setConfirmRidePanel(false);
        setVehiclePanel(false);
        setDriverSelected(true);
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
            setRide(activeRide);
            setVehicleFound(false);
            setConfirmRidePanel(false);
            setVehiclePanel(false);
            setDriverSelected(true);
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
          pickup={driverSelected ? ride?.pickup || pickup : pickup}
          destination={driverSelected ? ride?.destination || destination : destination}
          routeStops={driverSelected ? ride?.routeStops || cleanRouteStops : cleanRouteStops}
          nearbyDrivers={nearbyDrivers}
          showPickupRadar={vehicleFound && !driverSelected}
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

      <Link
        onClick={logoutUser}
        className="absolute top-5 right-4 w-11 h-11 rounded-full bg-white/95 flex items-center justify-center z-40 shadow-lg border border-gray-200"
      >
        <i className="ri-logout-box-line text-xl text-gray-900"></i>
      </Link>

      {gpsStatus !== "granted" && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-800 via-purple-900 to-purple-950 text-white shadow-xl">
          <div className="px-4 pt-3 pb-4">
            <p className="text-[15px] font-extrabold leading-tight">
              {gpsStatus === "loading"
                ? "Detectando tu ubicación..."
                : "No pudimos encontrarte"}
            </p>

            <p className="text-sm mt-1 text-white/95">
              {gpsStatus === "loading"
                ? "Espera un momento mientras accedemos a tu ubicación."
                : "Pulsa para acceder a tu ubicación"}
            </p>

            {gpsError ? (
              <p className="text-xs mt-2 text-white/90">{gpsError}</p>
            ) : null}

            {gpsStatus !== "loading" && (
              <button
                type="button"
                onClick={requestGpsLocation}
                className="mt-3 rounded-full bg-white text-purple-900 px-5 py-2.5 text-sm font-bold shadow"
              >
                Activar ubicación
              </button>
            )}
          </div>
        </div>
      )}

      {pickup && destination && !panelOpen && !stopsPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
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
                  {routeStopsCount > 0 ? `${routeStopsCount} parada(s) de ruta` : "A"}
                </p>
                <p className="text-[16px] font-bold text-gray-900 truncate">
                  {destination}
                </p>
              </button>

              <button
                type="button"
                onClick={addEmptyStop}
                className="w-11 h-11 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-lg"
              >
                <i className="ri-add-line text-2xl"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {vehicleFound && liveOffers.length > 0 && (
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

      {!panelOpen && !stopsPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-white rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.14)] px-5 pt-3 pb-6">
            <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mb-5"></div>

            <button
              type="button"
              onClick={() => {
                setPanelOpen(true);
                setActiveInput("destination");
              }}
              className="w-full rounded-[22px] bg-[#f2f2f2] px-4 py-4 flex items-center justify-between border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <i className="ri-search-line text-3xl text-gray-900"></i>

                <span className="text-[18px] font-semibold text-gray-900">
                  ¿A dónde vamos?
                </span>
              </div>

              <i className="ri-arrow-right-s-line text-2xl text-gray-700"></i>
            </button>

            {recentPlaces.length > 0 && (
              <div className="mt-5 space-y-4">
                {recentPlaces.slice(0, 2).map((place, index) => (
                  <button
                    key={`${place}-${index}`}
                    type="button"
                    onClick={() => {
                      setDestination(place);
                      saveRecentPlace(place);
                      setPanelOpen(false);
                      setTimeout(() => {
                        handleFindDriver();
                      }, 100);
                    }}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                      <i className="ri-history-line text-xl text-gray-700"></i>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold text-gray-900 truncate">
                        {place}
                      </p>

                      <p className="text-sm text-gray-500 truncate">
                        Destino reciente
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={goToAvailableOffers}
                className="w-full rounded-[22px] bg-gradient-to-r from-purple-700 via-purple-800 to-purple-950 text-white py-4 px-4 font-extrabold text-base shadow-lg"
              >
                Entregas / Ofertas
              </button>
            </div>
          </div>
        </div>
      )}

      {panelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
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
                >
                  <i className="ri-close-line text-2xl text-gray-900"></i>
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

                          setActiveInput(`stop-${index}`);
                          fetchSuggestions(value);
                        }}
                        type="text"
                        placeholder={`Parada ${index + 1}`}
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
                        setActiveInput("destination");
                        fetchSuggestions(e.target.value);
                      }}
                      type="text"
                      placeholder="A"
                      className="w-full rounded-[18px] bg-[#f2f2f2] border-[2px] border-gray-800 pl-14 pr-14 py-4 text-[18px] font-medium text-gray-900 outline-none"
                    />

                    <button
                      type="button"
                      onClick={addEmptyStop}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-purple-700 text-white flex items-center justify-center"
                    >
                      <i className="ri-add-line text-xl"></i>
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
                        onClick={() => {
                          if (String(activeInput || "").startsWith("stop-")) {
                            const stopIndex = Number(
                              String(activeInput).replace("stop-", "")
                            );

                            setRouteStops((prev) => {
                              const next = [...prev];
                              next[stopIndex] = place;
                              return next;
                            });
                          } else {
                            setDestination(place);
                          }

                          saveRecentPlace(place);
                          setPanelOpen(false);
                          setSuggestions([]);

                          setTimeout(() => {
                            handleFindDriver();
                          }, 100);
                        }}
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
                onClick={handleFindDriver}
                className="w-full rounded-[22px] bg-gradient-to-r from-purple-700 via-purple-800 to-purple-950 text-white py-4 font-extrabold text-[18px] shadow-lg"
              >
                Encontrar conductor
              </button>
            </div>
          </div>
        </>
      )}

      {stopsPanelOpen && !vehiclePanel && !vehicleFound && !driverSelected && (
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
                  className="w-11 h-11 rounded-full bg-purple-700 text-white flex items-center justify-center"
                >
                  <i className="ri-add-line text-2xl"></i>
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              {cleanRouteStops.map((stop, index) => (
                <div key={`${stop}-${index}`} className="flex items-center gap-4">
                  <div className="w-8 text-center text-lg font-black text-gray-900">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-gray-900 truncate">
                      {stop}
                    </p>
                    <p className="text-sm text-gray-500">Parada de ruta</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeStop(index)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <i className="ri-close-line text-2xl text-gray-900"></i>
                  </button>
                </div>
              ))}

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
                + Agregar parada
              </button>
            </div>
          </div>
        </>
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
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-[24px] bg-white overflow-hidden h-[40%] shadow-2xl"
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
        />
      </div>
    </div>
  );
}

export default Home;