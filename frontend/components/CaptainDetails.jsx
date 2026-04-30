import React, { useContext, useMemo } from "react";
import "remixicon/fonts/remixicon.css";
import { CaptainDataContext } from "../src/context/CaptainContext";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_SOFT = "linear-gradient(135deg, #F3E8FF, #FAE8FF)";

const DEFAULT_PROFILE_IMAGE =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

const CaptainDetails = () => {
  const { captain } = useContext(CaptainDataContext);

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

  const stats = captain?.stats || {};

  const hoursOnline = Number(stats?.hoursOnline ?? 0);
  const totalDistanceKm = Number(stats?.totalDistanceKm ?? 0);
  const totalEarning = Number(stats?.totalEarning ?? 0);
  const cashCollected = Number(stats?.cashCollected ?? 0);
  const transferCollected = Number(stats?.transferCollected ?? 0);
  const totalTrips = Number(stats?.totalTrips ?? 0);
  const pendingToSettle = Number(stats?.pendingToSettle ?? 0);

  const hasAnyStats =
    hoursOnline > 0 ||
    totalDistanceKm > 0 ||
    totalEarning > 0 ||
    cashCollected > 0 ||
    transferCollected > 0 ||
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

  const showComingSoon = (sectionName) => {
    alert(
      `${sectionName} estará disponible cuando conectemos el módulo de estadísticas reales del conductor.`
    );
  };

  const MetricCard = ({
    icon,
    label,
    value,
    helper,
    iconClassName = "text-purple-700",
  }) => {
    return (
      <div className="rounded-[22px] bg-white border border-gray-200 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
            <i className={`${icon} text-xl ${iconClassName}`}></i>
          </div>

          <div className="w-2 h-2 rounded-full bg-purple-300"></div>
        </div>

        <div className="mt-3">
          <p className="text-xl font-black text-gray-950 leading-6">{value}</p>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mt-1">
            {label}
          </p>
          {!!helper && <p className="text-[11px] text-gray-400 mt-1">{helper}</p>}
        </div>
      </div>
    );
  };

  const MoneyRow = ({ label, value, icon, colorClass }) => {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 border border-white/80 px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
            <i className={`${icon} ${colorClass} text-lg`}></i>
          </div>

          <p className="text-xs font-bold text-gray-600 truncate">{label}</p>
        </div>

        <p className="text-sm font-black text-gray-950 shrink-0">
          {currencyFormatter.format(value)}
        </p>
      </div>
    );
  };

  return (
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

                  <h3 className="text-[20px] font-black text-gray-950 capitalize leading-tight mt-1">
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
                        Estadísticas en preparación
                      </p>
                      <p className="text-xs text-gray-600 mt-1 leading-5">
                        Cuando finalices servicios, aquí verás horas, kilómetros,
                        ganancias y liquidación real.
                      </p>
                    </div>
                  </div>
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
              helper="Recorridos"
            />

            <MetricCard
              icon="ri-money-dollar-circle-line"
              label="Ganado"
              value={currencyFormatter.format(totalEarning)}
              helper="Total"
            />
          </div>

          <div className="mt-4 rounded-[26px] bg-gray-950 overflow-hidden shadow-sm">
            <div
              className="px-4 py-4"
              style={{
                background: PURPLE_GRADIENT,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white/80 text-xs font-black uppercase tracking-wide">
                    Operación de hoy
                  </p>
                  <h4 className="text-white text-lg font-black mt-1">
                    Resumen y liquidación
                  </h4>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <i className="ri-bar-chart-box-line text-2xl text-white"></i>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-white/60 text-xs font-bold">
                    Servicios realizados
                  </p>
                  <p className="text-white text-2xl font-black mt-1">
                    {totalTrips}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                  <p className="text-white/60 text-xs font-bold">
                    Por liquidar
                  </p>
                  <p className="text-white text-lg font-black mt-1">
                    {currencyFormatter.format(pendingToSettle)}
                  </p>
                </div>
              </div>

              <MoneyRow
                label="Efectivo recogido"
                value={cashCollected}
                icon="ri-cash-line"
                colorClass="text-emerald-600"
              />

              <MoneyRow
                label="Transferencias"
                value={transferCollected}
                icon="ri-bank-card-line"
                colorClass="text-cyan-600"
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => showComingSoon("Estadísticas")}
                  className="rounded-2xl bg-white text-gray-950 p-3.5 font-black shadow-sm active:scale-[0.99] transition"
                >
                  <span className="inline-flex items-center justify-center gap-2 text-sm">
                    <i className="ri-line-chart-line text-purple-700"></i>
                    Estadísticas
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => showComingSoon("Liquidación")}
                  className="rounded-2xl bg-white/10 border border-white/15 text-white p-3.5 font-black shadow-sm active:scale-[0.99] transition"
                >
                  <span className="inline-flex items-center justify-center gap-2 text-sm">
                    <i className="ri-wallet-3-line"></i>
                    Liquidación
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-white/50 text-center leading-5 pt-1">
                Estos valores se actualizarán automáticamente cuando conectemos el
                resumen real de viajes finalizados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaptainDetails;