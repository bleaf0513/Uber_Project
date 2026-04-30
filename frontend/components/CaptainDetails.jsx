import React, { useContext, useEffect, useMemo, useState } from "react";
import "remixicon/fonts/remixicon.css";
import axios from "axios";
import { CaptainDataContext } from "../src/context/CaptainContext";
import { getApiBaseUrl } from "../src/apiBase";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";

const DEFAULT_PROFILE_IMAGE =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

const CaptainDetails = () => {
  const { captain } = useContext(CaptainDataContext);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryMode, setSummaryMode] = useState("summary");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [driverStats, setDriverStats] = useState(null);
  const [driverRides, setDriverRides] = useState([]);

  const firstname = captain?.fullname?.firstname ?? "";
  const lastname = captain?.fullname?.lastname ?? "";

  const displayName =
    [firstname, lastname].filter(Boolean).join(" ") || "Transportador";

  const profileImage =
    captain?.profileImage ||
    captain?.photo ||
    captain?.avatar ||
    captain?.image ||
    DEFAULT_PROFILE_IMAGE;

  const rating = Number(captain?.rating ?? 5);
  const isOnline = Boolean(captain?.onlineSession?.isOnline);

  const fallbackStats = captain?.stats || {};
  const stats = driverStats || fallbackStats || {};

  const hoursOnline = Number(stats?.hoursOnline ?? 0);
  const totalDistanceKm = Number(stats?.totalDistanceKm ?? 0);
  const totalEarning = Number(stats?.totalEarning ?? 0);
  const cashCollected = Number(stats?.cashCollected ?? 0);
  const transferCollected = Number(stats?.transferCollected ?? 0);
  const unknownPaymentCollected = Number(stats?.unknownPaymentCollected ?? 0);
  const totalTrips = Number(stats?.totalTrips ?? 0);
  const pendingToSettle = Number(stats?.pendingToSettle ?? 0);

  const hasAnyStats =
    hoursOnline > 0 ||
    totalDistanceKm > 0 ||
    totalEarning > 0 ||
    cashCollected > 0 ||
    transferCollected > 0 ||
    unknownPaymentCollected > 0 ||
    totalTrips > 0 ||
    pendingToSettle > 0;

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }, []);

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 1,
    });
  }, []);

  const fetchCaptainStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError("");

      const token = localStorage.getItem("token");

      if (!token) {
        setStatsError("No hay sesión activa del conductor.");
        return;
      }

      const response = await axios.get(`${getApiBaseUrl()}/rides/captain-stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setDriverStats(response?.data?.stats || null);
      setDriverRides(
        Array.isArray(response?.data?.rides) ? response.data.rides : []
      );
    } catch (error) {
      setStatsError(
        error?.response?.data?.message ||
          "No se pudieron cargar las estadísticas del conductor."
      );
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptainStats();

    const interval = setInterval(() => {
      fetchCaptainStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const openSummary = (mode) => {
    setSummaryMode(mode);
    setSummaryOpen(true);
    fetchCaptainStats();
  };

  const closeSummary = () => {
    setSummaryOpen(false);
  };

  const MetricCard = ({
    icon,
    label,
    value,
    helper,
    iconClassName = "text-purple-700",
  }) => {
    return (
      <div className="rounded-[20px] bg-white border border-gray-200 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center">
            <i className={`${icon} text-xl ${iconClassName}`}></i>
          </div>

          <div className="w-2 h-2 rounded-full bg-purple-300"></div>
        </div>

        <div className="mt-2">
          <p className="text-lg font-black text-gray-950 leading-6">{value}</p>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide mt-1">
            {label}
          </p>
          {!!helper && (
            <p className="text-[10px] text-gray-400 mt-0.5">{helper}</p>
          )}
        </div>
      </div>
    );
  };

  const ActionButton = ({ icon, title, subtitle, onClick, variant = "light" }) => {
    const isDark = variant === "dark";

    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-[20px] p-3 text-left shadow-sm active:scale-[0.99] transition border ${
          isDark
            ? "bg-gray-950 border-gray-900 text-white"
            : "bg-white border-gray-200 text-gray-950"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? "bg-white/10" : "bg-purple-50"
            }`}
          >
            <i
              className={`${icon} text-xl ${
                isDark ? "text-white" : "text-purple-700"
              }`}
            ></i>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-black truncate">{title}</p>
            <p
              className={`text-[11px] mt-0.5 truncate ${
                isDark ? "text-white/60" : "text-gray-500"
              }`}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </button>
    );
  };

  const SummaryRow = ({ icon, label, value, colorClass = "text-purple-700" }) => {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <i className={`${icon} ${colorClass} text-lg`}></i>
          </div>

          <p className="text-sm font-bold text-gray-600 truncate">{label}</p>
        </div>

        <p className="text-sm font-black text-gray-950 shrink-0">{value}</p>
      </div>
    );
  };

  const modalTitle =
    summaryMode === "settlement"
      ? "Liquidación del día"
      : summaryMode === "statistics"
      ? "Estadísticas"
      : "Resumen operativo";

  const modalSubtitle =
    summaryMode === "settlement"
      ? "Recaudo, transferencias y pendiente por liquidar."
      : summaryMode === "statistics"
      ? "Rendimiento general del conductor."
      : "Control rápido de viajes, recaudo y operación.";

  return (
    <>
      <div className="px-4">
        <div className="rounded-[30px] bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5">
            <div
              className="rounded-[26px] p-[1px]"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              <div className="rounded-[25px] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
                      src={profileImage}
                      alt={displayName}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                      }}
                    />

                    <span
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                        isOnline ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    ></span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-purple-700 uppercase tracking-wide">
                      Transportador Central Go
                    </p>

                    <h3 className="text-[20px] font-black text-gray-950 capitalize leading-tight mt-1 truncate">
                      {displayName}
                    </h3>

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-3 py-1.5 text-xs font-black">
                        <i className="ri-star-fill"></i>
                        <span>{rating.toFixed(1)}</span>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-full ${
                          isOnline
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <i className="ri-shield-check-line"></i>
                        <span>{isOnline ? "En línea" : "Fuera de línea"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {!hasAnyStats && (
                  <div
                    className="mt-4 rounded-2xl border border-purple-100 px-4 py-3"
                    style={{
                      background: PURPLE_SOFT,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                        <i className="ri-information-line text-purple-700 text-xl"></i>
                      </div>

                      <div>
                        <p className="text-sm font-black text-gray-950">
                          Sin servicios finalizados hoy
                        </p>
                        <p className="text-xs text-gray-600 mt-1 leading-5">
                          Cuando finalices viajes, aquí aparecerán kilómetros,
                          ganancias y liquidación real.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!!statsError && (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-xs font-bold text-red-700">{statsError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <MetricCard
                icon="ri-time-line"
                label="Online"
                value={`${numberFormatter.format(hoursOnline)} h`}
                helper="Hoy"
              />

              <MetricCard
                icon="ri-route-line"
                label="Ruta"
                value={`${numberFormatter.format(totalDistanceKm)} km`}
                helper="Hoy"
              />

              <MetricCard
                icon="ri-money-dollar-circle-line"
                label="Ganado"
                value={currencyFormatter.format(totalEarning)}
                helper="Hoy"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-base font-black text-gray-950">
                    Menú del conductor
                  </h4>
                  <p className="text-xs text-gray-500">
                    Consulta tu operación sin ocupar toda la pantalla.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchCaptainStats}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center border border-purple-100"
                  style={{
                    background: PURPLE_SOFT,
                  }}
                >
                  <i
                    className={`ri-refresh-line text-2xl text-purple-700 ${
                      statsLoading ? "animate-spin" : ""
                    }`}
                  ></i>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <ActionButton
                  icon="ri-bar-chart-box-line"
                  title="Resumen operativo"
                  subtitle="Servicios, recaudo y actividad"
                  onClick={() => openSummary("summary")}
                  variant="dark"
                />

                <div className="grid grid-cols-2 gap-3">
                  <ActionButton
                    icon="ri-line-chart-line"
                    title="Estadísticas"
                    subtitle={`${totalTrips} servicios hoy`}
                    onClick={() => openSummary("statistics")}
                  />

                  <ActionButton
                    icon="ri-wallet-3-line"
                    title="Liquidación"
                    subtitle={currencyFormatter.format(pendingToSettle)}
                    onClick={() => openSummary("settlement")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {summaryOpen && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-end">
          <div className="w-full rounded-t-[30px] bg-white shadow-2xl max-h-[82vh] overflow-y-auto">
            <div className="flex justify-center py-3">
              <div className="w-16 h-1.5 rounded-full bg-gray-300"></div>
            </div>

            <div className="px-5 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-purple-700 uppercase tracking-wide">
                    Central Go
                  </p>
                  <h3 className="text-2xl font-black text-gray-950 mt-1">
                    {modalTitle}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{modalSubtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={closeSummary}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                >
                  <i className="ri-close-line text-2xl text-gray-800"></i>
                </button>
              </div>

              <div
                className="mt-5 rounded-[26px] p-4 text-white"
                style={{
                  background: PURPLE_GRADIENT,
                }}
              >
                <p className="text-white/80 text-xs font-black uppercase">
                  Ganancia de hoy
                </p>
                <p className="text-3xl font-black mt-1">
                  {currencyFormatter.format(totalEarning)}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-2xl bg-white/15 p-3">
                    <p className="text-white/70 text-xs">Servicios</p>
                    <p className="text-xl font-black mt-1">{totalTrips}</p>
                  </div>

                  <div className="rounded-2xl bg-white/15 p-3">
                    <p className="text-white/70 text-xs">Horas online</p>
                    <p className="text-xl font-black mt-1">
                      {numberFormatter.format(hoursOnline)} h
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <SummaryRow
                  icon="ri-route-line"
                  label="Distancia total"
                  value={`${numberFormatter.format(totalDistanceKm)} km`}
                />

                <SummaryRow
                  icon="ri-cash-line"
                  label="Efectivo recogido"
                  value={currencyFormatter.format(cashCollected)}
                  colorClass="text-emerald-600"
                />

                <SummaryRow
                  icon="ri-bank-card-line"
                  label="Transferencias"
                  value={currencyFormatter.format(transferCollected)}
                  colorClass="text-cyan-600"
                />

                <SummaryRow
                  icon="ri-question-line"
                  label="Método no registrado"
                  value={currencyFormatter.format(unknownPaymentCollected)}
                  colorClass="text-orange-600"
                />

                <SummaryRow
                  icon="ri-wallet-3-line"
                  label="Pendiente por liquidar"
                  value={currencyFormatter.format(pendingToSettle)}
                  colorClass="text-purple-700"
                />
              </div>

              {driverRides.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-base font-black text-gray-950 mb-3">
                    Servicios finalizados hoy
                  </h4>

                  <div className="space-y-2">
                    {driverRides.slice(0, 8).map((item) => (
                      <div
                        key={item._id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-gray-950">
                            {currencyFormatter.format(item.fare || 0)}
                          </p>

                          <p className="text-xs font-bold text-gray-500">
                            {numberFormatter.format(item.distanceKm || 0)} km
                          </p>
                        </div>

                        <p className="text-xs text-gray-600 mt-2 truncate">
                          {item.pickup}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {item.destination}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={closeSummary}
                className="w-full mt-5 rounded-2xl bg-gray-950 text-white py-4 font-black"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CaptainDetails;