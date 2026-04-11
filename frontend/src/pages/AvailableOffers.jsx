import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const TABS = [
  { key: "goods", label: "Mercancía", icon: "ri-shopping-basket-2-line" },
  { key: "space", label: "Espacio", icon: "ri-inbox-archive-line" },
  { key: "seat", label: "Cupos", icon: "ri-user-3-line" },
];

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
    espacio_parcial: "espacio parcial",
    vehiculo_completo: "vehículo completo",
    m3: "m³",
  };
  return map[unit] || unit || "";
};

const getDriverName = (driver) => {
  if (!driver) return "Transportador";
  const first = driver?.fullname?.firstname || "";
  const last = driver?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();
  return full || "Transportador";
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

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [goodsRes, spaceRes, seatRes] = await Promise.all([
        axios.get(`${getApiBaseUrl()}/offers/goods/list`, { headers }),
        axios.get(`${getApiBaseUrl()}/offers/space/list`, { headers }),
        axios.get(`${getApiBaseUrl()}/offers/seat/list`, { headers }),
      ]);

      setGoodsOffers(Array.isArray(goodsRes?.data?.offers) ? goodsRes.data.offers : []);
      setSpaceOffers(Array.isArray(spaceRes?.data?.offers) ? spaceRes.data.offers : []);
      setSeatOffers(Array.isArray(seatRes?.data?.offers) ? seatRes.data.offers : []);
    } catch (err) {
      console.error("Error cargando ofertas disponibles:", err);
      setError(
        err?.response?.data?.message || "No se pudieron cargar las ofertas disponibles."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchOffers();
  }, [token]);

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
    let requestedUnit = "";
    let requestedQuantity = 1;
    let offeredPrice = offer?.suggestedPrice || 0;
    let defaultMessage = "";

    if (listingType === "goods") {
      requestedUnit = offer?.quantityUnit || "kg";
      requestedQuantity = 1;
      defaultMessage =
        mode === "buy"
          ? `Quiero comprar ${requestedQuantity} ${requestedUnit} de ${offer?.productName || "esta mercancía"}.`
          : `Te envío una oferta por ${offer?.productName || "esta mercancía"}.`;
    }

    if (listingType === "space") {
      requestedUnit = offer?.capacityUnit || "kg";
      requestedQuantity = 1;
      defaultMessage =
        mode === "request"
          ? `Necesito espacio para enviar ${requestedQuantity} ${requestedUnit}.`
          : `Te envío una oferta por el espacio disponible.`;
    }

    if (listingType === "seat") {
      requestedUnit = offer?.seatUnit || "cupos";
      requestedQuantity = 1;
      defaultMessage =
        mode === "reserve"
          ? `Quiero reservar ${requestedQuantity} ${requestedUnit}.`
          : `Te envío una oferta por los cupos disponibles.`;
    }

    setSelectedOffer(offer);
    setSelectedMode(mode);
    setBidForm({
      listingType,
      listingId: offer?._id || "",
      requestedQuantity,
      requestedUnit,
      offeredPrice,
      message: defaultMessage,
    });
    setBidSuccess("");
    setError("");
    setBidModalOpen(true);
  };

  const handleBidFormChange = (e) => {
    const { name, value } = e.target;
    setBidForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getModalTitle = () => {
    if (selectedMode === "buy") return "Comprar mercancía";
    if (selectedMode === "request") return "Solicitar espacio";
    if (selectedMode === "reserve") return "Reservar cupo";
    return "Enviar oferta";
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    setError("");
    setBidSuccess("");

    const requestedQuantity = Number(bidForm.requestedQuantity);
    const offeredPrice = Number(bidForm.offeredPrice);

    if (!bidForm.listingType || !bidForm.listingId) {
      setError("No se encontró la publicación seleccionada.");
      return;
    }

    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setError("La cantidad solicitada debe ser mayor que 0.");
      return;
    }

    if (!bidForm.requestedUnit) {
      setError("Debes seleccionar una unidad válida.");
      return;
    }

    if (!Number.isFinite(offeredPrice) || offeredPrice < 0) {
      setError("Debes ingresar un valor de oferta válido.");
      return;
    }

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
              goodsOffers.map((offer) => (
                <div
                  key={offer._id}
                  className="bg-white rounded-[24px] border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                        Mercancía
                      </p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">
                        {offer.productName}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {offer.origin} → {offer.destination}
                      </p>
                    </div>

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                      {offer.status || "active"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Disponible:</span>{" "}
                      {offer.quantityAvailable} {offer.quantityUnit}
                    </p>
                    <p>
                      <span className="font-semibold">Precio:</span>{" "}
                      {formatCOP(offer.suggestedPrice)}
                    </p>
                    <p>
                      <span className="font-semibold">Transportador:</span>{" "}
                      {getDriverName(offer.driver)}
                    </p>
                    <p>
                      <span className="font-semibold">Negociable:</span>{" "}
                      {offer.isNegotiable ? "Sí" : "No"}
                    </p>
                    {offer.description ? (
                      <p>
                        <span className="font-semibold">Descripción:</span>{" "}
                        {offer.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "goods", "buy")}
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Comprar
                    </button>
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "goods", "offer")}
                      className="rounded-2xl bg-orange-100 text-orange-700 py-3 font-semibold"
                    >
                      Enviar oferta
                    </button>
                  </div>
                </div>
              ))}

            {activeTab === "space" &&
              spaceOffers.map((offer) => (
                <div
                  key={offer._id}
                  className="bg-white rounded-[24px] border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Espacio
                      </p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">
                        {offer.capacityAvailable} {humanizeUnit(offer.capacityUnit)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {offer.origin} → {offer.destination}
                      </p>
                    </div>

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                      {offer.status || "active"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Carga permitida:</span>{" "}
                      {offer.cargoType || "Carga general"}
                    </p>
                    <p>
                      <span className="font-semibold">Precio:</span>{" "}
                      {formatCOP(offer.suggestedPrice)}
                    </p>
                    <p>
                      <span className="font-semibold">Transportador:</span>{" "}
                      {getDriverName(offer.driver)}
                    </p>
                    <p>
                      <span className="font-semibold">Negociable:</span>{" "}
                      {offer.isNegotiable ? "Sí" : "No"}
                    </p>
                    {offer.description ? (
                      <p>
                        <span className="font-semibold">Descripción:</span>{" "}
                        {offer.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "space", "request")}
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Solicitar espacio
                    </button>
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "space", "offer")}
                      className="rounded-2xl bg-blue-100 text-blue-700 py-3 font-semibold"
                    >
                      Enviar oferta
                    </button>
                  </div>
                </div>
              ))}

            {activeTab === "seat" &&
              seatOffers.map((offer) => (
                <div
                  key={offer._id}
                  className="bg-white rounded-[24px] border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Cupos
                      </p>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">
                        {offer.seatsAvailable} {offer.seatUnit}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {offer.origin} → {offer.destination}
                      </p>
                    </div>

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {offer.status || "active"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Precio:</span>{" "}
                      {formatCOP(offer.suggestedPrice)}
                    </p>
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

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "seat", "reserve")}
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Reservar cupo
                    </button>
                    <button
                      type="button"
                      onClick={() => openBidModal(offer, "seat", "offer")}
                      className="rounded-2xl bg-emerald-100 text-emerald-700 py-3 font-semibold"
                    >
                      Enviar oferta
                    </button>
                  </div>
                </div>
              ))}
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
                {selectedOffer?.productName ||
                  `${selectedOffer?.capacityAvailable || selectedOffer?.seatsAvailable || ""} ${
                    selectedOffer?.capacityUnit || selectedOffer?.seatUnit || ""
                  }`}
              </p>
              <p>
                <span className="font-semibold">Precio sugerido:</span>{" "}
                {formatCOP(selectedOffer?.suggestedPrice)}
              </p>
              <p>
                <span className="font-semibold">Transportador:</span>{" "}
                {getDriverName(selectedOffer?.driver)}
              </p>
            </div>

            <form onSubmit={handleSubmitBid} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    name="requestedQuantity"
                    value={bidForm.requestedQuantity}
                    onChange={handleBidFormChange}
                    min="1"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    name="requestedUnit"
                    value={bidForm.requestedUnit}
                    onChange={handleBidFormChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Valor que ofreces
                </label>
                <input
                  type="number"
                  name="offeredPrice"
                  value={bidForm.offeredPrice}
                  onChange={handleBidFormChange}
                  min="0"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
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
