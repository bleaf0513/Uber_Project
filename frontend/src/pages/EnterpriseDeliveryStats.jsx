import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

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
  const [loading, setLoading] = useState(true);

  const parseJsonSafe = async (response, label = "API") => {
    const text = await response.text();
    console.log(`${label} raw response:`, text);

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON. Respuesta: ${text.slice(0, 150)}`
      );
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [driversResponse, deliveriesResponse] = await Promise.all([
        fetch(`${API_BASE}/enterprise-drivers`, {
          method: "GET",
          credentials: "include",
        }),
        fetch(`${API_BASE}/enterprise-deliveries`, {
          method: "GET",
          credentials: "include",
        }),
      ]);

      const [driversData, deliveriesData] = await Promise.all([
        parseJsonSafe(driversResponse, "GET /enterprise-drivers"),
        parseJsonSafe(deliveriesResponse, "GET /enterprise-deliveries"),
      ]);

      if (!driversResponse.ok) {
        throw new Error(
          driversData.message || "No se pudieron cargar los conductores."
        );
      }

      if (!deliveriesResponse.ok) {
        throw new Error(
          deliveriesData.message || "No se pudieron cargar las entregas."
        );
      }

      setDrivers(Array.isArray(driversData.drivers) ? driversData.drivers : []);
      setDeliveries(
        Array.isArray(deliveriesData.deliveries) ? deliveriesData.deliveries : []
      );
    } catch (error) {
      console.error("Error cargando estadísticas de entregas:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);

    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const baseDate =
        delivery.finishedAt ||
        delivery.startedAt ||
        delivery.createdAt ||
        "";

      if (!baseDate) return false;

      if (viewMode === "day") {
        return String(baseDate).startsWith(selectedDate);
      }

      if (viewMode === "month") {
        return String(baseDate).slice(0, 7) === selectedMonth;
      }

      return true;
    });
  }, [deliveries, viewMode, selectedDate, selectedMonth]);

  const generalStats = useMemo(() => {
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

    const completionRate =
      total > 0 ? ((finished / total) * 100).toFixed(1) : "0.0";

    const activeDriversCount = new Set(
      filteredDeliveries
        .map((delivery) => {
          return String(
            delivery.assignedDriverId?._id ||
              delivery.assignedDriverId ||
              delivery.driver?._id ||
              delivery.driver ||
              ""
          );
        })
        .filter(Boolean)
    ).size;

    return {
      total,
      pending,
      inProgress,
      finished,
      completionRate,
      activeDriversCount,
    };
  }, [filteredDeliveries]);

  const driverStats = useMemo(() => {
    const rows = drivers.map((driver) => {
      const driverId = String(driver._id || driver.id || "");

      const driverDeliveries = filteredDeliveries.filter((delivery) => {
        const assignedId =
          delivery.assignedDriverId?._id ||
          delivery.assignedDriverId ||
          delivery.driver?._id ||
          delivery.driver ||
          "";

        return String(assignedId) === driverId;
      });

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

      const lastActivitySource = driverDeliveries
        .slice()
        .sort((a, b) => {
          const timeA = new Date(
            a.finishedAt || a.startedAt || a.createdAt || 0
          ).getTime();
          const timeB = new Date(
            b.finishedAt || b.startedAt || b.createdAt || 0
          ).getTime();
          return timeB - timeA;
        })[0];

      const lastActivity =
        lastActivitySource?.finishedAt ||
        lastActivitySource?.startedAt ||
        lastActivitySource?.createdAt ||
        null;

      return {
        ...driver,
        driverId,
        total,
        pending,
        inProgress,
        finished,
        completionRate,
        lastActivity,
      };
    });

    return rows.sort((a, b) => {
      if (b.finished !== a.finished) return b.finished - a.finished;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [drivers, filteredDeliveries]);

  const topDriver = useMemo(() => {
    if (!driverStats.length) return null;
    return driverStats.find((driver) => driver.total > 0) || null;
  }, [driverStats]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estadísticas de entregas</h1>
            <p className="text-sm text-blue-100 mt-1">
              Resumen general y rendimiento detallado por conductor
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

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Vista general</h2>
            {topDriver ? (
              <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold">
                Mejor conductor del período: {topDriver.name} · {topDriver.finished} finalizadas
              </div>
            ) : (
              <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold">
                Sin conductor destacado aún
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 border">
              <p className="text-sm text-gray-500">Total entregas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {generalStats.total}
              </p>
            </div>

            <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">
                {generalStats.pending}
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm text-gray-500">En curso</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {generalStats.inProgress}
              </p>
            </div>

            <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
              <p className="text-sm text-gray-500">Finalizadas</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {generalStats.finished}
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <p className="text-sm text-gray-500">% cumplimiento</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {generalStats.completionRate}%
              </p>
            </div>

            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-sm text-gray-500">Conductores activos</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">
                {generalStats.activeDriversCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Estadísticas por conductor
            </h2>
            <div className="text-sm text-gray-500">
              {driverStats.filter((d) => d.total > 0).length} con movimiento en el período
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando estadísticas...</p>
          ) : driverStats.length === 0 ? (
            <p className="text-gray-500">No hay conductores registrados.</p>
          ) : (
            <div className="space-y-4">
              {driverStats.map((driver, index) => {
                const hasData = driver.total > 0;

                return (
                  <div
                    key={driver._id || driver.id}
                    className={`rounded-2xl p-4 border ${
                      hasData ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-lg font-bold text-gray-900">
                            {index + 1}. {driver.name}
                          </p>

                          {hasData ? (
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              Con movimiento
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                              Sin movimiento
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-500 mt-1">
                          CC {driver.cedula} · {driver.vehicle || "Sin vehículo"} ·{" "}
                          {driver.plate || "Sin placa"}
                        </p>

                        <p className="text-sm text-gray-600 mt-1">
                          Estado actual:{" "}
                          <span className="font-semibold text-gray-800">
                            {driver.status || "Disponible"}
                          </span>
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Última actividad:{" "}
                          {driver.lastActivity
                            ? new Date(driver.lastActivity).toLocaleString()
                            : "Sin actividad en este período"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full lg:w-auto">
                        <div className="bg-white rounded-xl p-3 min-w-[110px]">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-lg font-bold text-gray-900 mt-1">
                            {driver.total}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3 min-w-[110px]">
                          <p className="text-xs text-gray-500">Pendientes</p>
                          <p className="text-lg font-bold text-yellow-600 mt-1">
                            {driver.pending}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3 min-w-[110px]">
                          <p className="text-xs text-gray-500">En curso</p>
                          <p className="text-lg font-bold text-blue-600 mt-1">
                            {driver.inProgress}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3 min-w-[110px]">
                          <p className="text-xs text-gray-500">Finalizadas</p>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            {driver.finished}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3 min-w-[110px]">
                          <p className="text-xs text-gray-500">% Cumplimiento</p>
                          <p className="text-lg font-bold text-purple-600 mt-1">
                            {driver.completionRate}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {hasData ? (
                      <div className="mt-4">
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${Math.min(
                                Number(driver.completionRate) || 0,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDeliveryStats;
