import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";

const DriverSelected = (props) => {
  const ride = props?.ride || null;
  const socket = props?.socket || null;
  const captainArrived = props?.captainArrived || false;
  const etaInfo = props?.etaInfo || {};

  const [currentRide, setCurrentRide] = useState(ride);

  const [chatOpen, setChatOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [localCaptainArrived, setLocalCaptainArrived] = useState(false);
  const [arrivalCountdown, setArrivalCountdown] = useState(30);
  const [canConfirmPickup, setCanConfirmPickup] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [userConfirmedPickup, setUserConfirmedPickup] = useState(false);

  const [rideStarted, setRideStarted] = useState(false);
  const [rideEnded, setRideEnded] = useState(false);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [sendingRating, setSendingRating] = useState(false);

  const messagesEndRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const quickMessages = useMemo(
    () => [
      "Ya estoy afuera",
      "Voy bajando",
      "¿Dónde estás?",
      "Te espero en portería",
    ],
    []
  );

  useEffect(() => {
    setCurrentRide(ride || null);
  }, [ride]);

  useEffect(() => {
    const arrived =
      Boolean(currentRide?.arrivedAtPickup) ||
      currentRide?.status === "arrived" ||
      Boolean(captainArrived);

    const confirmed = Boolean(currentRide?.userConfirmedAtPickup);
    const started = currentRide?.status === "ongoing";
    const completed = currentRide?.status === "completed";

    setLocalCaptainArrived(arrived);
    setUserConfirmedPickup(confirmed);
    setRideStarted(started);
    setRideEnded(completed);

    if (completed && !currentRide?.userRatingToCaptain?.rating) {
      setShowRatingModal(true);
    }
  }, [currentRide, captainArrived]);

  useEffect(() => {
    if (!localCaptainArrived || userConfirmedPickup || rideStarted || rideEnded) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const arrivedAtValue = currentRide?.arrivedAtPickupAt;
    const arrivedAtTime = arrivedAtValue ? new Date(arrivedAtValue).getTime() : Date.now();

    const updateCountdown = () => {
      const secondsPassed = Math.floor((Date.now() - arrivedAtTime) / 1000);
      const remaining = Math.max(30 - secondsPassed, 0);

      setArrivalCountdown(remaining);
      setCanConfirmPickup(remaining <= 0);

      if (remaining <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };

    updateCountdown();

    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [
    localCaptainArrived,
    currentRide?.arrivedAtPickupAt,
    userConfirmedPickup,
    rideStarted,
    rideEnded,
  ]);

  const formatAddress = (address = "") => {
    const safeAddress = String(address || "").trim();

    if (!safeAddress) {
      return { firstPart: "", secondPart: "" };
    }

    const firstCommaIndex = safeAddress.indexOf(",");

    if (firstCommaIndex === -1) {
      return { firstPart: safeAddress, secondPart: "" };
    }

    const firstPart = safeAddress.substring(0, firstCommaIndex).trim();
    const secondPart = safeAddress.substring(firstCommaIndex + 1).trim();

    return { firstPart, secondPart };
  };

  const formatCOP = (value) => {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.ceil(number));
  };

  const getDriverPhoto = (captain) =>
    captain?.profileImage ||
    captain?.photo ||
    captain?.avatar ||
    captain?.image ||
    captain?.profilePic ||
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

  const getVehicleTypeLabel = (vehicleType) => {
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

  useEffect(() => {
    if (!chatOpen) return;

    setHasUnreadMessage(false);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!currentRide?._id) {
      setMessages([]);
      setChatOpen(false);
      setHasUnreadMessage(false);
    }
  }, [currentRide?._id]);

  useEffect(() => {
    if (!socket || !currentRide?._id) return;

    const handleRideMessage = (payload) => {
      console.log("[USER CHAT] Mensaje recibido:", payload);

      if (!payload?.rideId) return;
      if (String(payload.rideId) !== String(currentRide._id)) return;

      const nextMessage = {
        id: payload?._id || `${Date.now()}-${Math.random()}`,
        rideId: payload.rideId,
        senderType: payload.senderType || payload.from || "captain",
        from: payload.from || payload.senderType || "captain",
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

      if (!chatOpen && nextMessage.senderType !== "user") {
        setHasUnreadMessage(true);
      }
    };

    const handleCaptainArrived = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");

      if (rideId !== String(currentRide._id)) return;

      if (payload?.ride) {
        setCurrentRide(payload.ride);
      }

      setLocalCaptainArrived(true);
      setUserConfirmedPickup(false);
      setArrivalCountdown(Number(payload?.waitSeconds || 30));
      setCanConfirmPickup(false);

      alert("Tu conductor ya llegó al punto de recogida.");
    };

    const handleRideStarted = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");

      if (rideId !== String(currentRide._id)) return;

      if (payload?.ride) {
        setCurrentRide(payload.ride);
      }

      setRideStarted(true);
      setLocalCaptainArrived(true);
      setUserConfirmedPickup(true);
    };

    const handleRideEnded = (payload) => {
      const rideId = String(payload?.rideId || payload?.ride?._id || "");

      if (rideId !== String(currentRide._id)) return;

      if (payload?.ride) {
        setCurrentRide(payload.ride);
      }

      setRideEnded(true);
      setShowRatingModal(true);
    };

    socket.on("ride-message", handleRideMessage);
    socket.on("ride-chat-message", handleRideMessage);
    socket.on("captain-arrived", handleCaptainArrived);
    socket.on("ride-started", handleRideStarted);
    socket.on("ride-ended", handleRideEnded);

    return () => {
      socket.off("ride-message", handleRideMessage);
      socket.off("ride-chat-message", handleRideMessage);
      socket.off("captain-arrived", handleCaptainArrived);
      socket.off("ride-started", handleRideStarted);
      socket.off("ride-ended", handleRideEnded);
    };
  }, [socket, currentRide?._id, chatOpen]);

  const sendMessage = async (textToSend = "") => {
    const cleanText = String(textToSend || messageText || "").trim();

    if (!cleanText || !currentRide?._id || sendingMessage) return;

    const token = localStorage.getItem("token");

    if (!token) {
      alert("No hay sesión activa.");
      return;
    }

    const tempMessage = {
      id: `local-${Date.now()}-${Math.random()}`,
      rideId: currentRide._id,
      senderType: "user",
      from: "user",
      text: cleanText,
      message: cleanText,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessageText("");

    try {
      setSendingMessage(true);

      console.log("[USER CHAT] Enviando mensaje:", {
        rideId: currentRide._id,
        message: cleanText,
      });

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/chat-message`,
        {
          rideId: currentRide._id,
          message: cleanText,
          senderType: "user",
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
                  senderType: serverMessage.senderType || "user",
                  from: serverMessage.from || "user",
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
      console.error("Error enviando mensaje al conductor:", error);

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

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo enviar el mensaje."
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUserAtPickup = async () => {
    if (!currentRide?._id || confirmingPickup) return;

    if (!canConfirmPickup) {
      alert(`Espera ${arrivalCountdown} segundos para confirmar.`);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      alert("No hay sesión activa.");
      return;
    }

    try {
      setConfirmingPickup(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/user-at-pickup`,
        {
          rideId: currentRide._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response?.data?.ride) {
        setCurrentRide(response.data.ride);
      }

      setUserConfirmedPickup(true);
      alert("Listo. Le avisamos al conductor que ya estás en el punto.");
    } catch (error) {
      console.error("Error confirmando recogida:", error);

      const secondsRemaining = Number(error?.response?.data?.secondsRemaining);

      if (Number.isFinite(secondsRemaining) && secondsRemaining > 0) {
        setArrivalCountdown(secondsRemaining);
        setCanConfirmPickup(false);
      }

      alert(
        error?.response?.data?.message ||
          "No se pudo confirmar que ya estás en el punto."
      );
    } finally {
      setConfirmingPickup(false);
    }
  };

  const handleRateCaptain = async () => {
    if (!currentRide?._id || sendingRating) return;

    const token = localStorage.getItem("token");

    if (!token) {
      alert("No hay sesión activa.");
      return;
    }

    try {
      setSendingRating(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/rate-captain`,
        {
          rideId: currentRide._id,
          rating: ratingValue,
          comment: ratingComment,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response?.data?.ride) {
        setCurrentRide(response.data.ride);
      }

      alert("Gracias por calificar al conductor.");
      setShowRatingModal(false);
    } catch (error) {
      console.error("Error calificando conductor:", error);

      alert(
        error?.response?.data?.message ||
          "No se pudo enviar la calificación."
      );
    } finally {
      setSendingRating(false);
    }
  };

  const handleSecurity = () => {
    alert("Centro de seguridad próximamente disponible.");
  };

  if (!currentRide) {
    return (
      <div className="bg-white rounded-t-[24px] p-6">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-semibold">
            Cargando información del conductor...
          </h1>
        </div>
      </div>
    );
  }

  const pickupAddress = formatAddress(currentRide?.pickup);
  const destinationAddress = formatAddress(currentRide?.destination);

  const captain = currentRide?.captain || {};
  const fullName = captain?.fullname || {};
  const vehicle = captain?.vehicle || {};

  const driverName =
    [fullName?.firstname, fullName?.lastname].filter(Boolean).join(" ") ||
    captain?.name ||
    "Conductor asignado";

  const plate = vehicle?.plate || captain?.plate || "Sin placa";
  const color = vehicle?.color || captain?.vehicleColor || "Color no disponible";

  const vehicleType =
    vehicle?.vehicleType ||
    captain?.vehicleType ||
    currentRide?.vehicleType ||
    currentRide?.vehicle ||
    "car";

  const vehicleLabel = getVehicleTypeLabel(vehicleType);
  const driverPhoto = getDriverPhoto(captain);
  const finalFare = currentRide?.fare ?? currentRide?.offeredFare ?? 0;

  const etaText = rideEnded
    ? "Tu viaje finalizó"
    : rideStarted || currentRide?.status === "ongoing"
    ? "Tu viaje está en curso"
    : userConfirmedPickup || currentRide?.userConfirmedAtPickup
    ? "Esperando que el conductor inicie"
    : localCaptainArrived
    ? "Tu conductor ya llegó"
    : etaInfo?.etaText
    ? `El conductor llegará en ${etaInfo.etaText}`
    : "El conductor llegará pronto";

  const etaSubText = rideEnded
    ? "Califica al conductor para cerrar tu experiencia."
    : rideStarted || currentRide?.status === "ongoing"
    ? "Vas camino a tu destino."
    : userConfirmedPickup || currentRide?.userConfirmedAtPickup
    ? "Ya avisamos al conductor que estás en el punto."
    : localCaptainArrived
    ? canConfirmPickup
      ? "Confirma cuando ya estés en el punto de recogida."
      : `Puedes confirmar en ${arrivalCountdown} segundos.`
    : `${color} ${vehicleLabel}`;

  return (
    <div className="bg-white rounded-t-[24px] pb-6 relative overflow-hidden">
      <div className="flex items-center justify-center pt-3 pb-2">
        <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
      </div>

      <div
        className="mx-4 mt-2 rounded-[28px] px-5 py-5 text-white shadow-xl"
        style={{
          background: rideEnded
            ? "linear-gradient(135deg, #111827, #374151)"
            : PURPLE_GRADIENT,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-white/80">
              Servicio confirmado
            </p>

            <h2 className="text-[26px] leading-8 font-extrabold mt-1">
              {etaText}
            </h2>

            <p className="text-sm text-white/90 mt-2">{etaSubText}</p>

            <div className="inline-flex mt-3 px-4 py-2 rounded-xl bg-white/20 border border-white/20">
              <span className="text-xl font-extrabold tracking-wide text-white">
                {plate}
              </span>
            </div>
          </div>

          <div className="shrink-0 w-20 h-20 rounded-3xl bg-white/15 flex items-center justify-center">
            <i className="ri-car-fill text-6xl text-white"></i>
          </div>
        </div>
      </div>

      {localCaptainArrived &&
        !userConfirmedPickup &&
        !currentRide?.userConfirmedAtPickup &&
        !rideStarted &&
        !rideEnded && (
          <div className="px-5 mt-4">
            <div
              className="rounded-[24px] border border-purple-100 p-4"
              style={{
                background: PURPLE_SOFT,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <i className="ri-map-pin-user-fill text-2xl text-purple-700"></i>
                </div>

                <div className="flex-1">
                  <p className="text-base font-black text-purple-950">
                    Tu conductor llegó
                  </p>

                  <p className="text-sm text-purple-700 mt-1 leading-5">
                    Para evitar confusiones, espera el contador y confirma
                    cuando ya estés en el punto.
                  </p>

                  <button
                    type="button"
                    onClick={handleUserAtPickup}
                    disabled={!canConfirmPickup || confirmingPickup}
                    className="w-full mt-4 rounded-2xl py-3.5 text-white font-black disabled:opacity-50"
                    style={{
                      background: canConfirmPickup
                        ? PURPLE_GRADIENT
                        : "linear-gradient(135deg, #9CA3AF, #6B7280)",
                    }}
                  >
                    {confirmingPickup
                      ? "Confirmando..."
                      : canConfirmPickup
                      ? "Ya estoy acá"
                      : `Disponible en ${arrivalCountdown}s`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {(userConfirmedPickup || currentRide?.userConfirmedAtPickup) &&
        !rideStarted &&
        !rideEnded && (
          <div className="px-5 mt-4">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <i className="ri-checkbox-circle-fill text-2xl text-emerald-600"></i>
                </div>

                <div>
                  <p className="text-base font-black text-emerald-900">
                    Confirmación enviada
                  </p>

                  <p className="text-sm text-emerald-700 mt-1 leading-5">
                    El conductor ya puede iniciar el viaje.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      {rideStarted && !rideEnded && (
        <div className="px-5 mt-4">
          <div className="rounded-[24px] border border-purple-100 bg-purple-50 p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                <i className="ri-road-map-fill text-2xl text-purple-700"></i>
              </div>

              <div>
                <p className="text-base font-black text-purple-950">
                  Viaje iniciado
                </p>

                <p className="text-sm text-purple-700 mt-1 leading-5">
                  Estás camino a tu destino. Mantente atento al recorrido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-5">
        <div className="grid grid-cols-3 items-start gap-3 text-center">
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={driverPhoto}
                alt={driverName}
                className="w-16 h-16 rounded-full object-cover bg-gray-200 border-2 border-purple-200"
              />

              <div className="absolute -top-1 -right-3 bg-white shadow rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <i className="ri-star-fill text-yellow-400 text-xs"></i>
                <span className="text-xs font-bold text-gray-700">4.94</span>
              </div>
            </div>

            <p className="text-base font-bold text-gray-900 mt-3 leading-5">
              {driverName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              setHasUnreadMessage(false);
            }}
            className="flex flex-col items-center"
          >
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              {hasUnreadMessage && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
              )}

              <i className="ri-message-3-line text-3xl text-white"></i>
            </div>

            <p className="text-base font-bold text-purple-800 mt-3 leading-5">
              Contactar
            </p>
          </button>

          <button
            type="button"
            onClick={handleSecurity}
            className="flex flex-col items-center"
          >
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              <i className="ri-shield-check-line text-3xl text-white"></i>
            </div>

            <p className="text-base font-bold text-purple-800 mt-3 leading-5">
              Seguridad
            </p>
          </button>
        </div>
      </div>

      <div className="px-5 mt-6">
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

            <span className="text-lg font-semibold text-purple-700 truncate">
              ¿Tienes alguna observación para el conductor?
            </span>
          </div>

          <i className="ri-arrow-right-s-line text-2xl text-purple-700"></i>
        </button>
      </div>

      <div className="px-5 mt-6">
        <p className="text-lg text-gray-500 mb-2">Pago</p>

        <div className="rounded-[22px] border border-purple-100 bg-purple-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">
              Pago contra servicio
            </p>
            <p className="text-sm text-purple-700">Valor acordado</p>
          </div>

          <p className="text-xl font-extrabold text-purple-900">
            {formatCOP(finalFare)}
          </p>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[24px] border border-purple-100 bg-white p-4 shadow-sm">
          <p className="text-base font-bold text-gray-900 mb-4">
            Detalles del recorrido
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shadow-sm">
                <i className="ri-map-pin-range-fill text-lg text-purple-700"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {pickupAddress.firstPart || "Punto de recogida"}
                </p>
                <p className="text-sm text-gray-600">
                  {pickupAddress.secondPart || "Ubicación de recogida"}
                </p>
              </div>
            </div>

            <div className="h-5 w-px bg-gray-200 ml-5"></div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center shadow-sm">
                <i className="ri-square-fill text-lg text-purple-700"></i>
              </div>

              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {destinationAddress.firstPart || "Destino"}
                </p>
                <p className="text-sm text-gray-600">
                  {destinationAddress.secondPart || "Ubicación de destino"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  src={driverPhoto}
                  alt={driverName}
                  className="w-12 h-12 rounded-full object-cover bg-gray-200 border-2 border-white"
                />

                <div className="min-w-0">
                  <p className="text-lg font-extrabold truncate">
                    {driverName}
                  </p>
                  <p className="text-sm text-white/80 truncate">
                    {color} {vehicleLabel} · {plate}
                  </p>
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
                    Chat con tu conductor
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Escríbele una observación o usa un mensaje rápido.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine =
                    msg.senderType === "user" || msg.from === "user";

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

      {showRatingModal && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end">
          <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
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
                Califica a tu conductor
              </h3>

              <p className="text-sm text-gray-600 mt-2">
                Tu opinión ayuda a mejorar la experiencia de Central Go.
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
                placeholder="Ejemplo: conductor amable, llegó rápido, buen servicio..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 font-bold text-gray-700"
              >
                Omitir
              </button>

              <button
                type="button"
                onClick={handleRateCaptain}
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
    </div>
  );
};

export default DriverSelected;