import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const formatCOP = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const getListingTitle = (bid) => {
  if (bid?.listingType === "goods" && bid?.goodsOffer) {
    return bid.goodsOffer.productName || "Mercancía";
  }

  if (bid?.listingType === "space" && bid?.spaceOffer) {
    return "Espacio disponible";
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
    return `${bid.goodsOffer.quantityAvailable || 0} ${
      bid.goodsOffer.quantityUnit || ""
    }`;
  }

  if (bid?.listingType === "space" && bid?.spaceOffer) {
    return `${bid.spaceOffer.capacityAvailable || 0} ${
      bid.spaceOffer.capacityUnit || ""
    }`;
  }

  if (bid?.listingType === "seat" && bid?.seatOffer) {
    return `${bid.seatOffer.seatsAvailable || 0} ${
      bid.seatOffer.seatUnit || ""
    }`;
  }

  return "";
};

const statusBadgeClass = (status) => {
  switch (status) {
    case "accepted":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "countered":
      return "bg-amber-100 text-amber-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
    case "cancelled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-violet-100 text-violet-700";
  }
};

const UserSentBids = () => {
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");

  const token = localStorage.getItem("token");

  const fetchMySentBids = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchMySentBids();
  }, []);

  const handleCustomerResponse = async (bidId, action) => {
    try {
      setActingId(`${bidId}-${action}`);

      await axios.post(
        `${getApiBaseUrl()}/offers/bid/customer-respond`,
        {
          bidId,
          action, // accepted | rejected
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchMySentBids();
    } catch (err) {
      console.error("Error respondiendo contraoferta:", err);
      alert(
        err?.response?.data?.message ||
          "No se pudo responder la contraoferta."
      );
    } finally {
      setActingId("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </Link>

          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Mis ofertas enviadas
            </h1>
            <p className="text-xs text-gray-600">
              Revisa respuestas y contraofertas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMySentBids}
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
        >
          <i className="ri-refresh-line text-lg"></i>
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600">
            Cargando ofertas...
          </div>
        ) : error ? (
          <div className="bg-white rounded-[24px] border border-red-200 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center">
            Aún no has enviado ofertas.
          </div>
        ) : (
          <div className="space-y-4">
            {bids.map((bid) => {
              const driverName =
                bid?.driver?.fullname?.firstname || bid?.driver?.fullname?.lastname
                  ? `${bid?.driver?.fullname?.firstname || ""} ${
                      bid?.driver?.fullname?.lastname || ""
                    }`.trim()
                  : "Transportador";

              const isCountered = bid.status === "countered";

              return (
                <div
                  key={bid._id}
                  className="bg-white rounded-[24px] border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                        {bid.listingType === "goods"
                          ? "Mercancía"
                          : bid.listingType === "space"
                          ? "Espacio"
                          : "Cupos"}
                      </p>

                      <h3 className="text-lg font-bold text-gray-900 mt-1">
                        {getListingTitle(bid)}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        {getListingRoute(bid)}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadgeClass(
                        bid.status
                      )}`}
                    >
                      {bid.status}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Transportador:</span>{" "}
                      {driverName}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Publicación:</span>{" "}
                      {getListingMeta(bid)}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Solicitaste:</span>{" "}
                      {bid.requestedQuantity} {bid.requestedUnit}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Tu oferta:</span>{" "}
                      {formatCOP(bid.offeredPrice)}
                    </p>

                    {bid.message ? (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Tu mensaje:</span>{" "}
                        {bid.message}
                      </p>
                    ) : null}

                    {bid.status === "accepted" ? (
                      <p className="text-sm text-emerald-700 font-semibold">
                        El transportador aceptó tu oferta.
                      </p>
                    ) : null}

                    {bid.status === "rejected" ? (
                      <p className="text-sm text-red-700 font-semibold">
                        El transportador rechazó tu oferta.
                      </p>
                    ) : null}

                    {bid.status === "countered" && bid.counterPrice ? (
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">
                          Contraoferta recibida:
                        </span>{" "}
                        {formatCOP(bid.counterPrice)}
                      </p>
                    ) : null}

                    {bid.status === "countered" && bid.counterMessage ? (
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">Mensaje:</span>{" "}
                        {bid.counterMessage}
                      </p>
                    ) : null}
                  </div>

                  {isCountered ? (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          handleCustomerResponse(bid._id, "accepted")
                        }
                        disabled={actingId === `${bid._id}-accepted`}
                        className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-60"
                      >
                        {actingId === `${bid._id}-accepted`
                          ? "Aceptando..."
                          : "Aceptar contraoferta"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleCustomerResponse(bid._id, "rejected")
                        }
                        disabled={actingId === `${bid._id}-rejected`}
                        className="rounded-2xl bg-red-600 text-white py-3 font-semibold disabled:opacity-60"
                      >
                        {actingId === `${bid._id}-rejected`
                          ? "Rechazando..."
                          : "Rechazar"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSentBids;
