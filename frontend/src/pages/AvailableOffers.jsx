import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  const [activeTab, setActiveTab] = useState("goods");
  const [loading, setLoading] = useState(false);
  const [goodsOffers, setGoodsOffers] = useState([]);
  const [spaceOffers, setSpaceOffers] = useState([]);
  const [seatOffers, setSeatOffers] = useState([]);
  const [error, setError] = useState("");

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

        <button
          type="button"
          onClick={fetchOffers}
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center"
        >
          <i className="ri-refresh-line text-lg"></i>
        </button>
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
        ) : error ? (
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
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Comprar
                    </button>
                    <button
                      type="button"
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
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Solicitar espacio
                    </button>
                    <button
                      type="button"
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
                      className="rounded-2xl bg-black text-white py-3 font-semibold"
                    >
                      Reservar cupo
                    </button>
                    <button
                      type="button"
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
    </div>
  );
};

export default AvailableOffers;
