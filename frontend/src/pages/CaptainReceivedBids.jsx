import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";
import { CaptainDataContext } from "../context/CaptainContext";

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const humanizeUnit = (unit) => {
  const map = {
    kg: "kg",
    gramos: "gramos",
    libras: "libras",
    bultos: "bultos",
    pacas: "pacas",
    cajas: "cajas",
    canastillas: "canastillas",
    toneladas: "toneladas",
    unidades: "unidades",
    m3: "m³",
    cupo: "cupo",
    cupos: "cupos",
    puesto: "puesto",
    puestos: "puestos",
    espacio_parcial: "espacio parcial",
    vehiculo_completo: "vehículo completo",
  };

  return map[unit] || unit || "";
};

const getStoredCaptainId = () => {
  try {
    const rawCaptain =
      localStorage.getItem("captain") ||
      localStorage.getItem("captainData") ||
      localStorage.getItem("captainInfo");

    if (!rawCaptain) return "";

    const parsed = JSON.parse(rawCaptain);
    return parsed?._id || parsed?.id || "";
  } catch {
    return "";
  }
};

const getListingSource = (bid) => {
  return bid?.goodsOffer || bid?.spaceOffer || bid?.seatOffer || null;
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
  const source = getListingSource(bid);

  if (!source) return "Ruta no disponible";

  return `${source.origin || "Origen"} → ${source.destination || "Destino"}`;
};

const getListingTypeLabel = (listingType) => {
  if (listingType === "goods") return "Mercancía";
  if (listingType === "space") return "Espacio";
  if (listingType === "seat") return "Cupos";
  return "Oferta";
};

const getAvailableInfo = (bid) => {
  if (bid?.listingType === "goods" && bid?.goodsOffer) {
    const quantity = Number(
      bid.goodsOffer.availableReal ??
        bid.goodsOffer.realAvailable ??
        bid.goodsOffer.quantityAvailable ??
        0
    );

    const unit = bid.goodsOffer.quantityUnit || "";

    return {
      quantity,
      unit,
      label: `${quantity} ${humanizeUnit(unit)}`,
      status: bid.goodsOffer.status || "active",
    };
  }

  if (bid?.listingType === "space" && bid?.spaceOffer) {
    const quantity = Number(
      bid.spaceOffer.availableReal ??
        bid.spaceOffer.realAvailable ??
        bid.spaceOffer.capacityAvailable ??
        0
    );

    const unit = bid.spaceOffer.capacityUnit || "";

    return {
      quantity,
      unit,
      label: `${quantity} ${humanizeUnit(unit)}`,
      status: bid.spaceOffer.status || "active",
    };
  }

  if (bid?.listingType === "seat" && bid?.seatOffer) {
    const quantity = Number(
      bid.seatOffer.availableReal ??
        bid.seatOffer.realAvailable ??
        bid.seatOffer.seatsAvailable ??
        0
    );

    const unit = bid.seatOffer.seatUnit || "";

    return {
      quantity,
      unit,
      label: `${quantity} ${humanizeUnit(unit)}`,
      status: bid.seatOffer.status || "active",
    };
  }

  return {
    quantity: 0,
    unit: "",
    label: "Sin disponibilidad",
    status: "",
  };
};

const getCustomerName = (customer) => {
  const first = customer?.fullname?.firstname || "";
  const last = customer?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || customer?.email || "Cliente";
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

const getTheme = (listingType) => {
  if (listingType === "goods") {
    return {
      icon: "ri-shopping-basket-2-line",
      label: "Mercancía",
      text: "text-orange-700",
      softBg: "bg-orange-50",
      badgeBg: "bg-orange-100 text-orange-700",
      border: "border-orange-200",
      gradient: "from-orange-500 to-amber-500",
      shadow: "shadow-orange-500/10",
    };
  }

  if (listingType === "space") {
    return {
      icon: "ri-inbox-archive-line",
      label: "Espacio",
      text: "text-blue-700",
      softBg: "bg-blue-50",
      badgeBg: "bg-blue-100 text-blue-700",
      border: "border-blue-200",
      gradient: "from-blue-600 to-cyan-500",
      shadow: "shadow-blue-500/10",
    };
  }

  return {
    icon: "ri-user-3-line",
    label: "Cupos",
    text: "text-emerald-700",
    softBg: "bg-emerald-50",
    badgeBg: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-200",
    gradient: "from-emerald-600 to-teal-500",
    shadow: "shadow-emerald-500/10",
  };
};

const AcceptedBidChat = ({ bid, token, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(true);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  const bidId = bid?._id;
  const source = getListingSource(bid);

  const loadChat = useCallback(async () => {
    if (!bidId || !token) return;

    try {
      setChatError("");

      const response = await axios.get(
        `${getApiBaseUrl()}/offers/bid/${bidId}/chat/captain`,
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
    } catch (error) {
      setChatError(
        error?.response?.data?.message ||
          "No se pudo cargar la conversación."
      );
    } finally {
      setLoadingChat(false);
    }
  }, [bidId, token]);

  useEffect(() => {
    loadChat();

    const interval = window.setInterval(() => {
      loadChat();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadChat]);

  const sendMessage = async () => {
    const cleanMessage = draft.trim();

    if (!cleanMessage || sendingChat) return;

    try {
      setSendingChat(true);
      setChatError("");

      const response = await axios.post(
        `${getApiBaseUrl()}/offers/bid/chat/captain`,
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
    } catch (error) {
      setChatError(
        error?.response?.data?.message ||
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
            Conversación privada con el cliente de esta operación.
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
              const mine = item?.senderType === "captain";

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

const CaptainReceivedBids = () => {
  const { captain } = useContext(CaptainDataContext);

  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [actingId, setActingId] = useState("");
  const [counterInputs, setCounterInputs] = useState({});
  const [message, setMessage] = useState("");
  const [socketStatus, setSocketStatus] = useState("Desconectado");
  const [notificationBanner, setNotificationBanner] = useState(null);
  const [chatBid, setChatBid] = useState(null);

  const socketRef = useRef(null);
  const token = localStorage.getItem("token");

  const captainId = useMemo(() => {
    return captain?._id || captain?.id || getStoredCaptainId();
  }, [captain?._id, captain?.id]);

  const stats = useMemo(() => {
    return {
      total: bids.length,
      pending: bids.filter((bid) => bid.status === "pending").length,
      accepted: bids.filter((bid) => bid.status === "accepted").length,
      countered: bids.filter((bid) => bid.status === "countered").length,
    };
  }, [bids]);

  const fetchReceivedBids = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        setMessage("");

        const response = await axios.get(
          `${getApiBaseUrl()}/offers/bid/my-received`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setBids(Array.isArray(response?.data?.bids) ? response.data.bids : []);
      } catch (error) {
        console.error("Error cargando ofertas recibidas:", error);

        setMessage(
          error?.response?.data?.message ||
            "No se pudieron cargar las ofertas recibidas."
        );
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    fetchReceivedBids();
  }, [token, fetchReceivedBids]);

  useEffect(() => {
    if (!captainId) return;

    const socket = io(getApiBaseUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("Conectado");

      socket.emit("join", {
        userId: captainId,
        userType: "captain",
      });
    });

    socket.on("disconnect", () => {
      setSocketStatus("Desconectado");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket error conductor:", error);
      setSocketStatus("Error de conexión");
    });

    socket.on("socket-joined", (data) => {
      if (data?.ok) {
        setSocketStatus("Notificaciones activas");
      }
    });

    socket.on("new-offer-bid", async (data = {}) => {
      const title = data.notificationTitle || "Nueva oferta recibida";
      const body =
        data.notificationBody ||
        `${data.customerName || "Un cliente"} envió una nueva oferta.`;

      setNotificationBanner({
        type: "new",
        title,
        body,
        createdAt: new Date().toISOString(),
      });

      await fetchReceivedBids(false);

      setTimeout(() => {
        setNotificationBanner(null);
      }, 9000);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("socket-joined");
      socket.off("new-offer-bid");
      socket.disconnect();
    };
  }, [captainId, fetchReceivedBids]);

  const updateCounterInput = (bidId, field, value) => {
    setCounterInputs((prev) => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [field]: value,
      },
    }));
  };

  const respondToBid = async (bidId, action) => {
    try {
      setActingId(`${bidId}-${action}`);
      setMessage("");

      const currentCounter = counterInputs[bidId] || {};

      const payload = {
        bidId,
        action,
      };

      if (action === "countered") {
        const counterPrice = Number(currentCounter.counterPrice || 0);

        if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
          setMessage("La contraoferta debe tener un valor mayor que 0.");
          setActingId("");
          return;
        }

        payload.counterPrice = counterPrice;
        payload.counterMessage = currentCounter.counterMessage || "";
      }

      const response = await axios.post(
        `${getApiBaseUrl()}/offers/bid/respond`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(response?.data?.message || "Respuesta enviada correctamente.");
      await fetchReceivedBids(false);
    } catch (error) {
      console.error("Error respondiendo oferta:", error);

      setMessage(
        error?.response?.data?.message || "No se pudo responder la oferta."
      );
    } finally {
      setActingId("");
    }
  };

  const renderBidCard = (bid) => {
    const bidId = bid._id;
    const counter = counterInputs[bidId] || {};
    const isPending = bid.status === "pending";
    const theme = getTheme(bid.listingType);
    const customerName = getCustomerName(bid.customer);
    const available = getAvailableInfo(bid);
    const requestedQuantity = Number(bid.requestedQuantity) || 0;
    const canAccept = isPending && requestedQuantity <= available.quantity;

    return (
      <div
        key={bidId}
        className={`relative overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.10)] ${theme.shadow}`}
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
                  {getListingTypeLabel(bid.listingType)}
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
              <p className="text-xs text-white/60 font-bold">
                Solicita el cliente
              </p>

              <p className="text-lg font-black mt-1">
                {bid.requestedQuantity} {humanizeUnit(bid.requestedUnit)}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-xs text-emerald-700 font-bold">
                Disponible actual
              </p>

              <p className="text-lg font-black text-emerald-800 mt-1">
                {available.label}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">Cliente:</span> {customerName}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">Valor ofrecido:</span>{" "}
              <span className="font-black text-gray-950">
                {formatCOP(bid.offeredPrice)}
              </span>
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">Estado publicación:</span>{" "}
              {available.status || "active"}
            </p>

            {bid.message ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Mensaje del cliente
                </p>

                <p className="text-sm text-gray-700">{bid.message}</p>
              </div>
            ) : null}

            {bid.status === "accepted" ? (
              <div className="rounded-2xl bg-emerald-100 border border-emerald-200 px-4 py-3">
                <p className="text-sm text-emerald-800 font-bold">
                  Oferta aceptada. La disponibilidad actual debe verse ya
                  descontada.
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
                Abrir chat con el cliente
              </button>
            ) : null}

            {bid.status === "countered" && bid.counterPrice ? (
              <div className="rounded-2xl bg-amber-100 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">
                  <span className="font-black">Contraoferta enviada:</span>{" "}
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

            {isPending && !canAccept ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 font-bold">
                  No puedes aceptar esta solicitud porque el cliente pide{" "}
                  {bid.requestedQuantity} {humanizeUnit(bid.requestedUnit)} y
                  solo quedan {available.label}.
                </p>
              </div>
            ) : null}
          </div>

          {isPending ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => respondToBid(bidId, "accepted")}
                  disabled={actingId === `${bidId}-accepted` || !canAccept}
                  className="rounded-2xl bg-emerald-600 text-white py-3 font-black disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  {actingId === `${bidId}-accepted`
                    ? "Aceptando..."
                    : "Aceptar"}
                </button>

                <button
                  type="button"
                  onClick={() => respondToBid(bidId, "rejected")}
                  disabled={actingId === `${bidId}-rejected`}
                  className="rounded-2xl bg-red-600 text-white py-3 font-black disabled:opacity-60 shadow-lg shadow-red-600/20"
                >
                  {actingId === `${bidId}-rejected`
                    ? "Rechazando..."
                    : "Rechazar"}
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
                <h4 className="text-sm font-black text-amber-900 mb-3 flex items-center gap-2">
                  <i className="ri-exchange-dollar-line text-lg" />
                  Enviar contraoferta
                </h4>

                <div className="space-y-3">
                  <input
                    type="number"
                    placeholder="Nuevo precio"
                    value={counter.counterPrice || ""}
                    onChange={(e) =>
                      updateCounterInput(bidId, "counterPrice", e.target.value)
                    }
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none"
                  />

                  <textarea
                    placeholder="Mensaje de contraoferta"
                    value={counter.counterMessage || ""}
                    onChange={(e) =>
                      updateCounterInput(
                        bidId,
                        "counterMessage",
                        e.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none resize-none"
                  />

                  <button
                    type="button"
                    onClick={() => respondToBid(bidId, "countered")}
                    disabled={actingId === `${bidId}-countered`}
                    className="w-full rounded-2xl bg-amber-500 text-white py-3 font-black disabled:opacity-60 shadow-lg shadow-amber-500/20"
                  >
                    {actingId === `${bidId}-countered`
                      ? "Enviando..."
                      : "Enviar contraoferta"}
                  </button>
                </div>
              </div>
            </>
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
              to="/captain-home"
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div>
              <h1 className="text-lg font-black text-gray-950">
                Ofertas recibidas
              </h1>

              <p className="text-xs text-gray-600">
                Acepta, rechaza o contraoferta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchReceivedBids()}
            className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200"
          >
            <i className="ri-refresh-line text-lg" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-600">
            Estado socket:{" "}
            <span className="font-black text-gray-900">{socketStatus}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-2xl bg-slate-950 text-white px-3 py-2">
            <p className="text-[10px] text-white/60 font-black">TOTAL</p>
            <p className="text-lg font-black">{stats.total}</p>
          </div>

          <div className="rounded-2xl bg-violet-50 text-violet-700 px-3 py-2 border border-violet-100">
            <p className="text-[10px] font-black">PEND.</p>
            <p className="text-lg font-black">{stats.pending}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-3 py-2 border border-emerald-100">
            <p className="text-[10px] font-black">ACEPT.</p>
            <p className="text-lg font-black">{stats.accepted}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 text-amber-700 px-3 py-2 border border-amber-100">
            <p className="text-[10px] font-black">CONTRA</p>
            <p className="text-lg font-black">{stats.countered}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {notificationBanner ? (
          <div className="mb-4 rounded-[24px] bg-slate-950 text-white border border-slate-800 p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-500 flex items-center justify-center">
                <i className="ri-notification-3-line text-xl" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-black">
                  {notificationBanner.title}
                </p>

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

        {message ? (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold border ${
              message.includes("No") ||
              message.includes("debe") ||
              message.includes("pudieron")
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600 shadow-sm">
            Cargando ofertas recibidas...
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center shadow-sm">
            Aún no has recibido ofertas de usuarios.
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

export default CaptainReceivedBids;