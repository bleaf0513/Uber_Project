import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseDeliveryStats = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [viewMode, setViewMode] = useState("day"); // day | month
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7);
  });

  useEffect(() => {
    const loadData = () => {
      const savedDrivers = JSON.parse(
        localStorage.getItem("enterpriseDrivers") || "[]"
      );
      const savedDeliveries = JSON.parse(
        localStorage.getItem("enterpriseDeliveries") || "[]"
      );

      setDrivers(savedDrivers);
      setDeliveries(savedDeliveries);
    };

    loadData();

    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const baseDate =
        delivery.finishedAt ||
        delivery.startedAt ||
        delivery.createdAt ||
        "";

      if (!baseDate) return false;

      if (viewMode === "day") {
        return baseDate.startsWith(selectedDate);
      }

      if (viewMode === "month") {
        return baseDate.slice(0, 7) === selectedMonth;
      }

      return true;
    });
  }, [deliveries, viewMode, selectedDate, selectedMonth]);

  const globalStats = useMemo(() => {
    const total = filteredDeliveries.length;
    const pending = filteredDeliveries.filter(
      (d) => d.status === "Pendiente"
    ).length;
    const inProgress = filteredDeliveries.filter(
      (d) => d.status === "En curso"
    ).length;
    const finished = filteredDeliveries.filter(
      (d) => d.status === "Finalizada"
    ).length;

    const completionRate = total > 0 ? ((finished / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      pending,
      inProgress,
      finished,
      completionRate,
    };
  }, [filteredDeliveries]);

  const driverStats = useMemo(() => {
    return drivers.map((driver) => {
      const driverDeliveries = filteredDeliveries.filter(
        (delivery) =>
          String(delivery.assignedDriverId) === String(driver.id)
      );

      const total = driverDeliveries.length;
      const pending = driverDeliveries.filter(
        (d) => d.status === "Pendiente"
      ).length;
      const inProgress = driverDeliveries.filter(
        (d) => d.status === "En curso"
      ).length;
      const finished = driverDeliveries.filter(
        (d) => d.status === "Finalizada"
      ).length;

      const completionRate =
        total > 0 ? ((finished / total) * 100).toFixed(1) : "0.0";

      return {
        ...driver,
        total,
        pending,
        inProgress,
        finished,
        completionRate,
      };
    });
  }, [drivers, filteredDeliveries]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estadísticas de entregas</h1>
            <p className="text-sm text-blue-100 mt-1">
              Consulta el rendimiento general y por conductor
            </p>
          </div>

          <Link
            to="/enterprise-dashboard"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Filtros de consulta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="day">Ver por día</option>
              <option value="month">Ver por mes</option>
            </select>

            {viewMode === "day" ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              />
            )}

            <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center">
              <p className="text-sm text-blue-700 font-semibold">
                {viewMode === "day"
                  ? `Consultando el día: ${selectedDate}`
                  : `Consultando el mes: ${selectedMonth}`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {globalStats.total}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-500">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {globalStats.pending}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-500">En curso</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {globalStats.inProgress}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-500">Finalizadas</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {globalStats.finished}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-500">% Cumplimiento</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {globalStats.completionRate}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Rendimiento por conductor
          </h2>

          {driverStats.length === 0 ? (
            <p className="text-gray-500">No hay conductores registrados.</p>
          ) : (
            <div className="space-y-4">
              {driverStats.map((driver) => (
                <div
                  key={driver.id}
                  className="border rounded-2xl p-4 bg-gray-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {driver.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        CC {driver.cedula} · {driver.vehicle || "Sin vehículo"}
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-gray-700">
                      Estado actual: {driver.status || "Disponible"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {driver.total}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">Pendientes</p>
                      <p className="text-lg font-bold text-yellow-600 mt-1">
                        {driver.pending}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">En curso</p>
                      <p className="text-lg font-bold text-blue-600 mt-1">
                        {driver.inProgress}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">Finalizadas</p>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        {driver.finished}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500">% Cumplimiento</p>
                      <p className="text-lg font-bold text-purple-600 mt-1">
                        {driver.completionRate}%
                      </p>
                    </div>
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

export default EnterpriseDeliveryStats;
