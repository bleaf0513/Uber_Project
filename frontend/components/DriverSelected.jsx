import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../src/apiBase";

const DriverSelected = (props) => {
  const ride = props?.ride || null;
  const socket = props?.socket || null;
  const user = props?.user || null;
  const captainArrived = props?.captainArrived || false;
  const etaInfo = props?.etaInfo || {};

  const [chatOpen, setChatOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef(null);

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
    if (!chatOpen) return;

    setHasUnreadMessage(false);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [chatOpen, messages]);

  useEffect(() => {
    if (!ride?._id) {
      setMessages([]);
      setChatOpen(false);
      setHasUnreadMessage(false);
    }
  }, [ride?._id]);

  useEffect(() => {
    if (!socket || !ride?._id) return;

    const handleRideMessage = (payload) => {
      if (!payload?.rideId) return;
      if (String(payload.rideId) !== String(ride._id)) return;

      const nextMessage = {
        id: payload?._id || `${Date.now()}-${Math.random()}`,
        rideId: payload.rideId,
        senderType: payload.senderType || payload.from || "captain",
        text: payload.message || payload.text || "",
        createdAt: payload.createdAt || new Date().toISOString(),
      };

      if (!nextMessage.text) return;

      setMessages((prev) => {
        const exists = prev.some((msg) => String(msg.id) === String(nextMessage.id));
        if (exists) return prev;
        return [...prev, nextMessage];
      });

      if (!chatOpen && nextMessage.senderType !== "user") {
        setHasUnreadMessage(true);
      }
    };

    socket.on("ride-message", handleRideMessage);
    socket.on("ride-chat-message", handleRideMessage);

    return () => {
      socket.off("ride-message", handleRideMessage);
      socket.off("ride-chat-message", handleRideMessage);
    };
  }, [socket, ride?._id, chatOpen]);

  const sendMessage = async (textToSend = "") => {
    const cleanText = String(textToSend || messageText || "").trim();

    if (!cleanText || !ride?._id || sendingMessage) return;

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

    setMessages((prev) => [...prev, tempMessage]);
    setMessageText("");

    try {
      setSendingMessage(true);

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

  if (!ride) {
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

  const pickupAddress = formatAddress(ride?.pickup);
  const destinationAddress = formatAddress(ride?.destination);

  const captain = ride?.captain || {};
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
    ride?.vehicleType ||
    ride?.vehicle ||
    "car";

  const vehicleLabel = getVehicleTypeLabel(vehicleType);
  const driverPhoto = getDriverPhoto(captain);
  const finalFare = ride?.fare ?? ride?.offeredFare ?? 0;

  const etaText = captainArrived
    ? "Tu conductor ya llegó"
    : etaInfo?.etaText
    ? `El conductor llegará en ${etaInfo.etaText}`
    : "El conductor llegará pronto";

  return (
    <div className="bg-white rounded-t-[24px] pb-6 relative">
      <div className="flex items-center justify-center pt-3 pb-2">
        <div className="w-14 h-1.5 rounded-full bg-gray-300"></div>
      </div>

      <div className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[26px] leading-8 font-extrabold text-gray-950">
              {etaText}
            </h2>

            <p className="text-lg text-gray-800 mt-3">
              {color} {vehicleLabel}
            </p>

            <div className="inline-flex mt-2 px-4 py-2 rounded-lg bg-gray-200">
              <span className="text-xl font-extrabold tracking-wide text-gray-900">
                {plate}
              </span>
            </div>
          </div>

          <div className="shrink-0 w-24 h-20 flex items-center justify-center">
            <i className="ri-car-fill text-6xl text-gray-600"></i>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <div className="grid grid-cols-3 items-start gap-3 text-center">
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={driverPhoto}
                alt={driverName}
                className="w-16 h-16 rounded-full object-cover bg-gray-200"
              />

              <div className="absolute -top-1 -right-3 bg-white shadow rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <i className="ri-star-fill text-yellow-400 text-xs"></i>
                <span className="text-xs font-bold text-gray-700">4.94</span>
              </div>
            </div>

            <p className="text-base font-medium text-gray-900 mt-3 leading-5">
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
            <div className="relative w-16 h-16 rounded-full bg-lime-300 flex items-center justify-center shadow-sm">
              {(hasUnreadMessage || messages.length === 0) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
              )}

              <i className="ri-phone-line text-3xl text-black"></i>
              <i className="ri-message-3-line text-lg text-black absolute right-3 top-3"></i>
            </div>

            <p className="text-base font-medium text-gray-900 mt-3 leading-5">
              Contactar al conductor
            </p>
          </button>

          <button type="button" className="flex flex-col items-center">
            <div className="relative w-16 h-16 rounded-full bg-lime-300 flex items-center justify-center shadow-sm">
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
              <i className="ri-shield-check-line text-3xl text-black"></i>
            </div>

            <p className="text-base font-medium text-gray-900 mt-3 leading-5">
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
          className="w-full rounded-xl bg-gray-100 px-4 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <i className="ri-message-3-line text-2xl text-gray-800"></i>
            <span className="text-lg font-semibold text-gray-500 truncate">
              ¿Tienes alguna observación para el conductor?
            </span>
          </div>

          <i className="ri-arrow-right-s-line text-2xl text-gray-900"></i>
        </button>
      </div>

      <div className="px-5 mt-6">
        <p className="text-lg text-gray-500 mb-2">Pago</p>

        <div className="rounded-[22px] border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">
              Pago contra servicio
            </p>
            <p className="text-sm text-gray-500">Valor acordado</p>
          </div>

          <p className="text-xl font-extrabold text-gray-900">
            {formatCOP(finalFare)}
          </p>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[24px] border border-gray-200 bg-gray-50 p-4">
          <p className="text-base font-bold text-gray-900 mb-4">
            Detalles del recorrido
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-map-pin-range-fill text-lg"></i>
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

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-square-fill text-lg"></i>
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

            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={driverPhoto}
                  alt={driverName}
                  className="w-12 h-12 rounded-full object-cover bg-gray-200"
                />

                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-gray-900 truncate">
                    {driverName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {color} {vehicleLabel} · {plate}
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
    </div>
  );
};

export default DriverSelected;