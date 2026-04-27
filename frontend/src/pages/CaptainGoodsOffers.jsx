import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CaptainDataContext } from "../context/CaptainContext";
import { getApiBaseUrl } from "../apiBase";

const GOODS_UNITS = [
  "kg",
  "gramos",
  "libras",
  "bultos",
  "pacas",
  "cajas",
  "canastillas",
  "toneladas",
  "unidades",
];

const GOODS_PRICE_TYPES = [
  { value: "por_kg", label: "Por kg", unit: "kg" },
  { value: "por_gramo", label: "Por gramo", unit: "gramos" },
  { value: "por_libra", label: "Por libra", unit: "libras" },
  { value: "por_bulto", label: "Por bulto", unit: "bultos" },
  { value: "por_paca", label: "Por paca", unit: "pacas" },
  { value: "por_caja", label: "Por caja", unit: "cajas" },
  { value: "por_canastilla", label: "Por canastilla", unit: "canastillas" },
  { value: "por_tonelada", label: "Por tonelada", unit: "toneladas" },
  { value: "por_unidad", label: "Por unidad", unit: "unidades" },
  { value: "precio_total", label: "Precio total", unit: "" },
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
  precio_total: "precio total",
};

const VEHICLE_TYPES = [
  { value: "", label: "Selecciona vehículo" },
  { value: "motorcycle", label: "Moto" },
  { value: "car", label: "Carro" },
  { value: "light_cargo", label: "Carga liviana" },
  { value: "van", label: "Furgón / Camioneta" },
  { value: "truck", label: "Camión" },
];

const formatCOP = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const humanizePriceType = (priceType) => {
  return PRICE_TYPE_LABELS[priceType] || "precio";
};

const getPriceTypeConfig = (priceType) => {
  return (
    GOODS_PRICE_TYPES.find((item) => item.value === priceType) ||
    GOODS_PRICE_TYPES[0]
  );
};

const buildPriceLabel = (offerOrForm) => {
  if (!offerOrForm) return formatCOP(0);

  if (offerOrForm.priceLabel) return offerOrForm.priceLabel;

  return `${formatCOP(offerOrForm.suggestedPrice)} ${humanizePriceType(
    offerOrForm.priceType
  )}`;
};

const getStatusStyle = (status) => {
  if (status === "sold_out") return "bg-red-100 text-red-700 border-red-200";
  if (status === "paused") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (status === "cancelled") return "bg-gray-200 text-gray-700 border-gray-300";
  if (status === "completed") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

const getStatusText = (status) => {
  if (status === "sold_out") return "Agotada";
  if (status === "paused") return "Pausada";
  if (status === "cancelled") return "Cancelada";
  if (status === "completed") return "Completada";
  return "Activa";
};

const CaptainGoodsOffers = () => {
  const { captain } = useContext(CaptainDataContext);

  const [loading, setLoading] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [myOffers, setMyOffers] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    productName: "",
    quantityAvailable: "",
    quantityUnit: "kg",
    suggestedPrice: "",
    priceType: "por_kg",
    origin: "",
    destination: "",
    departureTime: "",
    vehicleType: "",
    description: "",
    notes: "",
    isNegotiable: true,
  });

  const token = localStorage.getItem("token");

  const priceTypeConfig = useMemo(() => {
    return getPriceTypeConfig(form.priceType);
  }, [form.priceType]);

  const preview = useMemo(() => {
    const product = form.productName.trim() || "Producto";
    const quantity = Number(form.quantityAvailable) || 0;
    const unit = form.quantityUnit || "kg";
    const suggestedPrice = Number(form.suggestedPrice) || 0;

    return {
      product,
      availableLabel: `${quantity} ${unit} disponibles`,
      priceLabel: `${formatCOP(suggestedPrice)} ${humanizePriceType(
        form.priceType
      )}`,
    };
  }, [form]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "priceType") {
        const config = getPriceTypeConfig(value);

        if (value !== "precio_total" && config.unit) {
          next.quantityUnit = config.unit;
        }
      }

      return next;
    });
  };

  const resetForm = () => {
    setForm({
      productName: "",
      quantityAvailable: "",
      quantityUnit: "kg",
      suggestedPrice: "",
      priceType: "por_kg",
      origin: "",
      destination: "",
      departureTime: "",
      vehicleType: "",
      description: "",
      notes: "",
      isNegotiable: true,
    });
  };

  const fetchMyGoodsOffers = async () => {
    try {
      setLoadingMine(true);

      const response = await axios.get(`${getApiBaseUrl()}/offers/goods/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const offers = Array.isArray(response?.data?.offers)
        ? response.data.offers
        : [];

      const mine = offers.filter(
        (offer) =>
          String(offer?.driver?._id || offer?.driver) === String(captain?._id)
      );

      setMyOffers(mine);
    } catch (error) {
      console.error("Error cargando mis ofertas de mercancía:", error);
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (!captain?._id || !token) return;
    fetchMyGoodsOffers();
  }, [captain?._id, token]);

  const validateForm = () => {
    const productName = form.productName.trim();
    const origin = form.origin.trim();
    const destination = form.destination.trim();
    const quantityAvailable = Number(form.quantityAvailable);
    const suggestedPrice = Number(form.suggestedPrice);

    if (!productName || productName.length < 2) {
      return "Debes ingresar un producto válido.";
    }

    if (!Number.isFinite(quantityAvailable) || quantityAvailable <= 0) {
      return "La cantidad disponible debe ser mayor que 0.";
    }

    if (!form.quantityUnit) {
      return "Debes seleccionar una unidad.";
    }

    if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) {
      return "Debes ingresar un precio mayor que 0.";
    }

    if (!form.priceType) {
      return "Debes seleccionar el tipo de precio.";
    }

    if (form.priceType !== "precio_total" && priceTypeConfig.unit) {
      if (form.quantityUnit !== priceTypeConfig.unit) {
        return `Para evitar confusiones, si el precio es ${priceTypeConfig.label.toLowerCase()}, la unidad disponible debe ser ${priceTypeConfig.unit}.`;
      }
    }

    if (!origin || origin.length < 3) {
      return "Debes ingresar un origen válido.";
    }

    if (!destination || destination.length < 3) {
      return "Debes ingresar un destino válido.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setLoading(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/goods/create`,
        {
          productName: form.productName.trim(),
          quantityAvailable: Number(form.quantityAvailable),
          quantityUnit: form.quantityUnit,
          suggestedPrice: Number(form.suggestedPrice),
          priceType: form.priceType,
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          departureTime: form.departureTime
            ? new Date(form.departureTime).toISOString()
            : null,
          vehicleType: form.vehicleType || null,
          description: form.description.trim(),
          notes: form.notes.trim(),
          isNegotiable: form.isNegotiable,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("Oferta de mercancía publicada correctamente.");
      resetForm();
      await fetchMyGoodsOffers();
    } catch (error) {
      console.error("Error publicando oferta de mercancía:", error);

      const apiErrors = error?.response?.data?.errors;
      const apiMessage = error?.response?.data?.message;

      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        setMessage(apiErrors[0]?.msg || "Datos inválidos para publicar.");
      } else {
        setMessage(apiMessage || "No se pudo publicar la oferta de mercancía.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderOfferCard = (offer) => {
    const availableLabel =
      offer.availableLabel ||
      `${offer.quantityAvailable} ${offer.quantityUnit} disponibles`;

    const priceLabel = buildPriceLabel(offer);

    return (
      <div
        key={offer._id}
        className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400" />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center shadow-sm">
                <i className="ri-shopping-basket-2-line text-2xl" />
              </div>

              <div>
                <p className="text-xs font-black text-orange-700 uppercase tracking-wide">
                  Mercancía publicada
                </p>

                <h3 className="text-lg font-black text-gray-950 mt-1 leading-tight">
                  {offer.productName}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {offer.origin} → {offer.destination}
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-full border ${getStatusStyle(
                offer.status
              )}`}
            >
              {getStatusText(offer.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-950 text-white px-4 py-3 shadow-lg">
              <p className="text-xs text-white/60 font-bold">
                Disponible real
              </p>
              <p className="text-lg font-black mt-1">{availableLabel}</p>
            </div>

            <div className="rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3">
              <p className="text-xs text-orange-700 font-bold">
                Precio publicado
              </p>
              <p className="text-lg font-black text-orange-800 mt-1">
                {priceLabel}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-black">Negociable:</span>{" "}
              {offer.isNegotiable ? "Sí, recibe ofertas" : "No negociable"}
            </p>

            {offer.departureTime ? (
              <p className="text-sm text-gray-700">
                <span className="font-black">Salida:</span>{" "}
                {new Date(offer.departureTime).toLocaleString("es-CO")}
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

            {offer.notes ? (
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <p className="text-xs font-black text-gray-500 mb-1">Notas</p>
                <p className="text-sm text-gray-700">{offer.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={fetchMyGoodsOffers}
              className="rounded-2xl bg-gray-100 text-gray-800 py-3 font-black border border-gray-200"
            >
              Actualizar
            </button>

            <Link
              to="/captain-received-bids"
              className="rounded-2xl bg-orange-600 text-white py-3 font-black text-center shadow-lg shadow-orange-600/20"
            >
              Ver solicitudes
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/captain-home"
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </Link>

          <div>
            <h1 className="text-lg font-black text-gray-950">
              Publicar mercancía
            </h1>
            <p className="text-xs text-gray-600">
              Vende productos que llevas en ruta
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center">
          <i className="ri-shopping-basket-2-line text-xl text-orange-600"></i>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="bg-white rounded-[24px] shadow-[0_16px_45px_rgba(15,23,42,0.08)] border border-white p-4">
          <div className="mb-4">
            <p className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 px-3 py-1 text-xs font-bold border border-orange-100">
              Nueva publicación
            </p>

            <p className="text-sm text-gray-600 mt-3">
              Llena la cantidad total que tienes disponible y especifica si el
              precio es por kg, por caja, por bulto, por unidad o por el total.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Producto
              </label>
              <input
                type="text"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Ej: Papa capira, tomate, cebolla..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="rounded-[22px] border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-700 uppercase mb-3">
                Cantidad total disponible
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    name="quantityAvailable"
                    value={form.quantityAvailable}
                    onChange={handleChange}
                    placeholder="Ej: 200"
                    min="1"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Unidad
                  </label>
                  <select
                    name="quantityUnit"
                    value={form.quantityUnit}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  >
                    {GOODS_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Ejemplo: si traes 200 kilos, coloca cantidad 200 y unidad kg.
              </p>
            </div>

            <div className="rounded-[22px] border border-orange-100 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-700 uppercase mb-3">
                Precio de venta
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Precio
                  </label>
                  <input
                    type="number"
                    name="suggestedPrice"
                    value={form.suggestedPrice}
                    onChange={handleChange}
                    placeholder="Ej: 20000"
                    min="1"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    El precio es
                  </label>
                  <select
                    name="priceType"
                    value={form.priceType}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                    required
                  >
                    {GOODS_PRICE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-orange-100 px-4 py-3 mt-3">
                <p className="text-xs text-orange-700 font-bold">
                  Así verá el usuario tu publicación
                </p>
                <p className="text-base font-black text-gray-900 mt-1">
                  {preview.product}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Disponible:{" "}
                  <span className="font-bold">{preview.availableLabel}</span>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Precio publicado:{" "}
                  <span className="font-bold">{preview.priceLabel}</span>
                </p>
              </div>

              {form.priceType !== "precio_total" ? (
                <p className="text-xs text-orange-700 mt-2">
                  Para evitar confusiones, al elegir{" "}
                  <strong>{priceTypeConfig.label.toLowerCase()}</strong>, la
                  unidad disponible debe coincidir con{" "}
                  <strong>{priceTypeConfig.unit}</strong>.
                </p>
              ) : (
                <p className="text-xs text-orange-700 mt-2">
                  Precio total significa que el valor publicado corresponde a
                  toda la mercancía disponible.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Origen
              </label>
              <input
                type="text"
                name="origin"
                value={form.origin}
                onChange={handleChange}
                placeholder="Ej: Central Mayorista"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Destino
              </label>
              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="Ej: Itagüí, Sabaneta, Envigado..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Hora de salida
                </label>
                <input
                  type="datetime-local"
                  name="departureTime"
                  value={form.departureTime}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Vehículo
                </label>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                >
                  {VEHICLE_TYPES.map((item) => (
                    <option key={item.value || "none"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Ej: Papa recién cargada, buen estado, lista para entrega..."
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Notas adicionales
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Ej: Negociable, entrego en ruta, recibo llamadas..."
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none resize-none"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                name="isNegotiable"
                checked={form.isNegotiable}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Permitir negociación
              </span>
            </label>

            {message ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  message.includes("correctamente")
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black text-white py-3.5 text-base font-bold disabled:opacity-60"
            >
              {loading ? "Publicando..." : "Publicar mercancía"}
            </button>
          </form>
        </div>

        <div className="rounded-[30px] bg-white/90 backdrop-blur-xl shadow-[0_22px_65px_rgba(15,23,42,0.10)] border border-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-gray-950">
                Mis publicaciones
              </h2>
              <p className="text-sm text-gray-600">
                Controla tu mercancía activa, disponibilidad real y precio
                publicado
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMyGoodsOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>

          {loadingMine ? (
            <div className="text-sm text-gray-600">
              Cargando publicaciones...
            </div>
          ) : myOffers.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center border border-gray-200">
              Aún no has publicado mercancía.
            </div>
          ) : (
            <div className="space-y-5">
              {myOffers.map((offer) => renderOfferCard(offer))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptainGoodsOffers;