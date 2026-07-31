import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

import { getApiBaseUrl } from "../apiBase";

const STATUS_LABELS = {
  pending: "Pendiente",
  countered: "Contraoferta",
  accepted: "Aceptada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const TRACKING_STATUS_LABELS = {
  pending_confirmation: "Pendiente de confirmación",
  awaiting_reservation: "Esperando reserva",
  confirmed: "Servicio confirmado",
  driver_heading_to_pickup: "Voy a recoger",
  picked_up: "Carga recogida",
  in_transit: "En camino al destino",
  delivered: "Carga entregada",
  completed: "Servicio finalizado",
  cancelled: "Servicio cancelado",
};

const getCaptainToken = () =>
  localStorage.getItem("captainToken") ||
  localStorage.getItem("token") ||
  "";

const formatCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "Por definir";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Por definir";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getCustomerName = (customer) => {
  const first =
    customer?.fullname?.firstname || "";
  const last =
    customer?.fullname?.lastname || "";

  return (
    `${first} ${last}`.trim() ||
    customer?.email ||
    "Cliente"
  );
};

const getStatusClasses = (status) => {
  if (status === "accepted") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (status === "countered") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
};

const CaptainLoadProposals = () => {
  const navigate = useNavigate();
  const token = getCaptainToken();

  const [bids, setBids] = useState([]);
  const [trackings, setTrackings] = useState([]);
  const [activeFilter, setActiveFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [respondingBidId, setRespondingBidId] =
    useState("");

  const [pageError, setPageError] =
    useState("");

  const [pageSuccess, setPageSuccess] =
    useState("");

  const trackingByBid = useMemo(() => {
    const map = {};

    trackings.forEach((tracking) => {
      const bidId =
        tracking?.acceptedBid?._id ||
        tracking?.acceptedBid;

      if (bidId) {
        map[String(bidId)] = tracking;
      }
    });

    return map;
  }, [trackings]);

  const counts = useMemo(() => ({
    all: bids.length,
    pending: bids.filter(
      (bid) => bid.status === "pending"
    ).length,
    countered: bids.filter(
      (bid) => bid.status === "countered"
    ).length,
    accepted: bids.filter(
      (bid) => bid.status === "accepted"
    ).length,
    rejected: bids.filter(
      (bid) => bid.status === "rejected"
    ).length,
  }), [bids]);

  const filteredBids = useMemo(() => {
    if (activeFilter === "all") {
      return bids;
    }

    return bids.filter(
      (bid) =>
        bid.status === activeFilter
    );
  }, [bids, activeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setPageError("");

      const [
        bidsResponse,
        trackingResponse,
      ] = await Promise.all([
        axios.get(
          `${getApiBaseUrl()}/offers/space/bid/my-sent`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        ),
        axios.get(
          `${getApiBaseUrl()}/marketplace-load-tracking/captain/my-trackings`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        ),
      ]);

      setBids(
        Array.isArray(
          bidsResponse?.data?.bids
        )
          ? bidsResponse.data.bids
          : []
      );

      setTrackings(
        Array.isArray(
          trackingResponse?.data?.trackings
        )
          ? trackingResponse.data.trackings
          : []
      );
    } catch (error) {
      console.error(
        "Error cargando propuestas:",
        error
      );

      setPageError(
        error?.response?.data?.message ||
          "No se pudieron cargar tus propuestas."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate(
        "/captain-login",
        { replace: true }
      );
      return;
    }

    fetchData();
  }, []);

  const respondCounter = async (
    bid,
    action
  ) => {
    const confirmed = window.confirm(
      action === "accepted"
        ? `¿Aceptar la contraoferta de ${formatCOP(
            bid.counterPrice
          )}?`
        : "¿Rechazar esta contraoferta?"
    );

    if (!confirmed) return;

    try {
      setRespondingBidId(bid._id);
      setPageError("");
      setPageSuccess("");

      await axios.post(
        `${getApiBaseUrl()}/offers/space/bid/captain-respond`,
        {
          bidId: bid._id,
          action,
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setPageSuccess(
        action === "accepted"
          ? "Servicio asignado correctamente."
          : "Contraoferta rechazada."
      );

      await fetchData();
    } catch (error) {
      setPageError(
        error?.response?.data?.message ||
          "No se pudo responder la contraoferta."
      );
    } finally {
      setRespondingBidId("");
    }
  };

  const filterButtons = [
    ["all", "Todas"],
    ["pending", "Pendientes"],
    ["countered", "Contraofertas"],
    ["accepted", "Aceptadas"],
    ["rejected", "Rechazadas"],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/captain-home"
              className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div>
              <h1 className="text-lg font-black text-gray-950">
                Propuestas y servicios
              </h1>

              <p className="text-xs text-gray-600">
                Cada carga en una tarjeta independiente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="w-11 h-11 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center"
          >
            <i className="ri-refresh-line text-lg" />
          </button>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {filterButtons.map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setActiveFilter(key)
                }
                className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black ${
                  activeFilter === key
                    ? "bg-purple-700 text-white border-purple-700"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {label}{" "}
                <span className="ml-1 opacity-80">
                  {counts[key] || 0}
                </span>
              </button>
            )
          )}
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="rounded-[28px] bg-gradient-to-r from-purple-900 via-violet-700 to-fuchsia-600 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
            Panel logístico
          </p>

          <h2 className="text-2xl font-black mt-1">
            Todos los servicios
          </h2>

          <p className="text-sm text-white/80 mt-2">
            Abre cada servicio para ver mapa, ruta,
            cliente y estados sin saturar esta pantalla.
          </p>
        </section>

        {pageError ? (
          <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm font-bold">
            {pageError}
          </div>
        ) : null}

        {pageSuccess ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-sm font-bold">
            {pageSuccess}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-5 text-sm text-gray-600">
            Cargando propuestas...
          </div>
        ) : filteredBids.length === 0 ? (
          <div className="rounded-[28px] bg-white border border-gray-200 p-7 text-center">
            <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
              <i className="ri-file-list-3-line text-3xl" />
            </div>

            <h3 className="font-black text-gray-900 mt-3">
              No hay registros en esta categoría
            </h3>
          </div>
        ) : (
          <section className="space-y-4">
            {filteredBids.map((bid) => {
              const load =
                bid?.spaceOffer || {};

              const tracking =
                trackingByBid[
                  String(bid._id)
                ] || null;

              const trackingStatus =
                TRACKING_STATUS_LABELS[
                  tracking?.status
                ] ||
                tracking?.status ||
                "Preparando seguimiento";

              const isResponding =
                respondingBidId === bid._id;

              return (
                <article
                  key={bid._id}
                  className="overflow-hidden rounded-[28px] bg-white border border-gray-200 shadow-[0_16px_45px_rgba(15,23,42,0.10)]"
                >
                  <div
                    className={`h-2 ${
                      bid.status === "accepted"
                        ? "bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600"
                        : bid.status === "countered"
                        ? "bg-gradient-to-r from-amber-400 to-orange-500"
                        : "bg-gradient-to-r from-purple-700 to-fuchsia-500"
                    }`}
                  />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <i className="ri-truck-line text-2xl" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-700">
                            {load.publicationCode ||
                              "Carga"}
                          </p>

                          <h2 className="text-lg font-black text-gray-950 mt-1 truncate">
                            {load.title ||
                              load.cargoType ||
                              "Servicio de carga"}
                          </h2>

                          <p className="text-xs text-gray-600 mt-1 truncate">
                            {load.origin ||
                              "Origen"}{" "}
                            →{" "}
                            {load.destination ||
                              "Destino"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${getStatusClasses(
                          bid.status
                        )}`}
                      >
                        {STATUS_LABELS[
                          bid.status
                        ] || bid.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="rounded-2xl bg-slate-950 text-white p-3">
                        <p className="text-[10px] uppercase font-black text-white/55">
                          Valor
                        </p>

                        <p className="text-lg font-black mt-1">
                          {formatCOP(
                            bid.counterPrice ||
                              bid.offeredPrice
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                        <p className="text-[10px] uppercase font-black text-gray-500">
                          Recogida
                        </p>

                        <p className="text-xs font-black text-gray-900 mt-1">
                          {formatDate(
                            bid.availablePickupTime ||
                              load.pickupTime
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase font-black text-gray-500">
                            Cliente
                          </p>

                          <p className="text-sm font-black text-gray-900 mt-1">
                            {getCustomerName(
                              bid.customer
                            )}
                          </p>
                        </div>

                        {bid.status ===
                          "accepted" && (
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-black text-gray-500">
                              Servicio
                            </p>

                            <p className="text-xs font-black text-purple-700 mt-1">
                              {trackingStatus}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {bid.status ===
                      "accepted" && (
                      <button
                        type="button"
                        disabled={!tracking?._id}
                        onClick={() =>
                          navigate(
                            `/captain/load-service/${tracking._id}`
                          )
                        }
                        className="w-full mt-4 rounded-2xl bg-gradient-to-r from-purple-800 via-violet-700 to-fuchsia-600 text-white py-3.5 font-black shadow-lg disabled:opacity-50"
                      >
                        <i className="ri-settings-3-line mr-1" />
                        {tracking?._id
                          ? "Gestionar servicio"
                          : "Preparando servicio..."}
                      </button>
                    )}

                    {bid.status ===
                      "countered" && (
                      <div className="mt-4">
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                          <p className="text-xs font-black uppercase text-amber-700">
                            Contraoferta del cliente
                          </p>

                          <p className="text-xl font-black text-amber-900 mt-1">
                            {formatCOP(
                              bid.counterPrice
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <button
                            type="button"
                            disabled={isResponding}
                            onClick={() =>
                              respondCounter(
                                bid,
                                "rejected"
                              )
                            }
                            className="rounded-2xl bg-red-50 border border-red-200 text-red-700 py-3 font-black disabled:opacity-50"
                          >
                            Rechazar
                          </button>

                          <button
                            type="button"
                            disabled={isResponding}
                            onClick={() =>
                              respondCounter(
                                bid,
                                "accepted"
                              )
                            }
                            className="rounded-2xl bg-emerald-600 text-white py-3 font-black disabled:opacity-50"
                          >
                            {isResponding
                              ? "Procesando..."
                              : "Aceptar"}
                          </button>
                        </div>
                      </div>
                    )}

                    {bid.status ===
                      "pending" && (
                      <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 text-sm font-bold">
                        <i className="ri-time-line mr-1" />
                        Esperando respuesta del cliente.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
};

export default CaptainLoadProposals;