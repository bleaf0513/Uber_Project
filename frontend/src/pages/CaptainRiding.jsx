import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import axios from "axios";
import "remixicon/fonts/remixicon.css";
import LiveTracking from "../../components/LiveTracking";
import { ToastContainer, toast } from "react-toastify";
import { getApiBaseUrl } from "../apiBase";
import { SocketContext } from "../context/SocketContext";
import { CaptainDataContext } from "../context/CaptainContext";

const CANCEL_REASONS = [
  "Usuario no contesta",
  "Usuario no aparece",
  "Dirección incorrecta",
  "Zona insegura",
  "Problema con el vehículo",
  "Tráfico o cierre de vía",
  "El usuario canceló verbalmente",
  "Otro motivo",
];

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";

const CaptainRiding = () => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  const [sendingArrived, setSendingArrived] = useState(false);
  const [sendingCancel, setSendingCancel] = useState(false);
  const [startingRide, setStartingRide] = useState(false);
  const [startingScheduledDispatch, setStartingScheduledDispatch] = useState(false);
  const [finishingRide, setFinishingRide] = useState(false);

  const [driverArrived, setDriverArrived] = useState(false);
  const [userConfirmedPickup, setUserConfirmedPickup] = useState(false);
  const [rideStarted, setRideStarted] = useState(false);
  const [rideFinished, setRideFinished] = useState(false);
  const [scheduledPanelMinimized, setScheduledPanelMinimized] = useState(false);

  const [loadingActiveRide, setLoadingActiveRide] = useState(false);
  const [triedLoadingActiveRide, setTriedLoadingActiveRide] = useState(false);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [sendingRating, setSendingRating] = useState(false);

  const [etaInfo, setEtaInfo] = useState({
    etaText: "",
    distanceText: "",
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  const cancelModalRef = useRef(null);
  const ratingModalRef = useRef(null);
  const messagesEndRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const initialRideData = location.state?.ride || null;

  const [currentRide, setCurrentRide] = useState(initialRideData);

  const { socket } = useContext(SocketContext);
  const { captain } = useContext(CaptainDataContext);

  const quickMessages = useMemo(
    () => [
      "Ya llegué a recoger",
      "Voy en camino",
      "Estoy en la entrada",
      "No veo el punto exacto",
      "¿Me confirmas dónde estás?",
    ],
    []
  );

  const syncRideState = (rideData) => {
    if (!rideData?._id) return;

    setCurrentRide(rideData);

    setDriverArrived(
      Boolean(rideData?.arrivedAtPickup) || rideData?.status === "arrived"
    );

    setUserConfirmedPickup(Boolean(rideData?.userConfirmedAtPickup));
    setRideStarted(rideData?.status === "ongoing");
    setRideFinished(rideData?.status === "completed");
  };

  useEffect(() => {
    if (!currentRide) return;

    syncRideState(currentRide);
  }, [
    currentRide?._id,
    currentRide?.status,
    currentRide?.userConfirmedAtPickup,
    currentRide?.arrivedAtPickup,
  ]);

  useEffect(() => {
    const loadCaptainActiveRide = async () => {
      try {
        if (currentRide?._id) {
          setTriedLoadingActiveRide(true);
          return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/captain-login");
          return;
        }

        setLoadingActiveRide(true);

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
          syncRideState(activeRide);
        }

        setTriedLoadingActiveRide(true);
      } catch (error) {
        console.error("Error cargando carrera activa del conductor:", error);
        setTriedLoadingActiveRide(true);
      } finally {
        setLoadingActiveRide(false);
      }
    };

    loadCaptainActiveRide();
  }, [currentRide?._id, navigate]);

  useGSAP(() => {
    if (showCancelModal) {
      gsap.to(cancelModalRef.current, {
        y: "0%",
        opacity: 1,
        duration: 0.25,
        ease: "power2.out",
      });
    } else {
      gsap.to(cancelModalRef.current, {
        y: "100%",
        opacity: 0,
        duration: 0.2,
        ease: "power2.inOut",
      });
    }
  }, [showCancelModal]);

  useGSAP(() => {
    if (showRatingModal) {
      gsap.to(ratingModalRef.current, {
        y: "0%",
        opacity: 1,
        duration: 0.25,
        ease: "power2.out",
      });
    } else {
      gsap.to(ratingModalRef.current, {
        y: "100%",
        opacity: 0,
        duration: 0.2,
        ease: "power2.inOut",
      });
    }
  }, [showRatingModal]);

  useEffect(() => {
    if (!socket || !captain?._id) return;

    const emitJoin = () => {
      socket.emit("join", {
        userId: captain._id,
        userType: "captain",
      });

      if (currentRide?._id) {
        socket.emit("join-ride", {
          rideId: currentRide._id,
        });
      }

      console.log("[CAPTAIN] join emitido:", {
        captainId: captain._id,
        rideId: currentRide?._id || null,
        socketId: socket.id,
      });
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on("connect", emitJoin);

    return () => {
      socket.off("connect", emitJoin);
    };
  }, [socket, captain?._id, currentRide?._id]);

  useEffect(() => {
    if (!currentRide?._id) {
      setMessages([]);
      setChatOpen(false);
      setHasUnreadMessage(false);
    }
  }, [currentRide?._id]);

  useEffect(() => {
    if (!chatOpen) return;

    setHasUnreadMessage(false);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!socket || !currentRide?._id) return;

    const handleRideMessage = (payload) => {
      console.log("[CAPTAIN CHAT] Mensaje recibido:", payload);

      if (!payload?.rideId) return;
      if (String(payload.rideId) !== String(currentRide._id)) return;

      const nextMessage = {
        id: payload?._id || `${Date.now()}-${Math.random()}`,
        rideId: payload.rideId,
        senderType: payload.senderType || payload.from || "user",
        from: payload.from || payload.senderType || "user",
        text: payload.message || payload.text || "",
        message: payload.message || payload.text || "",
        createdAt: payload.createdAt || new Date().toISOString(),
      };

      if (!nextMessage.text) return;

      setMessages((prev) => {
        const exists = prev.some(
          (msg) => String(msg.id) === String(nextMessage.id)
        );

        if (exists) return prev;

        return [...prev, nextMessage];
      });

      if (!chatOpen && nextMessage.senderType !== "captain") {
        setHasUnreadMessage(true);
      }
    };

    const handleRideUpdated = (payload) => {
      const rideData = payload?.ride || payload;
      const rideId = String(rideData?._id || payload?.rideId || "");

      if (!rideId || rideId !== String(currentRide._id)) return;

      syncRideState(rideData);
    };

    const handleUserConfirmedPickup = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");
      if (rideId !== String(currentRide._id)) return;

      const nextRide = payload?.ride || null;

      if (nextRide) {
        syncRideState(nextRide);
      } else {
        setUserConfirmedPickup(true);
      }

      toast.success("El usuario confirmó que ya está en el punto.");
    };

    const handleRideStarted = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");
      if (rideId !== String(currentRide._id)) return;

      if (payload?.ride) {
        syncRideState(payload.ride);
      }

      setRideStarted(true);
      toast.success("Domicilio iniciado.");
    };

    const handleRideEnded = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");
      if (rideId !== String(currentRide._id)) return;

      if (payload?.ride) {
        syncRideState(payload.ride);
      }

      setRideFinished(true);
      setShowRatingModal(true);
    };

    socket.on("ride-message", handleRideMessage);
    socket.on("ride-chat-message", handleRideMessage);
    socket.on("user-confirmed-at-pickup", handleUserConfirmedPickup);
    socket.on("user-confirmed-pickup", handleUserConfirmedPickup);
    socket.on("ride-updated", handleRideUpdated);
    socket.on("ride-started", handleRideStarted);
    socket.on("ride-ended", handleRideEnded);

    return () => {
      socket.off("ride-message", handleRideMessage);
      socket.off("ride-chat-message", handleRideMessage);
      socket.off("user-confirmed-at-pickup", handleUserConfirmedPickup);
      socket.off("user-confirmed-pickup", handleUserConfirmedPickup);
      socket.off("ride-updated", handleRideUpdated);
      socket.off("ride-started", handleRideStarted);
      socket.off("ride-ended", handleRideEnded);
    };
  }, [socket, currentRide?._id, chatOpen]);

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return { firstPart: "", secondPart: "" };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: safeAddress, secondPart: "" };
    }

    return {
      firstPart: safeAddress.substring(0, firstCommaIndex).trim(),
      secondPart: safeAddress.substring(firstCommaIndex + 1).trim(),
    };
  };

  const formatRideDistance = (value) => {
    const raw = Number(value);

    if (!Number.isFinite(raw) || raw <= 0) {
      return "-- km";
    }

    const km = raw > 300 ? raw / 1000 : raw;

    if (km >= 1000) {
      return "-- km";
    }

    if (km >= 10) {
      return `${km.toFixed(1)} km`;
    }

    return `${km.toFixed(2)} km`;
  };

  const formatRideDuration = (value) => {
    const seconds = Number(value);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "-- min";
    }

    const minutes = Math.max(1, Math.round(seconds / 60));

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours} h ${remainingMinutes} min`
      : `${hours} h`;
  };

  const getUserPhoto = () =>
    currentRide?.user?.profileImage ||
    currentRide?.user?.photo ||
    currentRide?.user?.avatar ||
    currentRide?.user?.image ||
    currentRide?.user?.profilePic ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const getVehicleLabel = (vehicleType) => {
    const labels = {
      motorcycle: "Moto",
      car: "Carro",
      motocarro: "Motocarro",
      pickup: "Camioneta",
      light_cargo: "Carga liviana",
      van: "Van / Furgón",
      truck: "Camión",
      moving: "Mudanza",
    };

    return labels[vehicleType] || "Vehículo";
  };

  const shouldNavigateToDestination =
    rideStarted || currentRide?.status === "ongoing";

  const getNavigationTargetAddress = () => {
    if (shouldNavigateToDestination) {
      return currentRide?.destination || "";
    }

    return currentRide?.pickup || "";
  };

  const getNavigationTargetLabel = () => {
    return shouldNavigateToDestination ? "destino" : "punto de recogida";
  };

  const openWazeNavigation = () => {
    const address = getNavigationTargetAddress();

    if (!address) {
      toast.error("No hay dirección disponible para navegar.");
      return;
    }

    const encodedAddress = encodeURIComponent(address);

    window.open(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`, "_blank");
  };

  const openGoogleMapsNavigation = () => {
    const address = getNavigationTargetAddress();

    if (!address) {
      toast.error("No hay dirección disponible para navegar.");
      return;
    }

    const encodedAddress = encodeURIComponent(address);

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`,
      "_blank"
    );
  };

  const sendMessage = async (textToSend = "") => {
    const cleanText = String(textToSend || messageText || "").trim();

    if (!cleanText || !currentRide?._id || sendingMessage) return;

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("No hay sesión activa.");
      return;
    }

    const tempMessage = {
      id: `local-${Date.now()}-${Math.random()}`,
      rideId: currentRide._id,
      senderType: "captain",
      from: "captain",
      text: cleanText,
      message: cleanText,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessageText("");

    try {
      setSendingMessage(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/captain-chat-message`,
        {
          rideId: currentRide._id,
          message: cleanText,
          senderType: "captain",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const serverMessage = response?.data?.data;

      if (serverMessage?._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id
              ? {
                  id: serverMessage._id,
                  rideId: serverMessage.rideId,
                  senderType: serverMessage.senderType || "captain",
                  from: serverMessage.from || "captain",
                  text: serverMessage.text || serverMessage.message || cleanText,
                  message:
                    serverMessage.message || serverMessage.text || cleanText,
                  createdAt: serverMessage.createdAt || tempMessage.createdAt,
                  pending: false,
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id ? { ...msg, pending: false } : msg
          )
        );
      }
    } catch (error) {
      console.error("Error enviando mensaje al usuario:", error);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessage.id
            ? {
                ...msg,
                pending: false,
                failed: true,
              }
            : msg
        )
      );

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo enviar el mensaje."
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartScheduledDispatch = async () => {
    if (!currentRide?._id || startingScheduledDispatch) return;

    try {
      setStartingScheduledDispatch(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/start-scheduled-dispatch`,
        { rideId: currentRide._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const nextRide = response?.data?.ride || currentRide;

      if (nextRide?._id) {
        syncRideState(nextRide);
      }

      toast.success(
        "Domicilio iniciado. Ahora sí puedes dirigirte al punto de recogida."
      );
    } catch (error) {
      console.error("Error iniciando domicilio programado:", error);

      toast.error(
        error?.response?.data?.message ||
          "No se pudo iniciar el domicilio programado."
      );
    } finally {
      setStartingScheduledDispatch(false);
    }
  };

  const handleArrived = async () => {
    if (!currentRide?._id || sendingArrived) return;

    try {
      setSendingArrived(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/arrived`,
        { rideId: currentRide._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const nextRide = response?.data?.ride;

      if (nextRide) {
        syncRideState(nextRide);
      }

      setDriverArrived(true);
      setUserConfirmedPickup(false);

      toast.success(
        "Se notificó al usuario que ya llegaste. Espera su confirmación."
      );
    } catch (error) {
      console.error("Error notificando llegada:", error);
      toast.error(
        error?.response?.data?.message ||
          "No se pudo notificar al usuario que ya llegaste."
      );
    } finally {
      setSendingArrived(false);
    }
  };

  const handleStartRide = async () => {
    if (!currentRide?._id || startingRide) return;

    if (!userConfirmedPickup && !currentRide?.userConfirmedAtPickup) {
      toast.info("Espera a que el usuario confirme que ya está en el punto.");
      return;
    }

    try {
      setStartingRide(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/start-ride`,
        { rideId: currentRide._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const nextRide = response?.data?.ride;

      if (nextRide) {
        syncRideState(nextRide);
      }

      setRideStarted(true);
      toast.success("Domicilio iniciado. Ahora navega hacia el destino.");

      setTimeout(() => {
        openWazeNavigation();
      }, 600);
    } catch (error) {
      console.error("Error iniciando viaje:", error);
      toast.error(
        error?.response?.data?.message || "No se pudo iniciar el domicilio."
      );
    } finally {
      setStartingRide(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide?._id || sendingCancel) return;

    if (!selectedReason) {
      toast.error("Selecciona un motivo de cancelación.");
      return;
    }

    try {
      setSendingCancel(true);

      await axios.post(
        `${getApiBaseUrl()}/rides/cancel-by-captain`,
        {
          rideId: currentRide._id,
          reason: selectedReason,
          notes: cancelNotes || "",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      toast.success("Solicitud cancelada correctamente.");
      setShowCancelModal(false);
      navigate("/captain-home");
    } catch (error) {
      console.error("Error cancelando solicitud:", error);
      toast.error(
        error?.response?.data?.message || "No se pudo cancelar la solicitud."
      );
    } finally {
      setSendingCancel(false);
    }
  };

  const handleFinishRide = async () => {
    if (!currentRide?._id || finishingRide) return;

    if (!rideStarted && currentRide?.status !== "ongoing") {
      toast.info("Primero debes iniciar el domicilio.");
      return;
    }

    try {
      setFinishingRide(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/end-ride`,
        { rideId: currentRide._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const nextRide = response?.data?.ride || response?.data;

      if (nextRide?._id) {
        syncRideState(nextRide);
      }

      setRideFinished(true);
      toast.success("Recorrido finalizado correctamente.");
      setShowRatingModal(true);
    } catch (error) {
      console.error("Error finalizando recorrido:", error);
      toast.error(
        error?.response?.data?.message || "No se pudo finalizar el recorrido."
      );
    } finally {
      setFinishingRide(false);
    }
  };

  const handleRateUser = async () => {
    if (!currentRide?._id || sendingRating) return;

    try {
      setSendingRating(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/rate-user`,
        {
          rideId: currentRide._id,
          rating: ratingValue,
          comment: ratingComment,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const nextRide = response?.data?.ride;

      if (nextRide) {
        syncRideState(nextRide);
      }

      toast.success("Calificación enviada correctamente.");
      setShowRatingModal(false);
      navigate("/captain-home", {
        state: {
          finishedRide: nextRide || currentRide,
          ratedUser: true,
        },
      });
    } catch (error) {
      console.error("Error calificando usuario:", error);
      toast.error(
        error?.response?.data?.message || "No se pudo enviar la calificación."
      );
    } finally {
      setSendingRating(false);
    }
  };

  const handleSecurity = () => {
    toast.info("Centro de seguridad próximamente disponible.");
  };

  if (loadingActiveRide || (!currentRide && !triedLoadingActiveRide)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center"
            style={{ background: PURPLE_GRADIENT }}
          >
            <i className="ri-loader-4-line text-4xl text-white animate-spin"></i>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mt-5">
            Cargando servicio activo
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            Estamos recuperando la carrera del conductor.
          </p>
        </div>
      </div>
    );
  }

  if (!currentRide) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            No hay información del servicio
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            No encontramos una carrera activa para este conductor.
          </p>

          <Link
            to="/captain-home"
            className="inline-flex mt-5 rounded-2xl bg-black text-white px-5 py-3 font-semibold"
          >
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  const pickupAddress = formatAddress(currentRide?.pickup);
  const destinationAddress = formatAddress(currentRide?.destination);

  const routeStops = Array.isArray(currentRide?.routeStops)
    ? currentRide.routeStops.filter(Boolean)
    : [];

  const rideDistanceText = formatRideDistance(currentRide?.distance);
  const rideDurationText = formatRideDuration(currentRide?.duration);

  const userFullName =
    `${currentRide?.user?.fullname?.firstname || ""} ${
      currentRide?.user?.fullname?.lastname || ""
    }`.trim() || "Usuario";

  const userRatingRaw = Number(currentRide?.user?.rating);
  const userRating = Number.isFinite(userRatingRaw)
    ? Math.min(5, Math.max(0, userRatingRaw))
    : 5;

  const userRatingCountRaw = Number(currentRide?.user?.ratingCount);
  const userRatingCount =
    Number.isFinite(userRatingCountRaw) && userRatingCountRaw > 0
      ? Math.floor(userRatingCountRaw)
      : 0;

  const userPhone =
    currentRide?.user?.phone ||
    currentRide?.user?.phoneNumber ||
    currentRide?.user?.mobile ||
    "Sin teléfono";

  const vehicleType =
    currentRide?.captain?.vehicle?.vehicleType ||
    currentRide?.captain?.vehicleType ||
    currentRide?.vehicleType ||
    currentRide?.vehicle ||
    "car";

  const vehicleLabel = getVehicleLabel(vehicleType);

  const plate =
    currentRide?.captain?.vehicle?.plate ||
    currentRide?.captain?.plate ||
    "Sin placa";

  const color =
    currentRide?.captain?.vehicle?.color ||
    currentRide?.captain?.vehicleColor ||
    "Color no disponible";

  const fare = currentRide?.fare ?? currentRide?.offeredFare ?? 0;

  const isScheduledService =
    currentRide?.serviceTiming === "scheduled" ||
    Boolean(currentRide?.schedule?.pickupStartAt);

  const scheduledDispatchStarted =
    Boolean(currentRide?.scheduledDispatchStartedAt);

  const isScheduledReserved =
    isScheduledService &&
    currentRide?.status === "accepted" &&
    !scheduledDispatchStarted &&
    !rideStarted;

  const scheduledPickupText = (() => {
    const raw = currentRide?.schedule?.pickupStartAt;

    if (!raw) return "Horario programado";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Horario programado";

    return new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(date);
  })();

  const canStartRide =
    driverArrived &&
    (userConfirmedPickup || currentRide?.userConfirmedAtPickup) &&
    !rideStarted &&
    currentRide?.status !== "ongoing" &&
    currentRide?.status !== "completed";

  const canFinishRide = rideStarted || currentRide?.status === "ongoing";

  const headerStatus = rideFinished
    ? "Domicilio finalizado"
    : rideStarted || currentRide?.status === "ongoing"
    ? "Domicilio iniciado"
    : userConfirmedPickup || currentRide?.userConfirmedAtPickup
    ? "Mercancía lista"
    : driverArrived
    ? "Esperando carga"
    : "En camino a recoger";

  const headerSubtext = rideFinished
    ? "El domicilio terminó. Califica el servicio para cerrarlo."
    : rideStarted || currentRide?.status === "ongoing"
    ? "Dirígete al destino con Waze o Google Maps."
    : userConfirmedPickup || currentRide?.userConfirmedAtPickup
    ? "El usuario confirmó que la mercancía está lista para cargar. Puedes continuar con el domicilio."
    : driverArrived
    ? "El usuario recibió la notificación. Debe confirmar tocando “Mercancía lista para cargar”."
    : etaInfo?.etaText
    ? `Tiempo estimado: ${etaInfo.etaText}${
        etaInfo?.distanceText ? ` · ${etaInfo.distanceText}` : ""
      }`
    : "Dirígete al punto de recogida de la mercancía.";

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute inset-0 z-10">
        <LiveTracking
          pickup={currentRide?.pickup || ""}
          destination={currentRide?.destination || ""}
          routeStops={routeStops}
          selectedCaptainId={currentRide?.captain?._id || null}
          showRouteToPickup={!isScheduledReserved && !shouldNavigateToDestination}
          showPickupRadar={false}
          autoFetchNearbyDrivers={false}
          onEtaUpdate={setEtaInfo}
        />
      </div>

      <div className="absolute top-3 left-3 z-40">
        <Link
          to="/captain-home"
          className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center"
        >
          <i className="ri-arrow-left-line text-xl text-gray-900"></i>
        </Link>
      </div>

      <Link
        to="/captain-logout"
        className="absolute top-3 right-3 w-12 h-12 rounded-full bg-black flex items-center justify-center z-40"
      >
        <i className="ri-logout-box-line ri-xl text-white"></i>
      </Link>

      <button
        type="button"
        onClick={() => {
          setChatOpen(true);
          setHasUnreadMessage(false);
        }}
        className="absolute top-[72px] right-3 z-40 w-14 h-14 rounded-full shadow-xl flex items-center justify-center"
        style={{
          background: PURPLE_GRADIENT,
        }}
      >
        {hasUnreadMessage && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
        )}

        <i className="ri-message-3-line text-3xl text-white"></i>
      </button>

      {isScheduledReserved && !scheduledPanelMinimized && (
        <div className="absolute inset-x-0 bottom-0 z-50 px-3 pb-3">
          <div className="rounded-[28px] bg-white shadow-2xl border border-purple-100 overflow-hidden max-h-[82vh] overflow-y-auto">
            <div
              className="px-4 pt-3 pb-4 text-white"
              style={{ background: PURPLE_GRADIENT }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => navigate("/captain-home")}
                  className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center"
                  aria-label="Volver al panel"
                  title="Volver al panel"
                >
                  <i className="ri-arrow-left-line text-xl"></i>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduledPanelMinimized(true)}
                    className="h-10 px-3 rounded-full bg-white/15 border border-white/20 flex items-center gap-2 text-sm font-black"
                    aria-label="Minimizar"
                    title="Minimizar"
                  >
                    <i className="ri-subtract-line text-lg"></i>
                    Minimizar
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/captain-home")}
                    className="w-10 h-10 rounded-full bg-black/25 border border-white/15 flex items-center justify-center"
                    aria-label="Ir al inicio"
                    title="Ir al inicio"
                  >
                    <i className="ri-home-5-line text-xl"></i>
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/80">
                    Domicilio programado asignado
                  </p>
                  <h2 className="text-xl font-black mt-1">
                    Servicio reservado
                  </h2>
                  <p className="text-sm text-white/90 mt-1 capitalize">
                    {scheduledPickupText}
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <i className="ri-calendar-check-fill text-2xl"></i>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3">
                <p className="text-sm font-black text-purple-950">
                  Aún no estás en camino
                </p>
                <p className="text-xs text-purple-700 mt-1 leading-5">
                  El usuario ya aceptó tu oferta. El seguimiento, ETA y estado
                  “en camino” se activarán únicamente cuando toques
                  “Iniciar domicilio”.
                </p>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={getUserPhoto()}
                    alt={userFullName}
                    className="w-11 h-11 rounded-2xl object-cover bg-gray-200"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-950 truncate">
                      {userFullName}
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                      <i className="ri-star-fill text-amber-500 text-xs"></i>
                      <span className="text-xs font-black text-gray-900">
                        {userRating.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {userRatingCount > 0
                          ? `(${userRatingCount})`
                          : "(Nuevo)"}
                      </span>
                    </div>
                  </div>

                  <i className="ri-shield-check-fill text-xl text-emerald-500"></i>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Recogida
                </p>
                <p className="text-sm font-black text-gray-900 mt-1">
                  {currentRide?.pickup || "Punto de recogida"}
                </p>

                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-3">
                  Entrega
                </p>
                <p className="text-sm font-black text-gray-900 mt-1">
                  {currentRide?.destination || "Destino"}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-gray-950 text-white px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/60">
                    Valor acordado
                  </p>
                  <p className="text-xl font-black mt-1">
                    {formatCOP(fare)}
                  </p>
                </div>

                <i className="ri-shield-check-fill text-2xl text-emerald-400"></i>
              </div>

              <button
                type="button"
                onClick={handleStartScheduledDispatch}
                disabled={startingScheduledDispatch}
                className="w-full rounded-2xl py-4 text-white font-black disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, #16A34A, #22C55E)",
                }}
              >
                {startingScheduledDispatch
                  ? "Iniciando domicilio..."
                  : "Iniciar domicilio"}
              </button>

              <p className="text-center text-[11px] text-gray-500">
                Al iniciar, el usuario verá que vas en camino y se activará el
                seguimiento normal.
              </p>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-black text-red-600"
              >
                Cancelar servicio
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduledReserved && scheduledPanelMinimized && (
        <div className="absolute inset-x-0 bottom-3 z-50 px-3">
          <div className="rounded-[22px] bg-white border border-purple-200 shadow-2xl p-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/captain-home")}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
              aria-label="Volver al panel"
            >
              <i className="ri-arrow-left-line text-xl text-gray-800"></i>
            </button>

            <button
              type="button"
              onClick={() => setScheduledPanelMinimized(false)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-1 text-[10px] font-black uppercase">
                  Programado
                </span>
                <span className="text-[10px] text-gray-500 capitalize truncate">
                  {scheduledPickupText}
                </span>
              </div>
              <p className="mt-1 text-sm font-black text-gray-950 truncate">
                Servicio reservado · {formatCOP(fare)}
              </p>
              <p className="text-[11px] text-gray-500">
                Toca para ver detalles o iniciar
              </p>
            </button>

            <button
              type="button"
              onClick={() => setScheduledPanelMinimized(false)}
              className="w-10 h-10 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0"
              aria-label="Ver servicio"
            >
              <i className="ri-arrow-up-s-line text-xl"></i>
            </button>
          </div>
        </div>
      )}

      {!isScheduledReserved && (
      <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
        <div className="rounded-[28px] bg-white/96 backdrop-blur shadow-2xl border border-gray-200 overflow-hidden max-h-[62vh] overflow-y-auto">
          <div
            className="px-4 py-4 text-white"
            style={{
              background: rideFinished
                ? "linear-gradient(135deg, #111827, #374151)"
                : PURPLE_GRADIENT,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-white/85">
                  Servicio en curso
                </p>

                <h2 className="text-2xl font-extrabold mt-1">
                  {headerStatus}
                </h2>

                <p className="text-sm text-white/90 mt-1">{headerSubtext}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[11px] uppercase tracking-wide text-white/85">
                  Valor
                </p>

                <p className="text-2xl font-extrabold">{formatCOP(fare)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 rounded-3xl border border-purple-100 bg-purple-50 p-3">
              <img
                src={getUserPhoto()}
                alt={userFullName}
                className="w-16 h-16 rounded-2xl object-cover"
              />

              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">
                  {userFullName}
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-100 px-2 py-1">
                    <i className="ri-star-fill text-amber-500 text-xs"></i>
                    <span className="text-xs font-black text-gray-900">
                      {userRating.toFixed(1)}
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-gray-500">
                    {userRatingCount > 0
                      ? `${userRatingCount} calificación${userRatingCount === 1 ? "" : "es"}`
                      : "Usuario nuevo"}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1">{userPhone}</p>

                <p className="text-sm text-gray-600 mt-1">
                  {vehicleLabel} · {color} · {plate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white border border-purple-100 p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                  Recorrido
                </p>

                <p className="text-2xl font-black text-gray-950 mt-1">
                  {rideDistanceText}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Recogida, domicilios y destino
                </p>
              </div>

              <div className="rounded-3xl bg-white border border-purple-100 p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                  Tiempo aprox.
                </p>

                <p className="text-2xl font-black text-gray-950 mt-1">
                  {rideDurationText}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Según la ruta calculada
                </p>
              </div>
            </div>

            {driverArrived &&
              !userConfirmedPickup &&
              !currentRide?.userConfirmedAtPickup &&
              !rideStarted && (
                <div
                  className="rounded-3xl border border-purple-100 px-4 py-3"
                  style={{ background: PURPLE_SOFT }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0">
                      <i className="ri-timer-line text-2xl text-purple-700"></i>
                    </div>

                    <div>
                      <p className="text-sm font-black text-purple-900">
                        Esperando confirmación del usuario
                      </p>
                      <p className="text-xs text-purple-700 mt-1 leading-5">
                        El usuario debe tocar “Mercancía lista para cargar”. Después de eso se
                        habilita el botón para continuar con el domicilio.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {(userConfirmedPickup || currentRide?.userConfirmedAtPickup) &&
              !rideStarted &&
              currentRide?.status !== "ongoing" && (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0">
                      <i className="ri-checkbox-circle-fill text-2xl text-emerald-600"></i>
                    </div>

                    <div>
                      <p className="text-sm font-black text-emerald-900">
                        Mercancía lista para cargar
                      </p>
                      <p className="text-xs text-emerald-700 mt-1 leading-5">
                        La mercancía está lista. Cuando termines de cargar, continúa hacia el destino.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  setHasUnreadMessage(false);
                }}
                className="rounded-3xl border border-purple-200 bg-white p-3 flex flex-col items-center shadow-sm"
              >
                <div
                  className="relative w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: PURPLE_GRADIENT,
                  }}
                >
                  {hasUnreadMessage && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
                  )}
                  <i className="ri-message-3-line text-2xl text-white"></i>
                </div>

                <p className="text-xs font-bold text-purple-800 mt-2">
                  Contactar
                </p>
              </button>

              <button
                type="button"
                onClick={handleSecurity}
                className="rounded-3xl border border-purple-200 bg-white p-3 flex flex-col items-center shadow-sm"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: PURPLE_GRADIENT,
                  }}
                >
                  <i className="ri-shield-check-line text-2xl text-white"></i>
                </div>

                <p className="text-xs font-bold text-purple-800 mt-2">
                  Seguridad
                </p>
              </button>

              <button
                type="button"
                onClick={handleArrived}
                disabled={
                  sendingArrived || driverArrived || rideStarted || rideFinished
                }
                className="rounded-3xl border border-purple-200 bg-white p-3 flex flex-col items-center disabled:opacity-60 shadow-sm"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: driverArrived
                      ? "linear-gradient(135deg, #16A34A, #4ADE80)"
                      : PURPLE_GRADIENT,
                  }}
                >
                  <i className="ri-map-pin-user-fill text-2xl text-white"></i>
                </div>

                <p className="text-xs font-bold text-purple-800 mt-2">
                  {driverArrived ? "Notificado" : "Llegué a recoger"}
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                setHasUnreadMessage(false);
              }}
              className="w-full rounded-xl px-4 py-4 flex items-center justify-between border border-purple-100"
              style={{
                background: PURPLE_SOFT,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <i className="ri-message-3-line text-2xl text-purple-700"></i>

                <span className="text-base font-semibold text-purple-700 truncate">
                  ¿Enviar mensaje u observación al usuario?
                </span>
              </div>

              <i className="ri-arrow-right-s-line text-2xl text-purple-700"></i>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openWazeNavigation}
                className="rounded-2xl border border-purple-200 bg-white p-3 flex items-center justify-center gap-2 shadow-sm"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: PURPLE_GRADIENT,
                  }}
                >
                  <i className="ri-navigation-fill text-xl text-white"></i>
                </div>

                <div className="text-left">
                  <p className="text-sm font-black text-purple-900">Waze</p>
                  <p className="text-[11px] text-purple-600">
                    Ir al {getNavigationTargetLabel()}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={openGoogleMapsNavigation}
                className="rounded-2xl border border-purple-200 bg-white p-3 flex items-center justify-center gap-2 shadow-sm"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: PURPLE_GRADIENT,
                  }}
                >
                  <i className="ri-map-2-fill text-xl text-white"></i>
                </div>

                <div className="text-left">
                  <p className="text-sm font-black text-purple-900">
                    Google Maps
                  </p>
                  <p className="text-[11px] text-purple-600">
                    Ir al {getNavigationTargetLabel()}
                  </p>
                </div>
              </button>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-range-fill text-lg text-purple-700"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                    Punto A - Recoger
                  </p>

                  <p className="text-base font-bold text-gray-900">
                    {pickupAddress.firstPart || "Punto de recogida"}
                  </p>

                  <p className="text-sm text-gray-600">
                    {pickupAddress.secondPart || "Ubicación del usuario"}
                  </p>
                </div>
              </div>

              <div className="h-5 w-px bg-gray-200 ml-5 my-2"></div>

              {routeStops.map((stop, index) => {
                const stopAddress = formatAddress(stop);

                return (
                  <React.Fragment key={`${stop}-${index}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                        <span className="text-sm font-black text-purple-800">
                          {index + 1}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                          Domicilio {index + 1}
                        </p>

                        <p className="text-base font-bold text-gray-900">
                          {stopAddress.firstPart || `Domicilio ${index + 1}`}
                        </p>

                        <p className="text-sm text-gray-600">
                          {stopAddress.secondPart || "Domicilio del recorrido"}
                        </p>
                      </div>
                    </div>

                    <div className="h-5 w-px bg-gray-200 ml-5 my-2"></div>
                  </React.Fragment>
                );
              })}

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                  <i className="ri-flag-2-fill text-lg text-purple-700"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                    Punto final - Destino
                  </p>

                  <p className="text-base font-bold text-gray-900">
                    {destinationAddress.firstPart || "Destino"}
                  </p>

                  <p className="text-sm text-gray-600">
                    {destinationAddress.secondPart || "Destino del servicio"}
                  </p>
                </div>
              </div>
            </div>

            {(etaInfo?.etaText || etaInfo?.distanceText) && (
              <div className="rounded-3xl border border-purple-200 bg-purple-50 px-4 py-3">
                <p className="text-sm font-bold text-purple-900">
                  Seguimiento en tiempo real
                </p>

                <p className="text-sm text-purple-800 mt-1">
                  {etaInfo?.etaText ? `Llegas en ${etaInfo.etaText}` : ""}
                  {etaInfo?.etaText && etaInfo?.distanceText ? " · " : ""}
                  {etaInfo?.distanceText || ""}
                </p>
              </div>
            )}

            {!rideStarted &&
              currentRide?.status !== "ongoing" &&
              !rideFinished && (
                <button
                  type="button"
                  onClick={handleStartRide}
                  disabled={!canStartRide || startingRide}
                  className="w-full rounded-2xl py-4 text-white font-black disabled:opacity-50"
                  style={{
                    background: canStartRide
                      ? "linear-gradient(135deg, #16A34A, #22C55E)"
                      : "linear-gradient(135deg, #9CA3AF, #6B7280)",
                  }}
                >
                  {startingRide
                    ? "Iniciando..."
                    : canStartRide
                    ? "Iniciar viaje"
                    : "Esperando confirmación del usuario"}
                </button>
              )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={rideFinished}
                className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleFinishRide}
                disabled={finishingRide || !canFinishRide || rideFinished}
                className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-50"
                style={{
                  background: PURPLE_GRADIENT,
                }}
              >
                {finishingRide
                  ? "Finalizando..."
                  : rideFinished
                  ? "Finalizado"
                  : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      )}

      {chatOpen && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[28px] max-h-[88vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-center pt-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div
              className="px-5 py-4 border-b border-purple-100 flex items-center justify-between text-white"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={getUserPhoto()}
                  alt={userFullName}
                  className="w-12 h-12 rounded-full object-cover bg-gray-200 border-2 border-white"
                />

                <div className="min-w-0">
                  <p className="text-lg font-extrabold truncate">
                    {userFullName}
                  </p>

                  <div className="flex items-center gap-1.5 text-sm text-white/90">
                    <i className="ri-star-fill text-amber-300"></i>
                    <span className="font-black">{userRating.toFixed(1)}</span>
                    <span className="text-white/70">
                      {userRatingCount > 0
                        ? `(${userRatingCount})`
                        : "(Nuevo)"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              >
                <i className="ri-close-line text-2xl text-white"></i>
              </button>
            </div>

            <div className="px-4 py-3 bg-purple-50 flex gap-2 overflow-x-auto">
              {quickMessages.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={sendingMessage}
                  onClick={() => sendMessage(text)}
                  className="shrink-0 rounded-full bg-white border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 disabled:opacity-60"
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 bg-white space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div
                    className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                    style={{
                      background: PURPLE_GRADIENT,
                    }}
                  >
                    <i className="ri-message-3-line text-3xl text-white"></i>
                  </div>

                  <p className="text-lg font-bold text-gray-900 mt-4">
                    Chat con el usuario
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    Escríbele una observación o usa un mensaje rápido.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine =
                    msg.senderType === "captain" || msg.from === "captain";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }`}
                        style={
                          isMine
                            ? {
                                background: PURPLE_GRADIENT,
                              }
                            : {}
                        }
                      >
                        <p className="text-sm font-medium leading-5">
                          {msg.text}
                        </p>

                        {msg.pending && (
                          <p className="text-[11px] text-white/75 mt-1">
                            Enviando...
                          </p>
                        )}

                        {msg.failed && (
                          <p className="text-[11px] text-red-100 mt-1">
                            No enviado
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef}></div>
            </div>

            <div className="p-4 border-t border-purple-100 bg-white">
              <div className="flex items-center gap-2">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 rounded-full bg-purple-50 border border-purple-100 px-4 py-3 text-base outline-none"
                  type="text"
                  placeholder="Escribe un mensaje..."
                />

                <button
                  type="button"
                  disabled={sendingMessage}
                  onClick={() => sendMessage()}
                  className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-60"
                  style={{
                    background: PURPLE_GRADIENT,
                  }}
                >
                  <i className="ri-send-plane-fill text-2xl text-white"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div
            ref={cancelModalRef}
            className="w-full translate-y-full opacity-0 rounded-t-[28px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <h3 className="text-2xl font-extrabold text-gray-900">
              Cancelar solicitud
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Selecciona el motivo para registrar la cancelación correctamente.
            </p>

            <div className="mt-5 space-y-3">
              {CANCEL_REASONS.map((reason) => {
                const selected = selectedReason === reason;

                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`w-full text-left rounded-2xl border px-4 py-4 transition ${
                      selected
                        ? "border-purple-500 bg-purple-50 text-purple-900"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <span className="font-semibold">{reason}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nota adicional
              </label>

              <textarea
                rows={4}
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Escribe un detalle adicional si es necesario..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedReason("");
                  setCancelNotes("");
                }}
                className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 font-bold text-gray-700"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleCancelRide}
                disabled={sendingCancel}
                className="w-full rounded-2xl py-3.5 font-bold text-white disabled:opacity-60"
                style={{
                  background: PURPLE_GRADIENT,
                }}
              >
                {sendingCancel ? "Cancelando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRatingModal && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end">
          <div
            ref={ratingModalRef}
            className="w-full translate-y-full opacity-0 rounded-t-[28px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: PURPLE_GRADIENT }}
              >
                <i className="ri-star-smile-line text-4xl text-white"></i>
              </div>

              <h3 className="text-2xl font-extrabold text-gray-900 mt-4">
                Califica al usuario
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                Tu calificación ayuda a mantener una comunidad segura y confiable.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 mt-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                >
                  <i
                    className={`${
                      star <= ratingValue ? "ri-star-fill" : "ri-star-line"
                    } text-4xl ${
                      star <= ratingValue ? "text-yellow-500" : "text-gray-300"
                    }`}
                  ></i>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comentario opcional
              </label>

              <textarea
                rows={4}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Ejemplo: usuario amable, punto claro, buen servicio..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowRatingModal(false);
                  navigate("/captain-home", {
                    state: {
                      finishedRide: currentRide,
                      skippedRating: true,
                    },
                  });
                }}
                className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 font-bold text-gray-700"
              >
                Omitir
              </button>

              <button
                type="button"
                onClick={handleRateUser}
                disabled={sendingRating}
                className="w-full rounded-2xl py-3.5 font-bold text-white disabled:opacity-60"
                style={{
                  background: PURPLE_GRADIENT,
                }}
              >
                {sendingRating ? "Enviando..." : "Enviar calificación"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default CaptainRiding;