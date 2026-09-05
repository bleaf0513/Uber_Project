import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import { SocketContext } from "../context/SocketContext";
import { UserDataContext } from "../context/UserContext";

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const getStoredUserId = () => {
  try {
    const rawUser =
      localStorage.getItem("user") ||
      localStorage.getItem("userData") ||
      localStorage.getItem("userInfo");

    if (!rawUser) return "";

    const parsed = JSON.parse(rawUser);
    return parsed?._id || parsed?.id || "";
  } catch {
    return "";
  }
};

const getListingTitle = (bid) => {
  if (bid?.listingType === "goods" && bid?.goodsOffer) {
    return bid.goodsOffer.productName || "Mercancía";
  }

  if (bid?.listingType === "space" && bid?.spaceOffer) {
    return bid.spaceOffer.cargoType
      ? `Espacio para ${bid.spaceOffer.cargoType}`
      : "Espacio disponible";
  }

  if (bid?.listingType === "seat" && bid?.seatOffer) {
    return "Cupos disponibles";
  }

  return "Oferta";
};

const getListingRoute = (bid) => {
  const source = bid?.goodsOffer || bid?.spaceOffer || bid?.seatOffer;

  if (!source) return "";

  return `${source.origin || "Origen"} → ${source.destination || "Destino"}`;
};

const getListingMeta = (bid) => {
  if (bid?.listingType === "goods" && bid?.goodsOffer) {
    const available = Number(
      bid.goodsOffer.availableReal ??
        bid.goodsOffer.realAvailable ??
        bid.goodsOffer.quantityAvailable ??
        0
    );

    return `${available} ${bid.goodsOffer.quantityUnit || ""} disponibles`;
  }

  if (bid?.listingType === "space" && bid?.spaceOffer) {
    const available = Number(
      bid.spaceOffer.availableReal ??
        bid.spaceOffer.realAvailable ??
        bid.spaceOffer.capacityAvailable ??
        0
    );

    return `${available} ${bid.spaceOffer.capacityUnit || ""} disponibles`;
  }

  if (bid?.listingType === "seat" && bid?.seatOffer) {
    const available = Number(
      bid.seatOffer.availableReal ??
        bid.seatOffer.realAvailable ??
        bid.seatOffer.seatsAvailable ??
        0
    );

    return `${available} ${bid.seatOffer.seatUnit || ""} disponibles`;
  }

  return "";
};

const getTypeLabel = (listingType) => {
  if (listingType === "goods") return "Mercancía";
  if (listingType === "space") return "Espacio";
  if (listingType === "seat") return "Cupos";
  return "Oferta";
};

const statusLabel = (status) => {
  const map = {
    pending: "Pendiente",
    accepted: "Aceptada",
    rejected: "Rechazada",
    countered: "Contraoferta",
    completed: "Completada",
    cancelled: "Cancelada",
  };

  return map[status] || status || "Pendiente";
};

const statusBadgeClass = (status) => {
  switch (status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-700 border-red-200";
    case "countered":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "cancelled":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-violet-100 text-violet-700 border-violet-200";
  }
};

const getDriverName = (driver) => {
  const first = driver?.fullname?.firstname || "";
  const last = driver?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || "Transportador";
};

const getTheme = (listingType) => {
  if (listingType === "goods") {
    return {
      icon: "ri-shopping-basket-2-line",
      text: "text-orange-700",
      softBg: "bg-orange-50",
      border: "border-orange-200",
      gradient: "from-orange-500 to-amber-500",
      button: "bg-orange-600",
      shadow: "shadow-orange-600/20",
    };
  }

  if (listingType === "space") {
    return {
      icon: "ri-inbox-archive-line",
      text: "text-blue-700",
      softBg: "bg-blue-50",
      border: "border-blue-200",
      gradient: "from-blue-600 to-cyan-500",
      button: "bg-blue-600",
      shadow: "shadow-blue-600/20",
    };
  }

  return {
    icon: "ri-user-3-line",
    text: "text-emerald-700",
    softBg: "bg-emerald-50",
    border: "border-emerald-200",
    gradient: "from-emerald-600 to-teal-500",
    button: "bg-emerald-600",
    shadow: "shadow-emerald-600/20",
  };
};

const AcceptedBidChat = ({ bid, token, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(true);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  const bidId = bid?._id;
  const source = bid?.goodsOffer || bid?.spaceOffer || bid?.seatOffer || {};

  const loadChat = useCallback(async () => {
    if (!bidId || !token) return;

    try {
      setChatError("");

      const response = await axios.get(
        `${getApiBaseUrl()}/offers/bid/${bidId}/chat/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages(
        Array.isArray(response?.data?.messages)
          ? response.data.messages
          : []
      );
    } catch (err) {
      setChatError(
        err?.response?.data?.message ||
          "No se pudo cargar la conversación."
      );
    } finally {
      setLoadingChat(false);
    }
  }, [bidId, token]);

  useEffect(() => {
    loadChat();
    const interval = window.setInterval(loadChat, 5000);
    return () => window.clearInterval(interval);
  }, [loadChat]);

  const sendMessage = async () => {
    const cleanMessage = draft.trim();
    if (!cleanMessage || sendingChat) return;

    try {
      setSendingChat(true);
      setChatError("");

      const response = await axios.post(
        `${getApiBaseUrl()}/offers/bid/chat/user`,
        {
          bidId,
          message: cleanMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response?.data?.message) {
        setMessages((prev) => [...prev, response.data.message]);
      }

      setDraft("");
    } catch (err) {
      setChatError(
        err?.response?.data?.message ||
          "No se pudo enviar el mensaje."
      );
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md h-[86vh] sm:h-[720px] bg-white rounded-t-[30px] sm:rounded-[30px] overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-gradient-to-r from-violet-800 to-fuchsia-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Cerrar chat"
            >
              <i className="ri-arrow-left-line text-xl" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-black">
                Oferta aceptada · Chat habilitado
              </p>
              <h3 className="font-black text-lg truncate">
                {getListingTitle(bid)}
              </h3>
              <p className="text-xs text-white/80 truncate">
                {source?.origin || "Origen"} → {source?.destination || "Destino"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <i className="ri-chat-3-fill text-xl" />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100">
          <p className="text-[11px] text-emerald-800 font-bold">
            Conversación privada con el transportador de esta operación.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-2">
          {loadingChat && messages.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              Cargando conversación...
            </p>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto">
                <i className="ri-chat-smile-3-line text-2xl" />
              </div>
              <p className="font-black text-gray-900 mt-3">
                Ya pueden comunicarse
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Envía el primer mensaje para coordinar la operación.
              </p>
            </div>
          ) : (
            messages.map((item, index) => {
              const mine = item?.senderType === "user";

              return (
                <div
                  key={item?._id || `${item?.createdAt}-${index}`}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-[18px] px-3 py-2.5 ${
                      mine
                        ? "bg-violet-700 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {item?.message}
                    </p>
                    <p
                      className={`text-[9px] mt-1 ${
                        mine ? "text-white/65" : "text-gray-400"
                      }`}
                    >
                      {item?.createdAt
                        ? new Date(item.createdAt).toLocaleTimeString("es-CO", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {chatError ? (
            <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
              {chatError}
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              maxLength={1000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="min-h-[46px] max-h-28 flex-1 resize-none rounded-2xl bg-gray-100 px-4 py-3 text-sm outline-none"
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={!draft.trim() || sendingChat}
              className="w-12 h-12 rounded-2xl bg-violet-700 text-white flex items-center justify-center disabled:opacity-40"
            >
              <i
                className={
                  sendingChat
                    ? "ri-loader-4-line animate-spin text-xl"
                    : "ri-send-plane-2-fill text-xl"
                }
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserSentBids = () => {
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [socketStatus, setSocketStatus] = useState("Desconectado");
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [chatBid, setChatBid] = useState(null);

  const token = localStorage.getItem("token");

  // Reutilizamos la conexión global de Central GO.
  // No abrimos un segundo Socket.IO solo para esta pantalla.
  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);

  const userId = useMemo(
    () => user?._id || user?.id || getStoredUserId(),
    [user?._id, user?.id]
  );

  const fetchMySentBids = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        setError("");

        const response = await axios.get(
          `${getApiBaseUrl()}/offers/bid/my-sent`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setBids(Array.isArray(response?.data?.bids) ? response.data.bids : []);
      } catch (err) {
        console.error("Error cargando mis ofertas enviadas:", err);
        setError(
          err?.response?.data?.message ||
            "No se pudieron cargar tus ofertas enviadas."
        );
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    fetchMySentBids();
  }, [token, fetchMySentBids]);

  useEffect(() => {
    if (!socket || !userId) {
      setSocketStatus("Desconectado");
      return;
    }

    const joinUserSocket = () => {
      try {
        socket.emit("join", {
          userId,
          userType: "user",
        });

        // Mientras esperamos confirmación del servidor,
        // ya sabemos que el transporte está conectado.
        setSocketStatus(socket.connected ? "Conectado" : "Conectando");
      } catch (error) {
        console.error("Error haciendo join de usuario:", error);
        setSocketStatus("Error de conexión");
      }
    };

    const handleConnect = () => {
      setSocketStatus("Conectado");
      joinUserSocket();
    };

    const handleDisconnect = () => {
      setSocketStatus("Desconectado");
    };

    const handleConnectError = (socketError) => {
      console.error("Socket error usuario:", socketError);
      setSocketStatus("Error de conexión");
    };

    const handleSocketJoined = (data) => {
      if (data?.ok !== false) {
        setSocketStatus("Notificaciones activas");
      }
    };

    const handleOfferBidUpdated = async (data = {}) => {
      const title = data.notificationTitle || "Respuesta a tu oferta";
      const body =
        data.notificationBody ||
        `El transportador respondió tu oferta para ${
          data.title || "una publicación"
        }.`;

      setNotificationBanner({
        type: data.action || data.status || "updated",
        title,
        body,
        createdAt: new Date().toISOString(),
      });

      await fetchMySentBids(false);

      setTimeout(() => {
        setNotificationBanner(null);
      }, 9000);
    };

    // El chat del marketplace puede notificar por socket.
    // El modal ya hace respaldo por polling cada 5 segundos.
    const handleAcceptedBidChatMessage = async () => {
      await fetchMySentBids(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("socket-joined", handleSocketJoined);
    socket.on("offer-bid-updated", handleOfferBidUpdated);
    socket.on("accepted-bid-chat-message", handleAcceptedBidChatMessage);

    // Si llegamos a esta pantalla con el socket global YA conectado,
    // 'connect' no volverá a dispararse; por eso hacemos join de una vez.
    if (socket.connected) {
      setSocketStatus("Conectado");
      joinUserSocket();
    } else {
      setSocketStatus("Conectando");
      socket.connect?.();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("socket-joined", handleSocketJoined);
      socket.off("offer-bid-updated", handleOfferBidUpdated);
      socket.off("accepted-bid-chat-message", handleAcceptedBidChatMessage);

      // MUY IMPORTANTE:
      // No hacemos socket.disconnect() porque esta conexión es compartida
      // por toda Central GO mediante SocketContext.
    };
  }, [socket, userId, fetchMySentBids]);

  const handleCustomerResponse = async (bidId, action) => {
    try {
      setActingId(`${bidId}-${action}`);

      await axios.post(
        `${getApiBaseUrl()}/offers/bid/customer-respond`,
        {
          bidId,
          action,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchMySentBids(false);
    } catch (err) {
      console.error("Error respondiendo contraoferta:", err);
      alert(
        err?.response?.data?.message || "No se pudo responder la contraoferta."
      );
    } finally {
      setActingId("");
    }
  };

  const renderBidCard = (bid) => {
    const theme = getTheme(bid.listingType);
    const driverName = getDriverName(bid.driver);
    const isCountered = bid.status === "countered";

    return (
      <div
        key={bid._id}
        className="relative overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.10)]"
      >
        <div className={`h-2 bg-gradient-to-r ${theme.gradient}`} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl ${theme.softBg} ${theme.text} border ${theme.border} flex items-center justify-center`}
              >
                <i className={`${theme.icon} text-2xl`} />
              </div>

              <div>
                <p
                  className={`text-xs font-black uppercase tracking-wide ${theme.text}`}
                >
                  {getTypeLabel(bid.listingType)}
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {getListingTitle(bid)}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {getListingRoute(bid)}
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-full border ${statusBadgeClass(
                bid.status
              )}`}
            >
              {statusLabel(bid.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">Solicitaste</p>
              <p className="text-lg font-black mt-1">
                {bid.requestedQuantity} {bid.requestedUnit}
              </p>
            </div>

            <div
              className={`${theme.softBg} border ${theme.border} rounded-2xl px-4 py-3`}
            >
              <p className={`text-xs font-bold ${theme.text}`}>Tu oferta</p>
              <p className={`text-lg font-black mt-1 ${theme.text}`}>
                {formatCOP(bid.offeredPrice)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">Transportador:</span> {driverName}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">Disponible publicación:</span>{" "}
              {getListingMeta(bid)}
            </p>

            {bid.message ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Tu mensaje
                </p>
                <p className="text-sm text-gray-700">{bid.message}</p>
              </div>
            ) : null}

            {bid.status === "accepted" ? (
              <div className="rounded-2xl bg-emerald-100 border border-emerald-200 px-4 py-3">
                <p className="text-sm text-emerald-800 font-black">
                  El transportador aceptó tu oferta.
                </p>
              </div>
            ) : null}

            {bid.status === "accepted" ? (
              <button
                type="button"
                onClick={() => setChatBid(bid)}
                className="w-full rounded-2xl bg-violet-700 text-white py-3.5 font-black flex items-center justify-center gap-2 shadow-lg shadow-violet-700/20"
              >
                <i className="ri-chat-3-fill text-lg" />
                Abrir chat con el transportador
              </button>
            ) : null}

            {bid.status === "rejected" ? (
              <div className="rounded-2xl bg-red-100 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-800 font-black">
                  El transportador rechazó tu oferta.
                </p>
              </div>
            ) : null}

            {bid.status === "countered" && bid.counterPrice ? (
              <div className="rounded-2xl bg-amber-100 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">
                  <span className="font-black">Contraoferta recibida:</span>{" "}
                  {formatCOP(bid.counterPrice)}
                </p>

                {bid.counterMessage ? (
                  <p className="text-sm text-amber-800 mt-1">
                    <span className="font-black">Mensaje:</span>{" "}
                    {bid.counterMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {isCountered ? (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleCustomerResponse(bid._id, "accepted")}
                disabled={actingId === `${bid._id}-accepted`}
                className="rounded-2xl bg-emerald-600 text-white py-3 font-black disabled:opacity-60 shadow-lg shadow-emerald-600/20"
              >
                {actingId === `${bid._id}-accepted`
                  ? "Aceptando..."
                  : "Aceptar contraoferta"}
              </button>

              <button
                type="button"
                onClick={() => handleCustomerResponse(bid._id, "rejected")}
                disabled={actingId === `${bid._id}-rejected`}
                className="rounded-2xl bg-red-600 text-white py-3 font-black disabled:opacity-60 shadow-lg shadow-red-600/20"
              >
                {actingId === `${bid._id}-rejected`
                  ? "Rechazando..."
                  : "Rechazar"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>

            <div>
              <h1 className="text-lg font-black text-gray-950">
                Mis ofertas enviadas
              </h1>
              <p className="text-xs text-gray-600">
                Revisa respuestas y contraofertas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchMySentBids()}
            className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200"
          >
            <i className="ri-refresh-line text-lg"></i>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                socketStatus === "Notificaciones activas" ||
                socketStatus === "Conectado"
                  ? "bg-emerald-500"
                  : socketStatus === "Conectando"
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
            />
            <span>
              Tiempo real:{" "}
              <span className="font-black text-gray-900">{socketStatus}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {notificationBanner ? (
          <div className="mb-4 rounded-[24px] bg-slate-950 text-white border border-slate-800 p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center">
                <i className="ri-notification-3-line text-xl" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-black">{notificationBanner.title}</p>
                <p className="text-sm text-white/80 mt-1">
                  {notificationBanner.body}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNotificationBanner(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600 shadow-sm">
            Cargando ofertas...
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-[24px] border border-red-200 p-5 text-sm text-red-700 font-bold">
            {error}
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center shadow-sm">
            Aún no has enviado ofertas.
          </div>
        ) : (
          <div className="space-y-5">{bids.map(renderBidCard)}</div>
        )}
      </div>

      {chatBid ? (
        <AcceptedBidChat
          bid={chatBid}
          token={token}
          onClose={() => setChatBid(null)}
        />
      ) : null}
    </div>
  );
};

export default UserSentBids;