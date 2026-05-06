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

function Home() {
  const submitHandler = (e) => {
    e.preventDefault();
  };

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
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

  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const searchRef = useRef(null);
  const vehicleRef = useRef(null);
  const arrowRef = useRef(null);
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

  const formatAddressFromGeocoder = (result) => {
    if (!result) return "";

    const formatted = result.formatted_address || "";

    if (!formatted) return "";

    return formatted
      .replace(/, Colombia$/i, "")
      .replace(/, Antioquia$/i, ", Antioquia")
      .trim();
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
          console.warn("No se pudo convertir GPS en dirección:", error);
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
      setGpsError("Este dispositivo o navegador no permite usar GPS.");
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
          console.warn("GPS no autorizado o no disponible:", error);

          let message =
            "No pudimos activar tu ubicación. Puedes escribir tu punto de recogida manualmente.";

          if (error?.code === 1) {
            message =
              "Permiso de ubicación rechazado. Actívalo en el navegador para detectar tu punto de recogida.";
          }

          if (error?.code === 2) {
            message =
              "No pudimos detectar tu ubicación actual. Revisa el GPS o intenta escribir la dirección.";
          }

          if (error?.code === 3) {
            message =
              "La ubicación tardó demasiado. Intenta de nuevo o escribe la dirección manualmente.";
          }

          setGpsStatus("denied");
          setGpsError(message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 18000,
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
    if (!user?._id || !socket) return;

    return () => {
      if (watchLocationRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchLocationRef.current);
        watchLocationRef.current = null;
      }
    };
  }, [socket, user?._id]);

  const syncRideState = useCallback(
    (rideData) => {
      if (!rideData?._id) return;

      setRide((prev) => ({
        ...(prev || {}),
        ...(rideData || {}),
        _id: rideData?._id || prev?._id,
        pickup: rideData?.pickup || prev?.pickup || pickup,
        destination: rideData?.destination || prev?.destination || destination,
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

      if (rideData?.status === "ongoing") {
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

      if (rideData?.status === "completed") {
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
    [pickup, destination, navigate]
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
      console.log("[user socket] connected:", socket.id);
      emitJoin();
    };

    const onReconnect = () => {
      console.log("[user socket] reconnected:", socket.id);
      emitJoin();
    };

    const onSocketJoined = (payload) => {
      console.log("[user socket] socket-joined:", payload);
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on("connect", onConnect);
    socket.io?.on?.("reconnect", onReconnect);
    socket.on("socket-joined", onSocketJoined);

    return () => {
      socket.off("connect", onConnect);
      socket.io?.off?.("reconnect", onReconnect);
      socket.off("socket-joined", onSocketJoined);
    };
  }, [socket, user?._id, ride?._id]);

  useEffect(() => {
    if (!socket) return;

    const onRideStarted = (payload) => {
      const nextRide = normalizeSocketRide(payload) || ride;

      if (!nextRide?._id) {
        console.error("[user socket] ride-started sin ride válido:", payload);
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
      console.log("[user socket] captain-arrived:", payload);
      setCaptainArrived(true);

      const nextRide = normalizeSocketRide(payload);

      if (nextRide?._id) {
        setRide(nextRide);
      }

      alert(payload?.message || "Tu conductor ya llegó al punto de recogida.");
    };

    const onRideCancelledByCaptain = (payload) => {
      console.log("[user socket] ride-cancelled-by-captain:", payload);
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
          const { AutocompleteSuggestion } = await window.google.maps.importLibrary(
            "places"
          );

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
          console.warn(
            "Places autocomplete failed, using server fallback:",
            error?.message || error
          );
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
  }, [pickup, destination]);

  useEffect(() => {
    if (!vehiclePanel || !pickup || !destination || prices != null) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        setPricingError(null);

        const [pricesRes, distRes] = await Promise.all([
          axios.get(`${getApiBaseUrl()}/maps/get-prices`, {
            params: { origin: pickup, destination },
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${getApiBaseUrl()}/maps/get-distance`, {
            params: { origin: pickup, destination },
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
  }, [vehiclePanel, pickup, destination, prices]);

  const logoutUser = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.get(`${getApiBaseUrl()}/users/logout`, {
        params: { origin: pickup, destination },
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
    } else {
      setDestination(selectedText);
    }

    setSuggestions([]);
    setPanelOpen(false);

    const nextPickup = activeInput === "pickup" ? selectedText : pickup;
    const nextDestination =
      activeInput === "destination" ? selectedText : destination;

    if (nextPickup && nextDestination) {
      setVehiclePanel(true);
    }
  };

  const handleFindDriver = async () => {
    if (!pickup) {
      const gpsResult = await requestGpsLocation();

      if (!gpsResult?.address && !gpsResult?.lat) {
        alert(
          "Primero activa tu ubicación GPS o escribe manualmente el punto de recogida."
        );
        return;
      }
    }

    if (!destination || destination.trim().length < 3) {
      setPanelOpen(true);
      setActiveInput("destination");
      alert("Ingresa tu destino para encontrar un conductor.");
      return;
    }

    setPanelOpen(false);
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
  }, [vehicleFound, driverSelected, ride?._id, pickup, destination]);

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

  useGSAP(() => {
    if (panelOpen) {
      gsap.to(titleRef.current, { display: "none", duration: 0.3 });

      gsap.to(panelRef.current, {
        height: "68%",
        display: "flex",
        duration: 0.5,
        delay: 0.2,
        opacity: 1,
      });

      gsap.to(arrowRef.current, {
        display: "block",
        duration: 0.5,
        delay: 0.5,
      });
    } else {
      gsap.to(arrowRef.current, { display: "none", duration: 0.3 });

      gsap.to(panelRef.current, {
        height: "0%",
        display: "none",
        duration: 0.5,
        delay: 0.2,
        opacity: 0,
      });

      gsap.to(titleRef.current, {
        display: "block",
        duration: 0.5,
        delay: 0.3,
      });
    }
  }, [panelOpen]);

  useEffect(() => {
    if (gpsStatus === "granted") {
      startGpsWatch();
    }
  }, [gpsStatus, startGpsWatch]);

  const isFindDisabled =
    gpsStatus === "loading" || !destination || destination.trim().length < 3;

  return (
    <div className="h-screen relative w-screen overflow-hidden bg-slate-950">
      <div>
        <img
          className="absolute w-20 ml-7 pt-7 z-30 drop-shadow-xl"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <Link
        onClick={logoutUser}
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black/85 backdrop-blur flex items-center justify-center z-50 shadow-xl"
      >
        <i
          style={{ color: "white" }}
          className="ri-logout-box-line ri-xl mb mr-0.5"
        ></i>
      </Link>

      <div
        className="absolute w-screen h-[100%] top-0 z-20"
        onClick={() => {
          setPanelOpen(false);
          setSuggestions([]);
        }}
      >
        <LiveTracking
          pickup={driverSelected ? ride?.pickup || pickup : pickup}
          nearbyDrivers={nearbyDrivers}
          showPickupRadar={vehicleFound && !driverSelected}
          selectedCaptainId={ride?.captain?._id || null}
          showRouteToPickup={driverSelected}
          onEtaUpdate={setEtaInfo}
        />
      </div>

      <div className="absolute top-28 left-4 right-4 z-30 pointer-events-none">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-4 py-2 shadow-xl border border-white/70">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              gpsStatus === "granted"
                ? "bg-emerald-500"
                : gpsStatus === "loading"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          ></span>
          <span className="text-xs font-bold text-gray-800">
            {gpsStatus === "granted"
              ? "GPS activo"
              : gpsStatus === "loading"
              ? "Detectando ubicación..."
              : "Activa tu ubicación"}
          </span>
        </div>
      </div>

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
                      <p className="text-lg font-extrabold text-emerald-700">
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
                      className="w-full rounded-2xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{
                        background:
                          "linear-gradient(to right, #1d976c, #93f9b9)",
                      }}
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

      <div
        ref={searchRef}
        className="absolute flex flex-col justify-end top-0 h-screen w-full rounded-t-lg z-40 pointer-events-none"
      >
        <div className="px-4 pb-4 pointer-events-auto">
          <div className="bg-white rounded-[32px] p-5 shadow-2xl border border-white/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-[0.18em]">
                  Central Go
                </p>

                <h4 ref={titleRef} className="text-3xl font-black text-gray-950 mt-1 leading-tight">
                  ¿A dónde vamos?
                </h4>

                <p className="text-sm text-gray-500 mt-1">
                  Activa tu GPS, confirma tu recogida y encuentra un conductor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPanelOpen(false);
                }}
                ref={arrowRef}
                className="hidden w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
              >
                <i className="ri-arrow-down-s-line text-2xl text-gray-900"></i>
              </button>
            </div>

            {gpsStatus !== "granted" && (
              <div className="mt-4 rounded-[24px] bg-gradient-to-br from-purple-700 to-slate-950 p-4 text-white shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                    <i className="ri-map-pin-user-fill text-2xl"></i>
                  </div>

                  <div className="flex-1">
                    <p className="text-base font-black">
                      Activa tu ubicación GPS
                    </p>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed">
                      Así llenamos automáticamente tu punto de recogida y los
                      conductores podrán encontrarte mejor.
                    </p>

                    {gpsError && (
                      <p className="text-xs text-red-100 mt-2 font-semibold">
                        {gpsError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={requestGpsLocation}
                      disabled={gpsStatus === "loading"}
                      className="mt-3 w-full rounded-2xl bg-white text-purple-800 py-3 font-black text-sm disabled:opacity-70"
                    >
                      {gpsStatus === "loading"
                        ? "Detectando ubicación..."
                        : "Activar ubicación"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gpsStatus === "granted" && pickupDetected && (
              <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                  <i className="ri-check-line text-white text-xl"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-900">
                    Ubicación detectada
                  </p>
                  <p className="text-xs text-emerald-700 truncate">
                    {pickup}
                  </p>
                </div>
              </div>
            )}

            <form className="relative mt-4" onSubmit={submitHandler}>
              <div className="absolute left-5 top-[31px] bottom-[31px] w-[3px] bg-gray-200 rounded-full">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-3.5 w-3.5 bg-purple-700 rounded-full border-2 border-white shadow"></div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-3.5 w-3.5 bg-slate-950 rounded-full border-2 border-white shadow"></div>
              </div>

              <div className="relative">
                <i className="ri-map-pin-user-fill absolute left-11 top-1/2 -translate-y-1/2 text-purple-700 text-xl"></i>

                <input
                  value={pickup}
                  onClick={() => {
                    setPanelOpen(true);
                    setActiveInput("pickup");
                  }}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setPickupDetected(false);
                    fetchSuggestions(e.target.value);
                  }}
                  className="bg-gray-100 border border-gray-200 rounded-2xl px-3 py-4 text-base w-full mt-2 mb-2 pl-[76px] pr-4 font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  type="text"
                  placeholder={
                    gpsStatus === "loading"
                      ? "Detectando tu punto de recogida..."
                      : "Agregar punto de recogida"
                  }
                />
              </div>

              <div className="relative">
                <i className="ri-flag-2-fill absolute left-11 top-1/2 -translate-y-1/2 text-slate-950 text-xl"></i>

                <input
                  value={destination}
                  onClick={() => {
                    setPanelOpen(true);
                    setActiveInput("destination");
                  }}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    fetchSuggestions(e.target.value);
                  }}
                  className="bg-gray-100 border border-gray-200 rounded-2xl px-3 py-4 text-base w-full mt-2 mb-2 pl-[76px] pr-4 font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  type="text"
                  placeholder="¿Para dónde vas?"
                />
              </div>
            </form>

            <button
              type="button"
              onClick={handleFindDriver}
              disabled={gpsStatus === "loading"}
              className="mt-3 w-full rounded-[24px] bg-gradient-to-r from-purple-700 via-purple-800 to-slate-950 text-white px-4 py-4 flex items-center justify-between shadow-xl disabled:opacity-70"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <i className="ri-steering-2-fill text-xl"></i>
                </div>

                <div className="text-left">
                  <p className="text-base font-black">Encontrar conductor</p>
                  <p className="text-xs text-white/80">
                    Mira precios y vehículos disponibles
                  </p>
                </div>
              </div>

              <i className="ri-arrow-right-line text-2xl"></i>
            </button>

            <button
              type="button"
              onClick={goToAvailableOffers}
              className="mt-3 w-full rounded-[22px] bg-gray-950 text-white px-4 py-3 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                  <i className="ri-fire-line text-xl"></i>
                </div>

                <div className="text-left">
                  <p className="text-sm font-black">Ofertas disponibles</p>
                  <p className="text-xs text-white/70">
                    Mercancía, espacio y cupos en ruta
                  </p>
                </div>
              </div>

              <i className="ri-arrow-right-line text-xl"></i>
            </button>
          </div>
        </div>

        <div
          ref={panelRef}
          className="opacity-0 bg-white flex flex-col justify-start pl-5 pr-2 z-50 pointer-events-auto rounded-t-[28px] shadow-2xl"
        >
          <LocationSearchPanel
            vehiclePanel={vehiclePanel}
            setVehiclePanel={setVehiclePanel}
            panelOpen={panelOpen}
            setPanelOpen={setPanelOpen}
            setConfirmRidePanel={setConfirmRidePanel}
            suggestions={suggestions}
            onSuggestionSelect={handleSuggestionSelect}
          />
        </div>
      </div>

      <div
        ref={vehicleRef}
        className="fixed min-h-[35%] bottom-0 w-screen translate-y-full max-h-[50%] rounded-t-[28px] bg-white overflow-auto z-50 shadow-2xl"
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
        className="fixed bottom-0 w-screen translate-y-full rounded-t-[28px] bg-white overflow-hidden z-50 shadow-2xl"
      >
        <ConfirmedRide
          setConfirmRidePanel={setConfirmRidePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          createRide={createRide}
        />
      </div>

      <div
        ref={vehicleFoundRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-[28px] bg-white overflow-hidden h-[40%] shadow-2xl"
      >
        <FindingDriver
          setConfirmRidePanel={setConfirmRidePanel}
          setVehicleFound={setVehicleFound}
          vehicleFound={vehicleFound}
          selectedPrice={offeredPrice ?? selectedPrice}
          selectedVehicle={selectedVehicle}
          destination={destination}
          pickup={pickup}
          ride={ride}
        />
      </div>

      <div
        ref={driverSelectedRef}
        className="fixed z-50 bottom-0 w-screen translate-y-full rounded-t-[28px] bg-white overflow-auto max-h-[72%] shadow-2xl"
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