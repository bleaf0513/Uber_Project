import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const VEHICLE_LABELS = {
  moto: "Moto",
  carro: "Carro",
  motocarro: "Motocarro",
  camioneta: "Camioneta",
  van: "Van",
  camion_ultraliviano: "Camión ultraliviano",
  camion_liviano: "Camión liviano",
  camion_mediano: "Camión mediano",
  camion_pesado: "Camión pesado",
  camion_sencillo: "Camión sencillo",
  doble_troque: "Doble troque",
  volqueta: "Volqueta",
  minimula: "Minimula",
  tractomula: "Tractomula",
  cama_baja: "Cama baja",
  vehiculo_especial: "Vehículo especial",
  otro: "Otro",
};

const BODY_LABELS = {
  no_especificada: "No especificada",
  furgon_cerrado: "Furgón cerrado",
  estacas: "Estacas",
  plataforma: "Plataforma",
  refrigerada: "Refrigerada",
  volco: "Volco",
  tanque: "Tanque",
  portacontenedor: "Portacontenedor",
  cama_baja: "Cama baja",
  carroceria_abierta: "Carrocería abierta",
  otro: "Otro",
};

const STATUS_LABELS = {
  pending: "Pendiente",
  countered: "Contraoferta enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const LOAD_STATUS_LABELS = {
  borrador: "Borrador",
  active: "Publicada",
  paused: "Pausada",
  recibiendo_propuestas: "Recibiendo propuestas",
  assigned: "Transportador seleccionado",
  reserved: "Reservada",
  recogida: "Carga recogida",
  in_transit: "En camino",
  delivered: "Entregada",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

const formatCOP = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("es-CO").format(
    Number(value) || 0
  );
};

const formatDate = (value) => {
  if (!value) {
    return "Por definir";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Por definir";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getCaptainName = (captain) => {
  const first = captain?.fullname?.firstname || "";
  const last = captain?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || "Transportador";
};

const getBidStatusClasses = (status) => {
  if (status === "accepted") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (status === "countered") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  if (status === "completed") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  return "bg-gray-100 text-gray-700 border-gray-200";
};

const MyLoadOffers = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loads, setLoads] = useState([]);
  const [bids, setBids] = useState([]);

  const [loading, setLoading] = useState(false);
  const [respondingBidId, setRespondingBidId] =
    useState("");

  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  const [expandedLoadId, setExpandedLoadId] =
    useState("");

  const [counterModalOpen, setCounterModalOpen] =
    useState(false);

  const [selectedBid, setSelectedBid] = useState(null);

  const [counterForm, setCounterForm] = useState({
    counterPrice: "",
    counterMessage: "",
  });

  const bidsByLoad = useMemo(() => {
    const grouped = {};

    bids.forEach((bid) => {
      const loadId = String(
        bid?.spaceOffer?._id || bid?.spaceOffer || ""
      );

      if (!loadId) {
        return;
      }

      if (!grouped[loadId]) {
        grouped[loadId] = [];
      }

      grouped[loadId].push(bid);
    });

    Object.keys(grouped).forEach((loadId) => {
      grouped[loadId].sort((a, b) => {
        const priceA = Number(a.offeredPrice) || 0;
        const priceB = Number(b.offeredPrice) || 0;

        return priceA - priceB;
      });
    });

    return grouped;
  }, [bids]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setPageError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [loadsResponse, bidsResponse] =
        await Promise.all([
          axios.get(
            `${getApiBaseUrl()}/offers/space/my-offers`,
            {
              headers,
            }
          ),

          axios.get(
            `${getApiBaseUrl()}/offers/space/bid/my-received`,
            {
              headers,
            }
          ),
        ]);

      const receivedLoads = Array.isArray(
        loadsResponse?.data?.offers
      )
        ? loadsResponse.data.offers
        : [];

      const receivedBids = Array.isArray(
        bidsResponse?.data?.bids
      )
        ? bidsResponse.data.bids
        : [];

      setLoads(receivedLoads);
      setBids(receivedBids);

      if (
        !expandedLoadId &&
        receivedLoads.length > 0
      ) {
        setExpandedLoadId(
          String(receivedLoads[0]._id)
        );
      }
    } catch (error) {
      console.error(
        "Error cargando cargas y propuestas:",
        error
      );

      setPageError(
        error?.response?.data?.message ||
          "No se pudieron cargar tus cargas."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchData();
  }, []);

  const handleRespond = async (
    bid,
    action
  ) => {
    const bidId = bid?._id;

    if (!bidId) {
      setPageError(
        "No se encontró la propuesta seleccionada."
      );
      return;
    }

    if (action === "accepted") {
      const confirmed = window.confirm(
        `¿Confirmas que deseas aceptar la propuesta de ${getCaptainName(
          bid.driver
        )} por ${formatCOP(bid.offeredPrice)}?`
      );

      if (!confirmed) {
        return;
      }
    }

    if (action === "rejected") {
      const confirmed = window.confirm(
        "¿Confirmas que deseas rechazar esta propuesta?"
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setRespondingBidId(bidId);
      setPageError("");
      setPageSuccess("");

      await axios.post(
        `${getApiBaseUrl()}/offers/space/bid/respond`,
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

      setPageSuccess(
        action === "accepted"
          ? "Propuesta aceptada y transportador seleccionado."
          : "Propuesta rechazada correctamente."
      );

      await fetchData();
    } catch (error) {
      console.error(
        "Error respondiendo propuesta:",
        error
      );

      const apiErrors =
        error?.response?.data?.errors;

      if (
        Array.isArray(apiErrors) &&
        apiErrors.length > 0
      ) {
        setPageError(
          apiErrors[0]?.msg ||
            "No se pudo responder la propuesta."
        );
      } else {
        setPageError(
          error?.response?.data?.message ||
            "No se pudo responder la propuesta."
        );
      }
    } finally {
      setRespondingBidId("");
    }
  };

  const openCounterModal = (bid) => {
    setSelectedBid(bid);

    setCounterForm({
      counterPrice:
        bid?.counterPrice ||
        bid?.offeredPrice ||
        "",
      counterMessage:
        `Propongo realizar el servicio por ${formatCOP(
          bid?.offeredPrice || 0
        )}.`,
    });

    setPageError("");
    setPageSuccess("");
    setCounterModalOpen(true);
  };

  const closeCounterModal = () => {
    setCounterModalOpen(false);
    setSelectedBid(null);

    setCounterForm({
      counterPrice: "",
      counterMessage: "",
    });

    setPageError("");
  };

  const handleCounterChange = (event) => {
    const { name, value } = event.target;

    setCounterForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const submitCounter = async (event) => {
    event.preventDefault();

    const bidId = selectedBid?._id;
    const counterPrice = Number(
      counterForm.counterPrice
    );

    if (!bidId) {
      setPageError(
        "No se encontró la propuesta seleccionada."
      );
      return;
    }

    if (
      !Number.isFinite(counterPrice) ||
      counterPrice <= 0
    ) {
      setPageError(
        "La contraoferta debe ser mayor que cero."
      );
      return;
    }

    try {
      setRespondingBidId(bidId);
      setPageError("");
      setPageSuccess("");

      await axios.post(
        `${getApiBaseUrl()}/offers/space/bid/respond`,
        {
          bidId,
          action: "countered",
          counterPrice,
          counterMessage:
            counterForm.counterMessage.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setPageSuccess(
        "Contraoferta enviada correctamente."
      );

      closeCounterModal();
      await fetchData();
    } catch (error) {
      console.error(
        "Error enviando contraoferta:",
        error
      );

      const apiErrors =
        error?.response?.data?.errors;

      if (
        Array.isArray(apiErrors) &&
        apiErrors.length > 0
      ) {
        setPageError(
          apiErrors[0]?.msg ||
            "No se pudo enviar la contraoferta."
        );
      } else {
        setPageError(
          error?.response?.data?.message ||
            "No se pudo enviar la contraoferta."
        );
      }
    } finally {
      setRespondingBidId("");
    }
  };

  const renderBidCard = (bid) => {
    const driverName = getCaptainName(
      bid.driver
    );

    const vehicleType =
      VEHICLE_LABELS[
        bid.proposedVehicleType
      ] || "No especificado";

    const bodyType =
      BODY_LABELS[
        bid.proposedBodyType
      ] || "No especificada";

    const capacity =
      bid.proposedVehicleCapacity
        ? `${formatNumber(
            bid.proposedVehicleCapacity
          )} ${
            bid.proposedVehicleCapacityUnit ||
            ""
          }`
        : "No especificada";

    const isFinal =
      bid.status === "accepted" ||
      bid.status === "rejected" ||
      bid.status === "completed" ||
      bid.status === "cancelled";

    const isResponding =
      respondingBidId === bid._id;

    return (
      <div
        key={bid._id}
        className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <i className="ri-user-star-line text-2xl" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Propuesta de transporte
              </p>

              <h3 className="text-lg font-black text-gray-950 mt-1">
                {driverName}
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Enviada el {formatDate(bid.createdAt)}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${getBidStatusClasses(
              bid.status
            )}`}
          >
            {STATUS_LABELS[bid.status] ||
              bid.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-slate-950 text-white p-4">
            <p className="text-xs font-bold text-white/60">
              Precio propuesto
            </p>

            <p className="text-xl font-black mt-1">
              {formatCOP(bid.offeredPrice)}
            </p>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-bold text-blue-700">
              Vehículo
            </p>

            <p className="text-sm font-black text-blue-900 mt-1">
              {vehicleType}
            </p>
          </div>
        </div>

        {bid.status === "countered" &&
        Number(bid.counterPrice) > 0 ? (
          <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-black text-amber-700">
              Tu contraoferta
            </p>

            <p className="text-xl font-black text-amber-900 mt-1">
              {formatCOP(bid.counterPrice)}
            </p>

            {bid.counterMessage ? (
              <p className="text-sm text-amber-800 mt-2">
                {bid.counterMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 mt-3 space-y-2">
          <p className="text-sm text-gray-700">
            <span className="font-black">
              Carrocería:
            </span>{" "}
            {bodyType}
          </p>

          <p className="text-sm text-gray-700">
            <span className="font-black">
              Capacidad:
            </span>{" "}
            {capacity}
          </p>

          {bid.proposedVehicleBrand ? (
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Marca:
              </span>{" "}
              {bid.proposedVehicleBrand}
            </p>
          ) : null}

          {bid.proposedVehicleReference ? (
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Referencia:
              </span>{" "}
              {bid.proposedVehicleReference}
            </p>
          ) : null}

          {bid.proposedVehicleModel ? (
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Modelo:
              </span>{" "}
              {bid.proposedVehicleModel}
            </p>
          ) : null}

          {bid.proposedVehiclePlate ? (
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Placa:
              </span>{" "}
              {bid.proposedVehiclePlate}
            </p>
          ) : null}

          <p className="text-sm text-gray-700">
            <span className="font-black">
              Disponible para recoger:
            </span>{" "}
            {formatDate(
              bid.availablePickupTime
            )}
          </p>

          <p className="text-sm text-gray-700">
            <span className="font-black">
              Entrega estimada:
            </span>{" "}
            {formatDate(
              bid.estimatedDeliveryTime
            )}
          </p>

          {Number(
            bid.estimatedDurationHours
          ) > 0 ? (
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Duración estimada:
              </span>{" "}
              {bid.estimatedDurationHours} horas
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesTolls
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Peajes
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesFuel
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Combustible
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesLoading
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Cargue
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesUnloading
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Descargue
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesAssistant
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Ayudante
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <i
              className={`mr-1 ${
                bid.includesInsurance
                  ? "ri-checkbox-circle-line text-emerald-600"
                  : "ri-close-circle-line text-red-500"
              }`}
            />
            Seguro
          </div>
        </div>

        {bid.message ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-4 mt-3">
            <p className="text-xs font-black text-gray-500">
              Mensaje del transportador
            </p>

            <p className="text-sm text-gray-700 mt-1">
              {bid.message}
            </p>
          </div>
        ) : null}

        {!isFinal ? (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              type="button"
              onClick={() =>
                handleRespond(
                  bid,
                  "rejected"
                )
              }
              disabled={isResponding}
              className="rounded-2xl bg-red-50 border border-red-200 text-red-700 py-3 text-sm font-black disabled:opacity-50"
            >
              Rechazar
            </button>

            <button
              type="button"
              onClick={() =>
                openCounterModal(bid)
              }
              disabled={isResponding}
              className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 py-3 text-sm font-black disabled:opacity-50"
            >
              Contraoferta
            </button>

            <button
              type="button"
              onClick={() =>
                handleRespond(
                  bid,
                  "accepted"
                )
              }
              disabled={isResponding}
              className="rounded-2xl bg-emerald-600 text-white py-3 text-sm font-black shadow-lg disabled:opacity-50"
            >
              {isResponding
                ? "Procesando..."
                : "Aceptar"}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderLoadCard = (load) => {
    const loadId = String(load._id);

    const loadBids =
      bidsByLoad[loadId] || [];

    const isExpanded =
      expandedLoadId === loadId;

    const statusLabel =
      LOAD_STATUS_LABELS[load.status] ||
      load.status ||
      "Publicada";

    const vehicleLabel =
      load.requiredVehicleLabel ||
      VEHICLE_LABELS[
        load.requiredVehicleType
      ] ||
      load.suggestedVehicleLabel ||
      VEHICLE_LABELS[
        load.suggestedVehicleType
      ] ||
      "Por definir";

    return (
      <section
        key={load._id}
        className="overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="h-2 bg-gradient-to-r from-blue-700 via-cyan-500 to-sky-400" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                <i className="ri-truck-line text-2xl" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                  {load.publicationCode ||
                    "Carga publicada"}
                </p>

                <h2 className="text-lg font-black text-gray-950 mt-1">
                  {load.title ||
                    load.cargoType ||
                    "Carga disponible"}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {load.origin} →{" "}
                  {load.destination}
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 text-[11px] font-black">
              {statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl bg-slate-950 text-white p-4">
              <p className="text-xs font-bold text-white/60">
                Peso
              </p>

              <p className="text-lg font-black mt-1">
                {load.weightLabel ||
                  `${formatNumber(
                    load.weight
                  )} ${
                    load.weightUnit ||
                    "kg"
                  }`}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-xs font-bold text-emerald-700">
                Propuestas
              </p>

              <p className="text-2xl font-black text-emerald-800 mt-1">
                {loadBids.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 mt-3 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">
                Tipo de carga:
              </span>{" "}
              {load.cargoType ||
                "Carga general"}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Vehículo recomendado:
              </span>{" "}
              {vehicleLabel}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Capacidad recomendada:
              </span>{" "}
              {formatNumber(
                load.recommendedMinCapacityKg
              )}{" "}
              kg
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Recogida:
              </span>{" "}
              {formatDate(load.pickupTime)}
            </p>

            {load.deliveryDeadline ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Entrega límite:
                </span>{" "}
                {formatDate(
                  load.deliveryDeadline
                )}
              </p>
            ) : null}

            <p className="text-sm text-gray-700">
              <span className="font-black">
                Precio publicado:
              </span>{" "}
              {Number(
                load.suggestedPrice
              ) > 0
                ? formatCOP(
                    load.suggestedPrice
                  )
                : "Recibir propuestas"}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setExpandedLoadId(
                isExpanded ? "" : loadId
              )
            }
            className="w-full mt-4 rounded-2xl bg-blue-600 text-white py-3 font-black shadow-lg shadow-blue-600/20"
          >
            {isExpanded
              ? "Ocultar propuestas"
              : `Ver propuestas (${loadBids.length})`}
          </button>

          {isExpanded ? (
            <div className="mt-4 border-t border-gray-200 pt-4">
              {loadBids.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <i className="ri-time-line text-2xl" />
                  </div>

                  <p className="font-black text-gray-900 mt-3">
                    Aún no hay propuestas
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    Los transportadores podrán
                    verla y enviar sus precios.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {loadBids.map(renderBidCard)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/available-offers"
              className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div>
              <h1 className="text-lg font-black text-gray-950">
                Mis cargas
              </h1>

              <p className="text-xs text-gray-600">
                Compara y selecciona transportadores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/create-load-offer")
            }
            className="rounded-2xl bg-blue-600 text-white px-3 h-10 text-sm font-bold shadow-lg"
          >
            Publicar
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <section className="rounded-[28px] bg-gradient-to-r from-blue-700 via-cyan-600 to-sky-500 p-5 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-wider text-white/70">
            Marketplace logístico
          </p>

          <h2 className="text-2xl font-black mt-1">
            Elige la mejor propuesta
          </h2>

          <p className="text-sm text-white/85 mt-2">
            Compara precio, vehículo, capacidad,
            fechas y servicios incluidos antes de
            seleccionar un transportador.
          </p>

          <button
            type="button"
            onClick={fetchData}
            className="mt-4 rounded-2xl bg-white text-blue-700 px-4 py-3 font-black"
          >
            <i className="ri-refresh-line mr-1" />
            Actualizar propuestas
          </button>
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
            Cargando tus cargas y propuestas...
          </div>
        ) : loads.length === 0 ? (
          <div className="rounded-[28px] bg-white border border-gray-200 p-7 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <i className="ri-truck-line text-3xl" />
            </div>

            <h3 className="font-black text-gray-900 mt-3">
              Aún no has publicado cargas
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Publica una carga para comenzar a
              recibir propuestas.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate("/create-load-offer")
              }
              className="mt-4 rounded-2xl bg-blue-600 text-white px-5 py-3 font-black shadow-lg"
            >
              Publicar mi primera carga
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {loads.map(renderLoadCard)}
          </div>
        )}
      </main>

      {counterModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/55 flex items-end">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-[30px] bg-white p-4 shadow-2xl">
            <div className="w-16 h-1.5 rounded-full bg-gray-300 mx-auto mb-4" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                  Negociación
                </p>

                <h2 className="text-xl font-black text-gray-950 mt-1">
                  Enviar contraoferta
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  Propuesta de{" "}
                  {getCaptainName(
                    selectedBid?.driver
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCounterModal}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 mt-4">
              <p className="text-sm text-gray-700">
                <span className="font-black">
                  Precio del conductor:
                </span>{" "}
                {formatCOP(
                  selectedBid?.offeredPrice
                )}
              </p>
            </div>

            <form
              onSubmit={submitCounter}
              className="space-y-4 mt-4"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nuevo precio propuesto
                </label>

                <input
                  type="number"
                  name="counterPrice"
                  value={
                    counterForm.counterPrice
                  }
                  onChange={handleCounterChange}
                  min="1"
                  placeholder="Ej: 850000"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Mensaje
                </label>

                <textarea
                  name="counterMessage"
                  value={
                    counterForm.counterMessage
                  }
                  onChange={handleCounterChange}
                  rows={4}
                  maxLength={1500}
                  placeholder="Explica tu contraoferta..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
                />
              </div>

              {pageError ? (
                <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm font-bold">
                  {pageError}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeCounterModal}
                  className="rounded-2xl bg-gray-100 border border-gray-200 text-gray-800 py-3 font-black"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    respondingBidId ===
                    selectedBid?._id
                  }
                  className="rounded-2xl bg-amber-500 text-white py-3 font-black disabled:opacity-60"
                >
                  {respondingBidId ===
                  selectedBid?._id
                    ? "Enviando..."
                    : "Enviar contraoferta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MyLoadOffers;