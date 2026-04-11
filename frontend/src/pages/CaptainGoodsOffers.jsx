import React, { useContext, useEffect, useState } from "react";
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
  { value: "por_kg", label: "Por kg" },
  { value: "por_gramo", label: "Por gramo" },
  { value: "por_libra", label: "Por libra" },
  { value: "por_bulto", label: "Por bulto" },
  { value: "por_paca", label: "Por paca" },
  { value: "por_caja", label: "Por caja" },
  { value: "por_canastilla", label: "Por canastilla" },
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_unidad", label: "Por unidad" },
  { value: "precio_total", label: "Precio total" },
];

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
  }, [captain?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

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
      fetchMyGoodsOffers();
    } catch (error) {
      console.error("Error publicando oferta de mercancía:", error);
      setMessage(
        error?.response?.data?.message ||
          "No se pudo publicar la oferta de mercancía."
      );
    } finally {
      setLoading(false);
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
              Publicar mercancía
            </h1>
            <p className="text-xs text-gray-600">
              Vende productos que llevas en ruta
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
          <i className="ri-shopping-basket-2-line text-xl text-orange-600"></i>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-200 p-4">
          <div className="mb-4">
            <p className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 px-3 py-1 text-xs font-semibold">
              Nueva publicación
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Cantidad disponible
                </label>
                <input
                  type="number"
                  name="quantityAvailable"
                  value={form.quantityAvailable}
                  onChange={handleChange}
                  placeholder="Ej: 20"
                  min="0"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Precio sugerido
                </label>
                <input
                  type="number"
                  name="suggestedPrice"
                  value={form.suggestedPrice}
                  onChange={handleChange}
                  placeholder="Ej: 85000"
                  min="0"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Tipo de precio
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
              <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black text-white py-3.5 text-base font-semibold disabled:opacity-60"
            >
              {loading ? "Publicando..." : "Publicar mercancía"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-[24px] shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Mis publicaciones
              </h2>
              <p className="text-sm text-gray-600">
                Mercancía que tienes activa o publicada
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMyGoodsOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>

          {loadingMine ? (
            <div className="text-sm text-gray-600">Cargando publicaciones...</div>
          ) : myOffers.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">
              Aún no has publicado mercancía.
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map((offer) => (
                <div
                  key={offer._id}
                  className="rounded-2xl border border-gray-200 p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        {offer.productName}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {offer.quantityAvailable} {offer.quantityUnit}
                      </p>
                    </div>

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {offer.status || "active"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Precio:</span>{" "}
                      {formatCOP(offer.suggestedPrice)}
                    </p>
                    <p>
                      <span className="font-semibold">Ruta:</span> {offer.origin} →{" "}
                      {offer.destination}
                    </p>
                    <p>
                      <span className="font-semibold">Negociable:</span>{" "}
                      {offer.isNegotiable ? "Sí" : "No"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptainGoodsOffers;
