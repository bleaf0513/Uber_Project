import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "remixicon/fonts/remixicon.css";
import { CaptainDataContext } from "./../src/context/CaptainContext";

const CaptainDetails = () => {
  const navigate = useNavigate();
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
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";

  const rating = Number(captain?.rating ?? captain?.stats?.rating ?? 4.9);

  const stats = captain?.stats || {};

  const hoursOnline = Number(
    stats?.hoursOnline ??
      captain?.hoursOnline ??
      0
  );

  const totalDistanceKm = Number(
    stats?.totalDistanceKm ??
      stats?.distanceKm ??
      captain?.totalDistanceKm ??
      0
  );

  const totalEarning = Number(
    stats?.totalEarning ??
      stats?.earnings ??
      captain?.totalEarning ??
      0
  );

  const cashCollected = Number(
    stats?.cashCollected ??
      stats?.cash ??
      captain?.cashCollected ??
      0
  );

  const transferCollected = Number(
    stats?.transferCollected ??
      stats?.transfer ??
      captain?.transferCollected ??
      0
  );

  const totalTrips = Number(
    stats?.totalTrips ??
      stats?.completedTrips ??
      captain?.totalTrips ??
      0
  );

  const pendingToSettle = Number(
    stats?.pendingToSettle ??
      captain?.pendingToSettle ??
      0
  );

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

  const goToStatistics = () => {
    navigate("/captain/statistics");
  };

  const goToSettlement = () => {
    navigate("/captain/settlement");
  };

  return (
    <div className="px-4">
      <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                src={profileImage}
                alt={displayName}
                onError={(e) => {
                  e.currentTarget.src =
                    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRV-zbJg0P98SwYoQJCjzTONpVf1dB9pB9VCQ&s";
                }}
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white"></span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-bold text-gray-900 capitalize leading-tight">
                {displayName}
              </h3>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold">
                  <i className="ri-star-fill"></i>
                  <span>{rating.toFixed(1)}</span>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
                  <i className="ri-shield-check-line"></i>
                  <span>Conductor activo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
              <div className="w-11 h-11 rounded-2xl bg-white mx-auto mb-2 flex items-center justify-center shadow-sm">
                <i className="ri-time-line text-[22px] text-gray-800"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {numberFormatter.format(hoursOnline)}
              </h2>
              <h4 className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                Horas online
              </h4>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
              <div className="w-11 h-11 rounded-2xl bg-white mx-auto mb-2 flex items-center justify-center shadow-sm">
                <i className="ri-route-line text-[22px] text-gray-800"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {numberFormatter.format(totalDistanceKm)} KM
              </h2>
              <h4 className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                Distancia total
              </h4>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-center">
              <div className="w-11 h-11 rounded-2xl bg-white mx-auto mb-2 flex items-center justify-center shadow-sm">
                <i className="ri-money-dollar-circle-line text-[22px] text-gray-800"></i>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                {currencyFormatter.format(totalEarning)}
              </h2>
              <h4 className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                Ganancia total
              </h4>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-100 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Resumen del día
                </h4>
                <p className="text-sm text-gray-600">
                  Control de recaudo y desempeño del conductor.
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                <i className="ri-bar-chart-box-line text-2xl text-emerald-700"></i>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/90 border border-white p-3">
                <p className="text-xs text-gray-500 font-medium">Viajes realizados</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {totalTrips}
                </p>
              </div>

              <div className="rounded-2xl bg-white/90 border border-white p-3">
                <p className="text-xs text-gray-500 font-medium">Pendiente por liquidar</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {currencyFormatter.format(pendingToSettle)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/90 border border-white p-3">
                <p className="text-xs text-gray-500 font-medium">Efectivo recogido</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {currencyFormatter.format(cashCollected)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/90 border border-white p-3">
                <p className="text-xs text-gray-500 font-medium">Transferencias</p>
                <p className="text-lg font-bold text-cyan-700 mt-1">
                  {currencyFormatter.format(transferCollected)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={goToStatistics}
                className="rounded-2xl bg-black text-white p-3.5 font-semibold shadow-sm active:scale-[0.99] transition"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <i className="ri-line-chart-line"></i>
                  Ver estadísticas
                </span>
              </button>

              <button
                type="button"
                onClick={goToSettlement}
                className="rounded-2xl bg-white border border-gray-300 text-gray-900 p-3.5 font-semibold shadow-sm active:scale-[0.99] transition"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <i className="ri-wallet-3-line"></i>
                  Liquidación
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaptainDetails;
