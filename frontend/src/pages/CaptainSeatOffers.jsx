import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CaptainDataContext } from "../context/CaptainContext";
import { getApiBaseUrl } from "../apiBase";

const SEAT_UNITS = ["cupo", "cupos", "puesto", "puestos"];

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

const CaptainSeatOffers = () => {
  const { captain } = useContext(CaptainDataContext);

  const [loading, setLoading] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [myOffers, setMyOffers] = useState([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    seatsAvailable: "",
    seatUnit: "cupos",
    suggestedPrice: "",
    origin: "",
    stopsText: "",
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
      seatsAvailable: "",
      seatUnit: "cupos",
      suggestedPrice: "",
      origin: "",
      stopsText: "",
      destination: "",
      departureTime: "",
      vehicleType: "",
      description: "",
      notes: "",
      isNegotiable: true,
    });
  };

  const parseStops = (text) => {
    return String(text || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const fetchMySeatOffers = async () => {
    try {
      setLoadingMine(true);

      const response = await axios.get(`${getApiBaseUrl()}/offers/seat/list`, {
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
      console.error("Error cargando mis ofertas de cupos:", error);
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (!captain?._id || !token) return;
    fetchMySeatOffers();
  }, [captain?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      setLoading(true);

      await axios.post(
        `${getApiBaseUrl()}/offers/seat/create`,
        {
          seatsAvailable: Number(form.seatsAvailable),
          seatUnit: form.seatUnit,
          suggestedPrice: Number(form.suggestedPrice),
          origin: form.origin.trim(),
          stops: parseStops(form.stopsText),
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

      setMessage("Oferta de cupos publicada correctamente.");
      resetForm();
      fetchMySeatOffers();
    } catch (error) {
      console.error("Error publicando oferta de cupos:", error);
      setMessage(
        error?.response?.data?.message ||
          "No se pudo publicar la oferta de cupos."
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
              Publicar cupos
            </h1>
            <p className="text-xs text-gray-600">
              Comparte puestos para pasajeros en tu ruta
            </p>
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <i className="ri-user-3-line text-xl text-emerald-600"></i>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-200 p-4">
          <div className="mb-4">
            <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold">
              Nueva publicación
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Cupos disponibles
                </label>
                <input
                  type="number"
                  name="seatsAvailable"
                  value={form.seatsAvailable}
                  onChange={handleChange}
                  placeholder="Ej: 3"
                  min="1"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  Unidad
                </label>
                <select
                  name="seatUnit"
                  value={form.seatUnit}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none bg-white"
                  required
                >
                  {SEAT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Precio sugerido
              </label>
              <input
                type="number"
                name="suggestedPrice"
                value={form.suggestedPrice}
                onChange={handleChange}
                placeholder="Ej: 12000"
                min="0"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
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
                placeholder="Ej: Itagüí"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Paradas o ruta intermedia
              </label>
              <input
                type="text"
                name="stopsText"
                value={form.stopsText}
                onChange={handleChange}
                placeholder="Ej: Envigado, Mayorca, Sabaneta"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sepáralas por comas.
              </p>
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
                placeholder="Ej: Sabaneta"
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
                placeholder="Ej: Salgo puntual, llevo pasajeros cómodamente, ruta directa..."
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
                placeholder="Ej: Solo con reserva, negociable, recojo en ruta..."
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
              {loading ? "Publicando..." : "Publicar cupos"}
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
                Cupos o puestos que tienes publicados
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMySeatOffers}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
            >
              <i className="ri-refresh-line text-lg"></i>
            </button>
          </div>

          {loadingMine ? (
            <div className="text-sm text-gray-600">Cargando publicaciones...</div>
          ) : myOffers.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">
              Aún no has publicado cupos disponibles.
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

                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Precio:</span>{" "}
                      {formatCOP(offer.suggestedPrice)}
                    </p>

                    {Array.isArray(offer.stops) && offer.stops.length > 0 ? (
                      <p>
                        <span className="font-semibold">Paradas:</span>{" "}
                        {offer.stops.join(", ")}
                      </p>
                    ) : null}

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

export default CaptainSeatOffers;
