import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const TABS = [
  { key: "goods", label: "Mercancía", icon: "ri-shopping-basket-2-line" },
  { key: "space", label: "Espacio", icon: "ri-inbox-archive-line" },
  { key: "seat", label: "Cupos", icon: "ri-user-3-line" },
];

const PRICE_TYPE_LABELS = {
  por_kg: "por kg",
  por_gramo: "por gramo",
  por_libra: "por libra",
  por_bulto: "por bulto",
  por_paca: "por paca",
  por_caja: "por caja",
  por_canastilla: "por canastilla",
  por_tonelada: "por tonelada",
  por_unidad: "por unidad",
  por_m3: "por m³",
  precio_total: "precio total",
};

const UNIT_LABELS = {
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

const formatCOP = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const humanizeUnit = (unit) => {
  return UNIT_LABELS[unit] || unit || "";
};

const humanizePriceType = (priceType) => {
  return PRICE_TYPE_LABELS[priceType] || "precio";
};

const buildPriceLabel = (offer, listingType) => {
  if (!offer) return formatCOP(0);

  if (offer.priceLabel) return offer.priceLabel;

  if (listingType === "seat") {
    return `${formatCOP(offer.suggestedPrice)} por ${humanizeUnit(
      offer.seatUnit || "cupo"
    )}`;
  }

  return `${formatCOP(offer.suggestedPrice)} ${humanizePriceType(
    offer.priceType
  )}`;
};

const getAvailableInfo = (offer, listingType) => {
  if (!offer) {
    return {
      quantity: 0,
      unit: "",
      label: "Sin disponibilidad",
    };
  }

  if (listingType === "goods") {
    return {
      quantity: Number(offer.quantityAvailable) || 0,
      unit: offer.quantityUnit || "",
      label:
        offer.availableLabel ||
        `${offer.quantityAvailable || 0} ${humanizeUnit(
          offer.quantityUnit
        )} disponibles`,
    };
  }

  if (listingType === "space") {
    return {
      quantity: Number(offer.capacityAvailable) || 0,
      unit: offer.capacityUnit || "",
      label:
        offer.availableLabel ||
        `${offer.capacityAvailable || 0} ${humanizeUnit(
          offer.capacityUnit
        )} disponibles`,
    };
  }

  return {
    quantity: Number(offer.seatsAvailable) || 0,
    unit: offer.seatUnit || "cupos",
    label:
      offer.availableLabel ||
      `${offer.seatsAvailable || 0} ${humanizeUnit(
        offer.seatUnit || "cupos"
      )} disponibles`,
  };
};

const getDriverName = (driver) => {
  if (!driver) return "Transportador";

  const first = driver?.fullname?.firstname || "";
  const last = driver?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();

  return full || "Transportador";
};

const getOfferTitle = (offer, listingType) => {
  if (listingType === "goods") {
    return offer?.productName || "Mercancía disponible";
  }

  if (listingType === "space") {
    const available = getAvailableInfo(offer, "space");
    return `${available.quantity} ${humanizeUnit(available.unit)} disponibles`;
  }

  const available = getAvailableInfo(offer, "seat");
  return `${available.quantity} ${humanizeUnit(available.unit)} disponibles`;
};

const getListingTypeName = (listingType) => {
  if (listingType === "goods") return "mercancía";
  if (listingType === "space") return "espacio";
  return "cupos";
};

const AvailableOffers = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("goods");
  const [loading, setLoading] = useState(false);
  const [goodsOffers, setGoodsOffers] = useState([]);
  const [spaceOffers, setSpaceOffers] = useState([]);
  const [seatOffers, setSeatOffers] = useState([]);
  const [error, setError] = useState("");

  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidSuccess, setBidSuccess] = useState("");

  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedMode, setSelectedMode] = useState("offer");

  const [bidForm, setBidForm] = useState({
    listingType: "",
    listingId: "",
    requestedQuantity: "",
    requestedUnit: "",
    offeredPrice: "",
    message: "",
  });

  const token = localStorage.getItem("token");

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {};

      const [goodsRes, spaceRes, seatRes] = await Promise.all([
        axios.get(`${getApiBaseUrl()}/offers/goods/list`, { headers }),
        axios.get(`${getApiBaseUrl()}/offers/space/list`, { headers }),
        axios.get(`${getApiBaseUrl()}/offers/seat/list`, { headers }),
      ]);

      setGoodsOffers(
        Array.isArray(goodsRes?.data?.offers) ? goodsRes.data.offers : []
      );
      setSpaceOffers(
        Array.isArray(spaceRes?.data?.offers) ? spaceRes.data.offers : []
      );
      setSeatOffers(
        Array.isArray(seatRes?.data?.offers) ? seatRes.data.offers : []
      );
    } catch (err) {
      console.error("Error cargando ofertas disponibles:", err);
      setError(
        err?.response?.data?.message ||
          "No se pudieron cargar las ofertas disponibles."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const currentList = useMemo(() => {
    if (activeTab === "goods") return goodsOffers;
    if (activeTab === "space") return spaceOffers;
    return seatOffers;
  }, [activeTab, goodsOffers, spaceOffers, seatOffers]);

  const closeBidModal = () => {
    setBidModalOpen(false);
    setSelectedOffer(null);
    setSelectedMode("offer");
    setBidForm({
      listingType: "",
      listingId: "",
      requestedQuantity: "",
      requestedUnit: "",
      offeredPrice: "",
      message: "",
    });
    setBidSuccess("");
    setError("");
  };

  const openBidModal = (offer, listingType, mode) => {
    const available = getAvailableInfo(offer, listingType);

    let requestedQuantity = 1;
    let offeredPrice = offer?.suggestedPrice || 0;
    let defaultMessage = "";

    if (available.quantity > 0 && available.quantity < 1) {
      requestedQuantity = available.quantity;
    }

    if (listingType === "goods") {
      defaultMessage =
        mode === "buy"
          ? `Quiero comprar ${requestedQuantity} ${humanizeUnit(
              available.unit
            )} de ${offer?.productName || "esta mercancía"}.`
          : `Te envío una oferta por ${requestedQuantity} ${humanizeUnit(
              available.unit
            )} de ${offer?.productName || "esta mercancía"}.`;
    }

    if (listingType === "space") {
      defaultMessage =
        mode === "request"
          ? `Necesito espacio para enviar ${requestedQuantity} ${humanizeUnit(
              available.unit
            )}.`
          : `Te envío una oferta por ${requestedQuantity} ${humanizeUnit(
              available.unit
            )} del espacio disponible.`;
    }

    if (listingType === "seat") {
      defaultMessage =
        mode === "reserve"
          ? `Quiero reservar ${requestedQuantity} ${humanizeUnit(
              available.unit
            )}.`
          : `Te envío una oferta por ${requestedQuantity} ${humanizeUnit(
              available.unit
            )}.`;
    }

    setSelectedOffer(offer);
    setSelectedMode(mode);
    setBidForm({
      listingType,
      listingId: offer?._id || "",
      requestedQuantity,
      requestedUnit: available.unit,
      offeredPrice,
      message: defaultMessage,
    });
    setBidSuccess("");
    setError("");
    setBidModalOpen(true);
  };

  const handleBidFormChange = (e) => {
    const { name, value } = e.target;

    setBidForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "requestedQuantity" && selectedOffer) {
        const quantity = Number(value) || 0;
        const unit = prev.requestedUnit || "";
        const typeName = getListingTypeName(prev.listingType);

        if (prev.listingType === "goods") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )} de ${selectedOffer?.productName || "esta mercancía"}.`;
        } else if (prev.listingType === "space") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )} de ${typeName} disponible.`;
        } else if (prev.listingType === "seat") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )}.`;
        }
      }

      return next;
    });
  };

  const getModalTitle = () => {
    if (selectedMode === "buy") return "Comprar mercancía";
    if (selectedMode === "request") return "Solicitar espacio";
    if (selectedMode === "reserve") return "Reservar cupo";
    return "Enviar oferta";
  };

  const validateBidBeforeSubmit = () => {
    const requestedQuantity = Number(bidForm.requestedQuantity);
    const offeredPrice = Number(bidForm.offeredPrice);
    const available = getAvailableInfo(selectedOffer, bidForm.listingType);

    if (!token) {
      return "Debes iniciar sesión para enviar una oferta.";
    }

    if (!bidForm.listingType || !bidForm.listingId) {
      return "No se encontró la publicación seleccionada.";
    }

    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      return "La cantidad solicitada debe ser mayor que 0.";
    }

    if (!bidForm.requestedUnit) {
      return "La unidad de la oferta no es válida.";
    }

    if (bidForm.requestedUnit !== available.unit) {
      return `La unidad debe ser ${humanizeUnit(
        available.unit
      )}, igual a la publicación.`;
    }

    if (requestedQuantity > available.quantity) {
      return `No puedes ofertar más de lo disponible. Disponible: ${
        available.quantity
      } ${humanizeUnit(available.unit)}.`;
    }

    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      return "Debes ingresar un valor de oferta mayor que 0.";
    }

    return "";
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    setError("");
    setBidSuccess("");

    const validationMessage = validateBidBeforeSubmit();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const requestedQuantity = Number(bidForm.requestedQuantity);
    const offeredPrice = Number(bidForm.offeredPrice);

    try {
      setSubmittingBid(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/bid/create`,
        {
          listingType: bidForm.listingType,
          listingId: bidForm.listingId,
          requestedQuantity,
          requestedUnit: bidForm.requestedUnit,
          offeredPrice,
          message: bidForm.message?.trim() || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setBidSuccess("Solicitud enviada correctamente al transportador.");
      await fetchOffers();

      setTimeout(() => {
        closeBidModal();
      }, 900);
    } catch (err) {
      console.error("Error enviando oferta:", err);
      const apiErrors = err?.response?.data?.errors;
      const apiMessage = err?.response?.data?.message;

      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        setError(apiErrors[0]?.msg || "No se pudo enviar la oferta.");
      } else {
        setError(apiMessage || "No se pudo enviar la oferta.");
      }
    } finally {
      setSubmittingBid(false);
    }
  };

  const renderInfoCard = (offer, listingType) => {
    const available = getAvailableInfo(offer, listingType);
    const priceLabel = buildPriceLabel(offer, listingType);

    return (
      <div className="mt-4 rounded-2xl bg-gray-50 p-4 space-y-2 text-sm text-gray-700">
        <p>
          <span className="font-semibold">Disponible:</span> {available.label}
        </p>

        <p>
          <span className="font-semibold">Precio publicado:</span> {priceLabel}
        </p>

        {listingType === "goods" ? (
          <p className="text-xs text-orange-700 bg-orange-50 rounded-xl px-3 py-2">
            Ejemplo: si dice {formatCOP(offer.suggestedPrice)}{" "}
            {humanizePriceType(offer.priceType)}, ese valor corresponde a cada{" "}
            {humanizeUnit(offer.quantityUnit)}.
          </p>
        ) : null}

        {listingType === "space" ? (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-xl px-3 py-2">
            Ejemplo: si dice {formatCOP(offer.suggestedPrice)}{" "}
            {humanizePriceType(offer.priceType)}, ese valor corresponde a cada{" "}
            {humanizeUnit(offer.capacityUnit)} o al total según la publicación.
          </p>
        ) : null}

        {listingType === "seat" ? (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
            El valor publicado corresponde a cada {humanizeUnit(offer.seatUnit)}.
          </p>
        ) : null}

        {listingType === "space" ? (
          <p>
            <span className="font-semibold">Carga permitida:</span>{" "}
            {offer.cargoType || "Carga general"}
          </p>
        ) : null}

        <p>
          <span className="font-semibold">Transportador:</span>{" "}
          {getDriverName(offer.driver)}
        </p>

        <p>
          <span className="font-semibold">Negociable:</span>{" "}
          {offer.isNegotiable ? "Sí" : "No"}
        </p>

        {Array.isArray(offer.stops) && offer.stops.length > 0 ? (
          <p>
            <span className="font-semibold">Paradas:</span>{" "}
            {offer.stops.join(", ")}
          </p>
        ) : null}

        {offer.description ? (
          <p>
            <span className="font-semibold">Descripción:</span>{" "}
            {offer.description}
          </p>
        ) : null}
      </div>
    );
  };

  const renderOfferCard = (offer, listingType) => {
    const color =
      listingType === "goods"
        ? {
            text: "text-orange-700",
            bg: "bg-orange-100",
            light: "bg-orange-100 text-orange-700",
            label: "Mercancía",
          }
        : listingType === "space"
        ? {
            text: "text-blue-700",
            bg: "bg-blue-100",
            light: "bg-blue-100 text-blue-700",
            label: "Espacio",
          }
        : {
            text: "text-emerald-700",
            bg: "bg-emerald-100",
            light: "bg-emerald-100 text-emerald-700",
            label: "Cupos",
          };

    const primaryText =
      listingType === "goods"
        ? "Comprar"
        : listingType === "space"
        ? "Solicitar espacio"
        : "Reservar cupo";

    const primaryMode =
      listingType === "goods"
        ? "buy"
        : listingType === "space"
        ? "request"
        : "reserve";

    return (
      <div
        key={offer._id}
        className="bg-white rounded-[24px] border border-gray-200 p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-xs font-semibold ${color.text} uppercase tracking-wide`}
            >
              {color.label}
            </p>

            <h3 className="text-lg font-bold text-gray-900 mt-1">
              {getOfferTitle(offer, listingType)}
            </h3>

            <p className="text-sm text-gray-600 mt-1">
              {offer.origin} → {offer.destination}
            </p>
          </div>

          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${color.bg} ${color.text}`}
          >
            {offer.status || "active"}
          </span>
        </div>

        {renderInfoCard(offer, listingType)}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => openBidModal(offer, listingType, primaryMode)}
            className="rounded-2xl bg-black text-white py-3 font-semibold"
          >
            {primaryText}
          </button>

          <button
            type="button"
            onClick={() => openBidModal(offer, listingType, "offer")}
            className={`rounded-2xl py-3 font-semibold ${color.light}`}
          >
            Enviar oferta
          </button>
        </div>
      </div>
    );
  };

  const selectedAvailable = getAvailableInfo(
    selectedOffer,
    bidForm.listingType
  );

  const selectedPriceLabel = buildPriceLabel(
    selectedOffer,
    bidForm.listingType
  );

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
              Ofertas disponibles
            </h1>
            <p className="text-xs text-gray-600">
              Aprovecha mercancía, espacio o cupos en ruta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/my-sent-bids")}
            className="px-3 h-10 rounded-2xl bg-black text-white text-sm font-semibold"
          >
            Mis ofertas
          </button>

          <button
            type="button"
            onClick={fetchOffers}
            className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
          >
            <i className="ri-refresh-line text-lg"></i>
          </button>
        </div>
      </div>

      <div className="sticky top-[73px] z-30 bg-gray-100 px-4 pt-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold border ${
                  isActive
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <i className={`${tab.icon} text-lg`}></i>
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 pt-2">
        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600">
            Cargando ofertas...
          </div>
        ) : error && !bidModalOpen ? (
          <div className="bg-white rounded-[24px] border border-red-200 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center">
            No hay publicaciones disponibles en esta categoría por ahora.
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "goods" &&
              goodsOffers.map((offer) => renderOfferCard(offer, "goods"))}

            {activeTab === "space" &&
              spaceOffers.map((offer) => renderOfferCard(offer, "space"))}

            {activeTab === "seat" &&
              seatOffers.map((offer) => renderOfferCard(offer, "seat"))}
          </div>
        )}
      </div>

      {bidModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[28px] p-4 shadow-2xl max-h-[88vh] overflow-auto">
            <div className="flex justify-center pb-2">
              <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="flex items-start justify-between gap-3 mt-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {getModalTitle()}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedOffer?.origin || "Origen"} →{" "}
                  {selectedOffer?.destination || "Destino"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeBidModal}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
              <p>
                <span className="font-semibold">Publicación:</span>{" "}
                {getOfferTitle(selectedOffer, bidForm.listingType)}
              </p>

              <p>
                <span className="font-semibold">Precio publicado:</span>{" "}
                {selectedPriceLabel}
              </p>

              <p>
                <span className="font-semibold">Disponible real:</span>{" "}
                {selectedAvailable.quantity} {humanizeUnit(selectedAvailable.unit)}
              </p>

              <p>
                <span className="font-semibold">Transportador:</span>{" "}
                {getDriverName(selectedOffer?.driver)}
              </p>

              <div className="rounded-2xl bg-yellow-50 text-yellow-800 px-4 py-3 text-xs leading-relaxed">
                Para evitar confusiones, la cantidad que escribas debe estar en{" "}
                <strong>{humanizeUnit(selectedAvailable.unit)}</strong>. No puedes
                pedir más de lo disponible.
              </div>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Cantidad que solicitas
                  </label>
                  <input
                    type="number"
                    name="requestedQuantity"
                    value={bidForm.requestedQuantity}
                    onChange={handleBidFormChange}
                    min="1"
                    max={selectedAvailable.quantity || undefined}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo: {selectedAvailable.quantity}{" "}
                    {humanizeUnit(selectedAvailable.unit)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    name="requestedUnit"
                    value={humanizeUnit(bidForm.requestedUnit)}
                    readOnly
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-gray-100 text-gray-700"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unidad fija de la publicación
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Valor total que ofreces
                </label>
                <input
                  type="number"
                  name="offeredPrice"
                  value={bidForm.offeredPrice}
                  onChange={handleBidFormChange}
                  min="1"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este es el valor total de tu propuesta por{" "}
                  {bidForm.requestedQuantity || 0}{" "}
                  {humanizeUnit(bidForm.requestedUnit)}.
                </p>
              </div>

              <div className="rounded-2xl bg-black text-white px-4 py-3 text-sm">
                <p className="font-semibold">Resumen de tu oferta</p>
                <p className="text-white/80 mt-1">
                  Solicitas {bidForm.requestedQuantity || 0}{" "}
                  {humanizeUnit(bidForm.requestedUnit)} por{" "}
                  {formatCOP(bidForm.offeredPrice)}.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Mensaje
                </label>
                <textarea
                  name="message"
                  value={bidForm.message}
                  onChange={handleBidFormChange}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
                  placeholder="Escribe los detalles de tu solicitud..."
                />
              </div>

              {error ? (
                <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}

              {bidSuccess ? (
                <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
                  {bidSuccess}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeBidModal}
                  className="rounded-2xl bg-gray-100 text-gray-800 py-3 font-semibold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submittingBid}
                  className="rounded-2xl bg-black text-white py-3 font-semibold disabled:opacity-60"
                >
                  {submittingBid ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AvailableOffers;