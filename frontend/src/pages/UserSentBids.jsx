import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "../apiBase";

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

const UserSentBids = () => {
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [socketStatus, setSocketStatus] = useState("Desconectado");
  const [notificationBanner, setNotificationBanner] = useState(null);

  const socketRef = useRef(null);
  const token = localStorage.getItem("token");

  const userId = useMemo(() => getStoredUserId(), []);

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
    if (!userId) return;

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
        userId,
        userType: "user",
      });
    });

    socket.on("disconnect", () => {
      setSocketStatus("Desconectado");
    });

    socket.on("connect_error", (socketError) => {
      console.error("Socket error usuario:", socketError);
      setSocketStatus("Error de conexión");
    });

    socket.on("socket-joined", (data) => {
      if (data?.ok) {
        setSocketStatus("Notificaciones activas");
      }
    });

    socket.on("offer-bid-updated", async (data = {}) => {
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
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("socket-joined");
      socket.off("offer-bid-updated");
      socket.disconnect();
    };
  }, [userId, fetchMySentBids]);

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
                {actingId === `${bid._id}-rejected`}
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
          <div className="text-[11px] text-gray-600">
            Estado socket:{" "}
            <span className="font-black text-gray-900">{socketStatus}</span>
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
    </div>
  );
};

export default UserSentBids;