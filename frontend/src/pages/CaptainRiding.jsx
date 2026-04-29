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

const CaptainRiding = () => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [sendingArrived, setSendingArrived] = useState(false);
  const [sendingCancel, setSendingCancel] = useState(false);
  const [finishingRide, setFinishingRide] = useState(false);
  const [driverArrived, setDriverArrived] = useState(false);
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
  const messagesEndRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const rideData = location.state?.ride || null;

  const { socket } = useContext(SocketContext);
  const { captain } = useContext(CaptainDataContext);

  const quickMessages = useMemo(
    () => [
      "Ya llegué",
      "Voy en camino",
      "Estoy en la entrada",
      "No veo el punto exacto",
      "¿Me confirmas dónde estás?",
    ],
    []
  );

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

  useEffect(() => {
    if (!socket || !captain?._id) return;

    const emitJoin = () => {
      socket.emit("join", {
        userId: captain._id,
        userType: "captain",
      });
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on("connect", emitJoin);

    return () => {
      socket.off("connect", emitJoin);
    };
  }, [socket, captain?._id]);

  useEffect(() => {
    if (!rideData?._id) {
      setMessages([]);
      setChatOpen(false);
      setHasUnreadMessage(false);
    }
  }, [rideData?._id]);

  useEffect(() => {
    if (!chatOpen) return;

    setHasUnreadMessage(false);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!socket || !rideData?._id) return;

    const handleRideMessage = (payload) => {
      if (!payload?.rideId) return;
      if (String(payload.rideId) !== String(rideData._id)) return;

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
        const exists = prev.some((msg) => String(msg.id) === String(nextMessage.id));
        if (exists) return prev;
        return [...prev, nextMessage];
      });

      if (!chatOpen && nextMessage.senderType !== "captain") {
        setHasUnreadMessage(true);
      }
    };

    socket.on("ride-message", handleRideMessage);
    socket.on("ride-chat-message", handleRideMessage);

    return () => {
      socket.off("ride-message", handleRideMessage);
      socket.off("ride-chat-message", handleRideMessage);
    };
  }, [socket, rideData?._id, chatOpen]);

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

  const getDriverPhoto = () =>
    rideData?.captain?.profileImage ||
    rideData?.captain?.photo ||
    rideData?.captain?.avatar ||
    rideData?.captain?.image ||
    rideData?.captain?.profilePic ||
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

  const getUserPhoto = () =>
    rideData?.user?.profileImage ||
    rideData?.user?.photo ||
    rideData?.user?.avatar ||
    rideData?.user?.image ||
    rideData?.user?.profilePic ||
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

  const sendMessage = async (textToSend = "") => {
    const cleanText = String(textToSend || messageText || "").trim();

    if (!cleanText || !rideData?._id || sendingMessage) return;

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("No hay sesión activa.");
      return;
    }

    const tempMessage = {
      id: `local-${Date.now()}-${Math.random()}`,
      rideId: rideData._id,
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
          rideId: rideData._id,
          message: cleanText,
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
                  message: serverMessage.message || serverMessage.text || cleanText,
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

  const handleArrived = async () => {
    if (!rideData?._id || sendingArrived) return;

    try {
      setSendingArrived(true);

      await axios.post(
        `${getApiBaseUrl()}/rides/arrived`,
        { rideId: rideData._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setDriverArrived(true);
      toast.success("Se notificó al usuario que ya llegaste.");
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

  const handleCancelRide = async () => {
    if (!rideData?._id || sendingCancel) return;

    if (!selectedReason) {
      toast.error("Selecciona un motivo de cancelación.");
      return;
    }

    try {
      setSendingCancel(true);

      await axios.post(
        `${getApiBaseUrl()}/rides/cancel-by-captain`,
        {
          rideId: rideData._id,
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
        error?.response?.data?.message ||
          "No se pudo cancelar la solicitud."
      );
    } finally {
      setSendingCancel(false);
    }
  };

  const handleFinishRide = async () => {
    if (!rideData?._id || finishingRide) return;

    try {
      setFinishingRide(true);

      const response = await axios.post(
        `${getApiBaseUrl()}/rides/end-ride`,
        { rideId: rideData._id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      toast.success("Recorrido finalizado correctamente.");
      navigate("/captain-home", { state: { finishedRide: response.data } });
    } catch (error) {
      console.error("Error finalizando recorrido:", error);
      toast.error(
        error?.response?.data?.message ||
          "No se pudo finalizar el recorrido."
      );
    } finally {
      setFinishingRide(false);
    }
  };

  if (!rideData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            No hay información del servicio
          </h1>

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

  const pickupAddress = formatAddress(rideData?.pickup);
  const destinationAddress = formatAddress(rideData?.destination);

  const userFullName =
    `${rideData?.user?.fullname?.firstname || ""} ${
      rideData?.user?.fullname?.lastname || ""
    }`.trim() || "Usuario";

  const userPhone =
    rideData?.user?.phone ||
    rideData?.user?.phoneNumber ||
    rideData?.user?.mobile ||
    "Sin teléfono";

  const vehicleType =
    rideData?.captain?.vehicle?.vehicleType ||
    rideData?.captain?.vehicleType ||
    rideData?.vehicleType ||
    rideData?.vehicle ||
    "car";

  const vehicleLabel = getVehicleLabel(vehicleType);

  const plate =
    rideData?.captain?.vehicle?.plate ||
    rideData?.captain?.plate ||
    "Sin placa";

  const color =
    rideData?.captain?.vehicle?.color ||
    rideData?.captain?.vehicleColor ||
    "Color no disponible";

  const fare = rideData?.fare ?? rideData?.offeredFare ?? 0;

  const headerStatus = driverArrived
    ? "Llegaste al punto"
    : "En camino a recoger";

  const headerSubtext = driverArrived
    ? "El usuario ya fue notificado."
    : etaInfo?.etaText
    ? `Tiempo estimado: ${etaInfo.etaText}${
        etaInfo?.distanceText ? ` · ${etaInfo.distanceText}` : ""
      }`
    : "Dirígete al punto de recogida del usuario.";

  return (
    <div className="overflow-hidden h-screen w-screen bg-gray-50">
      <div className="absolute inset-0 z-10">
        <LiveTracking
          pickup={rideData?.pickup || ""}
          selectedCaptainId={rideData?.captain?._id || null}
          showRouteToPickup={true}
          showPickupRadar={true}
          autoFetchNearbyDrivers={true}
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
        className="absolute top-[72px] right-3 z-40 w-14 h-14 rounded-full bg-lime-300 shadow-xl flex items-center justify-center"
      >
        {hasUnreadMessage && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
        )}

        <i className="ri-message-3-line text-3xl text-black"></i>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
        <div className="rounded-[28px] bg-white/96 backdrop-blur shadow-2xl border border-gray-200 overflow-hidden max-h-[54vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-300 px-4 py-4 text-white">
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
            <div className="flex items-center gap-3 rounded-3xl border border-gray-200 bg-gray-50 p-3">
              <img
                src={getUserPhoto()}
                alt={userFullName}
                className="w-16 h-16 rounded-2xl object-cover"
              />

              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">
                  {userFullName}
                </p>

                <p className="text-sm text-gray-600 mt-1">{userPhone}</p>

                <p className="text-sm text-gray-600 mt-1">
                  {vehicleLabel} · {color} · {plate}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  setHasUnreadMessage(false);
                }}
                className="rounded-3xl border border-gray-200 bg-white p-3 flex flex-col items-center"
              >
                <div className="relative w-14 h-14 rounded-full bg-lime-300 flex items-center justify-center">
                  {hasUnreadMessage && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
                  )}
                  <i className="ri-message-3-line text-2xl text-black"></i>
                </div>

                <p className="text-xs font-bold text-gray-800 mt-2">
                  Chat usuario
                </p>
              </button>

              <button
                type="button"
                onClick={handleArrived}
                disabled={sendingArrived || driverArrived}
                className="rounded-3xl border border-gray-200 bg-white p-3 flex flex-col items-center disabled:opacity-60"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <i className="ri-map-pin-user-fill text-2xl text-emerald-700"></i>
                </div>

                <p className="text-xs font-bold text-gray-800 mt-2">
                  {driverArrived ? "Notificado" : "Llegué"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="rounded-3xl border border-gray-200 bg-white p-3 flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <i className="ri-close-circle-line text-2xl text-red-700"></i>
                </div>

                <p className="text-xs font-bold text-gray-800 mt-2">
                  Cancelar
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                setHasUnreadMessage(false);
              }}
              className="w-full rounded-xl bg-gray-100 px-4 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <i className="ri-message-3-line text-2xl text-gray-800"></i>

                <span className="text-base font-semibold text-gray-500 truncate">
                  ¿Enviar mensaje u observación al usuario?
                </span>
              </div>

              <i className="ri-arrow-right-s-line text-2xl text-gray-900"></i>
            </button>

            <div className="rounded-3xl border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                  <i className="ri-map-pin-range-fill text-lg"></i>
                </div>

                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">
                    {pickupAddress.firstPart || "Punto de recogida"}
                  </p>

                  <p className="text-sm text-gray-600">
                    {pickupAddress.secondPart || "Ubicación del usuario"}
                  </p>
                </div>
              </div>

              <div className="h-5 w-px bg-gray-200 ml-5 my-2"></div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                  <i className="ri-square-fill text-lg"></i>
                </div>

                <div className="min-w-0">
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
              <div className="rounded-3xl border border-violet-200 bg-violet-50 px-4 py-3">
                <p className="text-sm font-bold text-violet-900">
                  Seguimiento en tiempo real
                </p>

                <p className="text-sm text-violet-800 mt-1">
                  {etaInfo?.etaText ? `Llegas en ${etaInfo.etaText}` : ""}
                  {etaInfo?.etaText && etaInfo?.distanceText ? " · " : ""}
                  {etaInfo?.distanceText || ""}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleFinishRide}
              disabled={finishingRide}
              className="w-full rounded-2xl py-3.5 text-white font-bold disabled:opacity-60"
              style={{
                background: "linear-gradient(to right, #f2994a, #f2c94c)",
              }}
            >
              {finishingRide ? "Finalizando..." : "Finalizar recorrido"}
            </button>
          </div>
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[28px] max-h-[88vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-center pt-3">
              <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={getUserPhoto()}
                  alt={userFullName}
                  className="w-12 h-12 rounded-full object-cover bg-gray-200"
                />

                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-gray-900 truncate">
                    {userFullName}
                  </p>

                  <p className="text-sm text-gray-500 truncate">
                    Usuario del servicio
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <div className="px-4 py-3 bg-gray-50 flex gap-2 overflow-x-auto">
              {quickMessages.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={sendingMessage}
                  onClick={() => sendMessage(text)}
                  className="shrink-0 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 bg-white space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-lime-200 flex items-center justify-center">
                    <i className="ri-message-3-line text-3xl text-gray-900"></i>
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
                            ? "bg-lime-300 text-gray-950 rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm font-medium leading-5">
                          {msg.text}
                        </p>

                        {msg.pending && (
                          <p className="text-[11px] text-gray-600 mt-1">
                            Enviando...
                          </p>
                        )}

                        {msg.failed && (
                          <p className="text-[11px] text-red-600 mt-1">
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

            <div className="p-4 border-t border-gray-100 bg-white">
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
                  className="flex-1 rounded-full bg-gray-100 px-4 py-3 text-base outline-none"
                  type="text"
                  placeholder="Escribe un mensaje..."
                />

                <button
                  type="button"
                  disabled={sendingMessage}
                  onClick={() => sendMessage()}
                  className="w-12 h-12 rounded-full bg-lime-300 flex items-center justify-center disabled:opacity-60"
                >
                  <i className="ri-send-plane-fill text-2xl text-gray-950"></i>
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
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
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
                  background: "linear-gradient(to right, #cb2d3e, #ef473a)",
                }}
              >
                {sendingCancel ? "Cancelando..." : "Confirmar cancelación"}
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