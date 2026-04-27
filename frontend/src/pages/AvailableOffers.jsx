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

const humanizeUnit = (unit) => UNIT_LABELS[unit] || unit || "";

const humanizePriceType = (priceType) => {
  return PRICE_TYPE_LABELS[priceType] || "precio";
};

const getTheme = (listingType) => {
  if (listingType === "goods") {
    return {
      label: "Mercancía",
      icon: "ri-shopping-basket-2-line",
      gradient: "from-orange-500 via-amber-500 to-yellow-400",
      softBg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-700",
      button: "bg-orange-600",
      buttonShadow: "shadow-orange-600/20",
      lightButton: "bg-orange-100 text-orange-700 border-orange-200",
    };
  }

  if (listingType === "space") {
    return {
      label: "Espacio",
      icon: "ri-inbox-archive-line",
      gradient: "from-blue-600 via-cyan-500 to-sky-400",
      softBg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      button: "bg-blue-600",
      buttonShadow: "shadow-blue-600/20",
      lightButton: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  return {
    label: "Cupos",
    icon: "ri-user-3-line",
    gradient: "from-emerald-600 via-teal-500 to-green-400",
    softBg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    button: "bg-emerald-600",
    buttonShadow: "shadow-emerald-600/20",
    lightButton: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
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

  const counts = useMemo(
    () => ({
      goods: goodsOffers.length,
      space: spaceOffers.length,
      seat: seatOffers.length,
    }),
    [goodsOffers, spaceOffers, seatOffers]
  );

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

        if (prev.listingType === "goods") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )} de ${selectedOffer?.productName || "esta mercancía"}.`;
        } else if (prev.listingType === "space") {
          next.message = `Te envío una oferta por ${quantity} ${humanizeUnit(
            unit
          )} del espacio disponible.`;
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

  const renderOfferCard = (offer, listingType) => {
    const theme = getTheme(listingType);
    const available = getAvailableInfo(offer, listingType);
    const priceLabel = buildPriceLabel(offer, listingType);

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
        className="relative overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div className={`h-2 bg-gradient-to-r ${theme.gradient}`} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl ${theme.softBg} ${theme.text} border ${theme.border} flex items-center justify-center shadow-sm`}
              >
                <i className={`${theme.icon} text-2xl`} />
              </div>

              <div>
                <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>
                  {theme.label} disponible
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {getOfferTitle(offer, listingType)}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {offer.origin} → {offer.destination}
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-full border ${theme.lightButton}`}
            >
              Activa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">
                Disponible real
              </p>
              <p className="text-lg font-black mt-1">{available.label}</p>
            </div>

            <div className={`${theme.softBg} border ${theme.border} rounded-2xl px-4 py-3`}>
              <p className={`text-xs font-bold ${theme.text}`}>
                Precio publicado
              </p>
              <p className={`text-lg font-black mt-1 ${theme.text}`}>
                {priceLabel}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            {listingType === "space" ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">Carga permitida:</span>{" "}
                {offer.cargoType || "Carga general"}
              </p>
            ) : null}

            <p className="text-sm text-gray-700">
              <span className="font-black">Transportador:</span>{" "}
              {getDriverName(offer.driver)}
            </p>

            <p className="text-sm text-gray-700">
              <span className="font-black">Negociable:</span>{" "}
              {offer.isNegotiable ? "Sí, recibe ofertas" : "No negociable"}
            </p>

            {Array.isArray(offer.stops) && offer.stops.length > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">Paradas:</span>{" "}
                {offer.stops.join(", ")}
              </p>
            ) : null}

            {offer.description ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">
                  Descripción
                </p>
                <p className="text-sm text-gray-700">{offer.description}</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => openBidModal(offer, listingType, primaryMode)}
              className={`rounded-2xl ${theme.button} text-white py-3 font-black shadow-lg ${theme.buttonShadow}`}
            >
              {primaryText}
            </button>

            <button
              type="button"
              onClick={() => openBidModal(offer, listingType, "offer")}
              className={`rounded-2xl py-3 font-black border ${theme.lightButton}`}
            >
              Enviar oferta
            </button>
          </div>
        </div>
      </div>
    );
  };

  const selectedAvailable = getAvailableInfo(selectedOffer, bidForm.listingType);
  const selectedPriceLabel = buildPriceLabel(selectedOffer, bidForm.listingType);
  const selectedTheme = getTheme(bidForm.listingType || activeTab);

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
                Ofertas disponibles
              </h1>
              <p className="text-xs text-gray-600">
                Mercancía, espacio y cupos disponibles en ruta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/my-sent-bids")}
              className="px-3 h-10 rounded-2xl bg-black text-white text-sm font-bold shadow-lg"
            >
              Mis ofertas
            </button>

            <button
              type="button"
              onClick={fetchOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const theme = getTheme(tab.key);

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-3 py-3 text-sm font-black border transition ${
                  isActive
                    ? `text-white border-transparent bg-gradient-to-r ${theme.gradient} shadow-lg`
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <i className={`${tab.icon} text-lg`}></i>
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {counts[tab.key] || 0}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-5 text-sm text-gray-600 shadow-sm">
            Cargando ofertas...
          </div>
        ) : error && !bidModalOpen ? (
          <div className="bg-red-50 rounded-[24px] border border-red-200 p-5 text-sm text-red-700 font-semibold">
            {error}
          </div>
        ) : currentList.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-200 p-6 text-sm text-gray-600 text-center shadow-sm">
            No hay publicaciones disponibles en esta categoría por ahora.
          </div>
        ) : (
          <div className="space-y-5">
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
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-[30px] p-4 shadow-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-center pb-2">
              <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className={`h-2 rounded-full bg-gradient-to-r ${selectedTheme.gradient} mb-4`} />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-black uppercase tracking-wide ${selectedTheme.text}`}>
                  Nueva solicitud
                </p>

                <h2 className="text-xl font-black text-gray-950">
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

            <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
              <p>
                <span className="font-black">Publicación:</span>{" "}
                {getOfferTitle(selectedOffer, bidForm.listingType)}
              </p>

              <p>
                <span className="font-black">Precio publicado:</span>{" "}
                {selectedPriceLabel}
              </p>

              <p>
                <span className="font-black">Disponible real:</span>{" "}
                {selectedAvailable.quantity} {humanizeUnit(selectedAvailable.unit)}
              </p>

              <p>
                <span className="font-black">Transportador:</span>{" "}
                {getDriverName(selectedOffer?.driver)}
              </p>

              <div className="rounded-2xl bg-yellow-50 text-yellow-800 px-4 py-3 text-xs leading-relaxed border border-yellow-200">
                Para evitar confusiones, la cantidad que escribas debe estar en{" "}
                <strong>{humanizeUnit(selectedAvailable.unit)}</strong>. No
                puedes pedir más de lo disponible.
              </div>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">
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
                  <label className="text-sm font-bold text-gray-700 block mb-1">
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
                    Unidad fija
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
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
                  Valor total por {bidForm.requestedQuantity || 0}{" "}
                  {humanizeUnit(bidForm.requestedUnit)}.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 text-sm shadow-lg">
                <p className="font-black">Resumen de tu oferta</p>
                <p className="text-white/80 mt-1">
                  Solicitas {bidForm.requestedQuantity || 0}{" "}
                  {humanizeUnit(bidForm.requestedUnit)} por{" "}
                  {formatCOP(bidForm.offeredPrice)}.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
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
                <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold border border-red-200">
                  {error}
                </div>
              ) : null}

              {bidSuccess ? (
                <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-semibold border border-emerald-200">
                  {bidSuccess}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeBidModal}
                  className="rounded-2xl bg-gray-100 text-gray-800 py-3 font-black border border-gray-200"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submittingBid}
                  className={`rounded-2xl ${selectedTheme.button} text-white py-3 font-black disabled:opacity-60 shadow-lg ${selectedTheme.buttonShadow}`}
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