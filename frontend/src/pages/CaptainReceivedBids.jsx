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

const CaptainReceivedBids = () => {
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);
  const [actingId, setActingId] = useState("");
  const [counterInputs, setCounterInputs] = useState({});

  const token = localStorage.getItem("token");

  const fetchReceivedBids = async () => {
    try {
      setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchReceivedBids();
  }, []);

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

      const currentCounter = counterInputs[bidId] || {};
      const payload = {
        bidId,
        action,
      };

      if (action === "countered") {
        payload.counterPrice = Number(currentCounter.counterPrice || 0);
        payload.counterMessage = currentCounter.counterMessage || "";
      }

      await axios.post(`${getApiBaseUrl()}/offers/bid/respond`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await fetchReceivedBids();
    } catch (error) {
      console.error("Error respondiendo oferta:", error);
      alert(
        error?.response?.data?.message ||
          "No se pudo responder la oferta."
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
            to="/captain-home"
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </Link>

          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Ofertas recibidas
            </h1>
            <p className="text-xs text-gray-600">
              Acepta, rechaza o contraoferta
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchReceivedBids}
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
        >
          <i className="ri-refresh-line text-lg"></i>
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600">
            Cargando ofertas recibidas...
          </div>
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center">
            Aún no has recibido ofertas de usuarios.
          </div>
        ) : (
          <div className="space-y-4">
            {bids.map((bid) => {
              const bidId = bid._id;
              const counter = counterInputs[bidId] || {};
              const isPending = bid.status === "pending";
              const customerName =
                bid?.customer?.fullname?.firstname ||
                bid?.customer?.fullname?.lastname
                  ? `${bid?.customer?.fullname?.firstname || ""} ${
                      bid?.customer?.fullname?.lastname || ""
                    }`.trim()
                  : bid?.customer?.email || "Cliente";

              return (
                <div
                  key={bidId}
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
                      <span className="font-semibold">Cliente:</span>{" "}
                      {customerName}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Publicación:</span>{" "}
                      {getListingMeta(bid)}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Solicita:</span>{" "}
                      {bid.requestedQuantity} {bid.requestedUnit}
                    </p>

                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Ofrece:</span>{" "}
                      {formatCOP(bid.offeredPrice)}
                    </p>

                    {bid.message ? (
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Mensaje:</span>{" "}
                        {bid.message}
                      </p>
                    ) : null}

                    {bid.status === "countered" && bid.counterPrice ? (
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">Contraoferta enviada:</span>{" "}
                        {formatCOP(bid.counterPrice)}
                      </p>
                    ) : null}

                    {bid.status === "countered" && bid.counterMessage ? (
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">Mensaje de contraoferta:</span>{" "}
                        {bid.counterMessage}
                      </p>
                    ) : null}
                  </div>

                  {isPending ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => respondToBid(bidId, "accepted")}
                          disabled={actingId === `${bidId}-accepted`}
                          className="rounded-2xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-60"
                        >
                          {actingId === `${bidId}-accepted`
                            ? "Aceptando..."
                            : "Aceptar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => respondToBid(bidId, "rejected")}
                          disabled={actingId === `${bidId}-rejected`}
                          className="rounded-2xl bg-red-600 text-white py-3 font-semibold disabled:opacity-60"
                        >
                          {actingId === `${bidId}-rejected`
                            ? "Rechazando..."
                            : "Rechazar"}
                        </button>
                      </div>

                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <h4 className="text-sm font-bold text-amber-800 mb-3">
                          Enviar contraoferta
                        </h4>

                        <div className="space-y-3">
                          <input
                            type="number"
                            placeholder="Nuevo precio"
                            value={counter.counterPrice || ""}
                            onChange={(e) =>
                              updateCounterInput(
                                bidId,
                                "counterPrice",
                                e.target.value
                              )
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
                            className="w-full rounded-2xl bg-amber-500 text-white py-3 font-semibold disabled:opacity-60"
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptainReceivedBids;
