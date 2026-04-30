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
  const [etaInfo, setEtaInfo] = useState({
    etaText: "",
    distanceText: "",
  });

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

  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const { isLoaded: mapsApiLoaded } = useGoogleMapsScript();
  const navigate = useNavigate();

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
  }, [socket, user?._id]);

  useEffect(() => {
    if (!socket) return;

    const onRideStarted = (payload) => {
  const nextRide = payload?.ride || payload || ride;

  if (!nextRide?._id) {
    console.error("[user socket] ride-started sin ride válido:", payload);
    alert("El viaje inició, pero no se pudo cargar la información completa.");
    return;
  }

  setRide(nextRide);
  setCaptainArrived(false);
  setDriverSelected(false);
  setVehicleFound(false);
  setConfirmRidePanel(false);
  setVehiclePanel(false);

  navigate("/riding", {
    state: {
      ride: nextRide,
    },
  });
};

    const onRideConfirmed = (rideData) => {
      setCaptainArrived(false);
      setVehicleFound(false);
      setConfirmRidePanel(false);
      setVehiclePanel(false);
      setDriverSelected(true);
      setRide(rideData || null);
    };

    const onRideOfferUpdated = (rideData) => {
      const nextRide = rideData || null;

      setRide((prev) => ({
        ...(prev || {}),
        ...(nextRide || {}),
        _id: nextRide?._id || prev?._id,
        pickup: nextRide?.pickup || prev?.pickup || pickup,
        destination: nextRide?.destination || prev?.destination || destination,
      }));

      if (nextRide?._id) {
        setVehiclePanel(false);
        setConfirmRidePanel(false);
        setDriverSelected(false);
        setVehicleFound(true);
      }
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

      if (payload?.ride) {
        setRide(payload.ride);
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
    socket.on("nearby-captains", onNearbyCaptains);
    socket.on("captain-location-updated", onCaptainLocationUpdated);
    socket.on("captain-arrived", onCaptainArrived);
    socket.on("ride-cancelled-by-captain", onRideCancelledByCaptain);

    return () => {
      socket.off("ride-started", onRideStarted);
      socket.off("ride-confirmed", onRideConfirmed);
      socket.off("ride-offer-updated", onRideOfferUpdated);
      socket.off("nearby-captains", onNearbyCaptains);
      socket.off("captain-location-updated", onCaptainLocationUpdated);
      socket.off("captain-arrived", onCaptainArrived);
      socket.off("ride-cancelled-by-captain", onRideCancelledByCaptain);
    };
  }, [socket, navigate, pickup, destination]);

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
          const { AutocompleteSuggestion } = await google.maps.importLibrary(
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
      .filter((offer) => {
        if (offer?.status !== "pending") return false;
        return getOfferExpiresAtMs(offer) > offerNow;
      })
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
    try {
      const token = localStorage.getItem("token");
      if (!ride?._id || !captainId) return;

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

      setRide(response?.data || ride);
      setVehicleFound(false);
      setDriverSelected(true);
      setCaptainArrived(false);
    } catch (error) {
      console.error("Error aceptando oferta:", error);

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo aceptar la oferta."
      );
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
    if (!user?._id || !navigator.geolocation || !socket) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        socket.emit("update-location-user", {
          userId: user._id,
          location: {
            ltd: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (error) => {
        console.warn("No se pudo obtener la ubicación del usuario:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?._id, socket]);

  return (
    <div className="h-screen position-relative w-screen">
      <div>
        <img
          className="absolute w-20 ml-7 pt-7 z-30"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <Link
        onClick={logoutUser}
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-50"
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
                        Expira en {secondsLeft}s
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
                      onClick={() => acceptOffer(captainId)}
                      className="w-full rounded-2xl py-2.5 text-sm font-semibold text-white"
                      style={{
                        background: "linear-gradient(to right, #1d976c, #93f9b9)",
                      }}
                    >
                      Aceptar
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
        className="absolute flex flex-col justify-end top-0 h-screen w-full rounded-t-lg"
      >
        <div className="h-[40%] bg-white p-5 flex flex-col justify-around z-50">
          <div>
            <h4 ref={titleRef} className="text-3xl font-semibold ml-1">
              Buscar un servicio
            </h4>

            <i
              onClick={() => {
                setPanelOpen(false);
              }}
              ref={arrowRef}
              className="ri-arrow-down-s-line text-2xl hidden"
            ></i>
          </div>

          <form className="relative mt-2" onSubmit={submitHandler}>
            <div className="line absolute self-center h-[51%] w-1 bottom-1/4 ml-8 bg-black rounded-3xl">
              <div className="circle absolute h-3 w-3 bg-black rounded-full top-0 ml-[-4px]"></div>
              <div className="circle absolute h-3 w-3 bg-black rounded-full bottom-0 ml-[-4px]"></div>
            </div>

            <input
              value={pickup}
              onClick={() => {
                setPanelOpen(true);
                setActiveInput("pickup");
              }}
              onChange={(e) => {
                setPickup(e.target.value);
                fetchSuggestions(e.target.value);
              }}
              className="bg-[#eee] rounded-lg px-3 py-3 text-lg w-full mt-2 mb-2 pl-16"
              type="text"
              placeholder="Agregar punto de recogida"
            />

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
              className="bg-[#eee] rounded-lg px-3 py-3 text-lg w-full mt-2 mb-2 pl-16"
              type="text"
              placeholder="Ingresa tu destino"
            />
          </form>

          <div className="mt-3">
            <button
              type="button"
              onClick={goToAvailableOffers}
              className="w-full rounded-[24px] bg-black text-white px-4 py-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  <i className="ri-fire-line text-xl"></i>
                </div>

                <div className="text-left">
                  <p className="text-base font-bold">Ofertas disponibles</p>
                  <p className="text-xs text-white/80">
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
          className="opacity-0 bg-white flex flex-col justify-start pl-5 pr-2 z-50"
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
        className="fixed min-h-[35%] bottom-0 w-screen translate-y-full max-h-[50%] rounded-t-lg bg-white overflow-auto z-50"
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
        className="fixed bottom-0 w-screen translate-y-full rounded-t-lg bg-white overflow-hidden z-50"
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