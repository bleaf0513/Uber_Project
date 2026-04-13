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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const getDriverId = (delivery) =>
    String(
      delivery?.assignedDriverId?._id ||
        delivery?.assignedDriverId ||
        delivery?.driver?._id ||
        delivery?.driver ||
        ""
    );

  const getBaseDate = (delivery) =>
    delivery?.finishedAt || delivery?.startedAt || delivery?.createdAt || "";

  const isMissingInvoiceValue = (delivery) => {
    const raw = delivery?.invoiceValue;
    return raw === "" || raw === null || raw === undefined || Number(raw) <= 0;
  };

  const isCashPayment = (delivery) => {
    const method = String(delivery?.paymentMethod || "").trim().toLowerCase();
    return method.includes("efectivo");
  };

  const isTransferPayment = (delivery) => {
    const method = String(delivery?.paymentMethod || "").trim().toLowerCase();
    return method.includes("transfer");
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
      const baseDate = getBaseDate(delivery);
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

  const finalizedDeliveries = useMemo(() => {
    return filteredDeliveries.filter(
      (delivery) => String(delivery?.status || "") === "Finalizada"
    );
  }, [filteredDeliveries]);

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
      filteredDeliveries.map((delivery) => getDriverId(delivery)).filter(Boolean)
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

  const paymentStats = useMemo(() => {
    const deliveredInvoices = finalizedDeliveries.length;

    const cashTotal = finalizedDeliveries.reduce((acc, delivery) => {
      if (!isCashPayment(delivery) || isMissingInvoiceValue(delivery)) return acc;
      return acc + Number(delivery.invoiceValue || 0);
    }, 0);

    const transferTotal = finalizedDeliveries.reduce((acc, delivery) => {
      if (!isTransferPayment(delivery) || isMissingInvoiceValue(delivery)) return acc;
      return acc + Number(delivery.invoiceValue || 0);
    }, 0);

    const missingValueCount = finalizedDeliveries.filter((delivery) =>
      isMissingInvoiceValue(delivery)
    ).length;

    const missingValueDeliveries = finalizedDeliveries.filter((delivery) =>
      isMissingInvoiceValue(delivery)
    );

    return {
      deliveredInvoices,
      cashTotal,
      transferTotal,
      missingValueCount,
      missingValueDeliveries,
    };
  }, [finalizedDeliveries]);

  const driverStats = useMemo(() => {
    const rows = drivers.map((driver) => {
      const driverId = String(driver._id || driver.id || "");

      const driverDeliveries = filteredDeliveries.filter((delivery) => {
        return getDriverId(delivery) === driverId;
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

      const finalized = driverDeliveries.filter(
        (d) => String(d?.status || "") === "Finalizada"
      );

      const deliveredInvoices = finalized.length;

      const cashTotal = finalized.reduce((acc, delivery) => {
        if (!isCashPayment(delivery) || isMissingInvoiceValue(delivery)) return acc;
        return acc + Number(delivery.invoiceValue || 0);
      }, 0);

      const transferTotal = finalized.reduce((acc, delivery) => {
        if (!isTransferPayment(delivery) || isMissingInvoiceValue(delivery)) return acc;
        return acc + Number(delivery.invoiceValue || 0);
      }, 0);

      const missingValueCount = finalized.filter((delivery) =>
        isMissingInvoiceValue(delivery)
      ).length;

      const missingValueInvoices = finalized
        .filter((delivery) => isMissingInvoiceValue(delivery))
        .map((delivery) => delivery.invoiceNumber)
        .filter(Boolean);

      const liquidationTotal = cashTotal + transferTotal;

      const lastActivitySource = driverDeliveries
        .slice()
        .sort((a, b) => {
          const timeA = new Date(getBaseDate(a) || 0).getTime();
          const timeB = new Date(getBaseDate(b) || 0).getTime();
          return timeB - timeA;
        })[0];

      const lastActivity = getBaseDate(lastActivitySource) || null;

      return {
        ...driver,
        driverId,
        total,
        pending,
        inProgress,
        finished,
        completionRate,
        lastActivity,
        deliveredInvoices,
        cashTotal,
        transferTotal,
        missingValueCount,
        missingValueInvoices,
        liquidationTotal,
      };
    });

    return rows.sort((a, b) => {
      if (b.finished !== a.finished) return b.finished - a.finished;
      if (b.liquidationTotal !== a.liquidationTotal) {
        return b.liquidationTotal - a.liquidationTotal;
      }
      if (b.total !== a.total) return b.total - a.total;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [drivers, filteredDeliveries]);

  const topDriver = useMemo(() => {
    if (!driverStats.length) return null;
    return driverStats.find((driver) => driver.total > 0) || null;
  }, [driverStats]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 text-white px-6 py-6 shadow-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Estadísticas de entregas
            </h1>
            <p className="text-sm text-blue-100 mt-1">
              Resumen operativo, liquidación y rendimiento detallado por conductor
            </p>
          </div>

          <Link
            to="/enterprise-dashboard"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold shadow"
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 mb-5">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Filtros de consulta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full bg-slate-50 rounded-2xl px-4 py-3 outline-none border border-slate-200"
            >
              <option value="day">Ver por día</option>
              <option value="month">Ver por mes</option>
            </select>

            {viewMode === "day" ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 outline-none border border-slate-200"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 outline-none border border-slate-200"
              />
            )}

            <div className="bg-blue-50 rounded-2xl px-4 py-3 flex items-center border border-blue-100">
              <p className="text-sm text-blue-700 font-semibold">
                {viewMode === "day"
                  ? `Consultando el día: ${selectedDate}`
                  : `Consultando el mes: ${selectedMonth}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Vista general</h2>

            {topDriver ? (
              <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-sm font-semibold border border-emerald-100">
                Mejor conductor del período: {topDriver.name} · {topDriver.finished} finalizadas
              </div>
            ) : (
              <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-2xl text-sm font-semibold">
                Sin conductor destacado aún
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Total entregas</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {generalStats.total}
              </p>
            </div>

            <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
              <p className="text-sm text-slate-500">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">
                {generalStats.pending}
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm text-slate-500">En curso</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {generalStats.inProgress}
              </p>
            </div>

            <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
              <p className="text-sm text-slate-500">Finalizadas</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {generalStats.finished}
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <p className="text-sm text-slate-500">% cumplimiento</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {generalStats.completionRate}%
              </p>
            </div>

            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-sm text-slate-500">Conductores activos</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">
                {generalStats.activeDriversCount}
              </p>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <p className="text-sm text-slate-500">Facturas entregadas</p>
              <p className="text-2xl font-bold text-emerald-700 mt-2">
                {paymentStats.deliveredInvoices}
              </p>
            </div>

            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
              <p className="text-sm text-slate-500">Sin valor</p>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {paymentStats.missingValueCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-700 font-semibold">
                Total en efectivo
              </p>
              <p className="text-2xl font-bold text-emerald-800 mt-2">
                {formatCurrency(paymentStats.cashTotal)}
              </p>
              <p className="text-xs text-emerald-700/80 mt-2">
                Valor correspondiente a facturas finalizadas pagadas en efectivo
              </p>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
              <p className="text-sm text-sky-700 font-semibold">
                Total por transferencia
              </p>
              <p className="text-2xl font-bold text-sky-800 mt-2">
                {formatCurrency(paymentStats.transferTotal)}
              </p>
              <p className="text-xs text-sky-700/80 mt-2">
                Valor correspondiente a facturas finalizadas pagadas por transferencia
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <p className="text-sm text-amber-700 font-semibold">
                Validación pendiente de logística
              </p>
              <p className="text-2xl font-bold text-amber-800 mt-2">
                {paymentStats.missingValueCount} factura
                {paymentStats.missingValueCount === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-amber-700/80 mt-2">
                Estas entregas fueron finalizadas pero no tienen valor registrado
              </p>
            </div>
          </div>

          {paymentStats.missingValueCount > 0 ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-700 mb-2">
                Facturas finalizadas sin valor registrado
              </p>
              <div className="flex flex-wrap gap-2">
                {paymentStats.missingValueDeliveries.map((delivery) => (
                  <span
                    key={delivery._id || delivery.id}
                    className="px-3 py-1 rounded-full bg-white border border-rose-200 text-rose-700 text-xs font-semibold"
                  >
                    Factura #{delivery.invoiceNumber || "Sin número"} ·{" "}
                    {delivery.clientName || "Cliente"}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Liquidación y estadísticas por conductor
            </h2>
            <div className="text-sm text-slate-500">
              {driverStats.filter((d) => d.total > 0).length} con movimiento en el período
            </div>
          </div>

          {loading ? (
            <p className="text-slate-500">Cargando estadísticas...</p>
          ) : driverStats.length === 0 ? (
            <p className="text-slate-500">No hay conductores registrados.</p>
          ) : (
            <div className="space-y-4">
              {driverStats.map((driver, index) => {
                const hasData = driver.total > 0;

                return (
                  <div
                    key={driver._id || driver.id}
                    className={`rounded-3xl p-5 border transition-all ${
                      hasData
                        ? "bg-slate-50 border-slate-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                      <div className="xl:w-[320px]">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-lg font-bold text-slate-900">
                            {index + 1}. {driver.name}
                          </p>

                          {hasData ? (
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              Con movimiento
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                              Sin movimiento
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-500 mt-1">
                          CC {driver.cedula} · {driver.vehicle || "Sin vehículo"} ·{" "}
                          {driver.plate || "Sin placa"}
                        </p>

                        <p className="text-sm text-slate-600 mt-1">
                          Estado actual:{" "}
                          <span className="font-semibold text-slate-800">
                            {driver.status || "Disponible"}
                          </span>
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          Última actividad:{" "}
                          {driver.lastActivity
                            ? new Date(driver.lastActivity).toLocaleString()
                            : "Sin actividad en este período"}
                        </p>
                      </div>

                      <div className="flex-1">
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                          <div className="bg-white rounded-2xl p-3 border border-slate-200">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="text-lg font-bold text-slate-900 mt-1">
                              {driver.total}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-yellow-100">
                            <p className="text-xs text-slate-500">Pendientes</p>
                            <p className="text-lg font-bold text-yellow-600 mt-1">
                              {driver.pending}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-blue-100">
                            <p className="text-xs text-slate-500">En curso</p>
                            <p className="text-lg font-bold text-blue-600 mt-1">
                              {driver.inProgress}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-green-100">
                            <p className="text-xs text-slate-500">Finalizadas</p>
                            <p className="text-lg font-bold text-green-600 mt-1">
                              {driver.finished}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-emerald-100">
                            <p className="text-xs text-slate-500">Facturas</p>
                            <p className="text-lg font-bold text-emerald-700 mt-1">
                              {driver.deliveredInvoices}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-purple-100">
                            <p className="text-xs text-slate-500">% Cumplimiento</p>
                            <p className="text-lg font-bold text-purple-600 mt-1">
                              {driver.completionRate}%
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-amber-100">
                            <p className="text-xs text-slate-500">Sin valor</p>
                            <p className="text-lg font-bold text-amber-600 mt-1">
                              {driver.missingValueCount}
                            </p>
                          </div>

                          <div className="bg-white rounded-2xl p-3 border border-slate-200">
                            <p className="text-xs text-slate-500">Liquidación</p>
                            <p className="text-base font-bold text-slate-900 mt-1">
                              {formatCurrency(driver.liquidationTotal)}
                            </p>
                          </div>
                        </div>

                        {hasData ? (
                          <>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                <p className="text-xs font-semibold text-emerald-700">
                                  Efectivo a entregar
                                </p>
                                <p className="text-xl font-bold text-emerald-800 mt-2">
                                  {formatCurrency(driver.cashTotal)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                                <p className="text-xs font-semibold text-sky-700">
                                  Transferencia
                                </p>
                                <p className="text-xl font-bold text-sky-800 mt-2">
                                  {formatCurrency(driver.transferTotal)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                                <p className="text-xs font-semibold text-rose-700">
                                  Facturas por validar valor
                                </p>
                                <p className="text-xl font-bold text-rose-800 mt-2">
                                  {driver.missingValueCount}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
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

                            {driver.missingValueInvoices.length > 0 ? (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-xs font-bold text-amber-700 mb-2">
                                  Facturas de este conductor sin valor registrado
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {driver.missingValueInvoices.map((invoice, idx) => (
                                    <span
                                      key={`${driver.driverId}-${invoice}-${idx}`}
                                      className="px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700 text-xs font-semibold"
                                    >
                                      #{invoice}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
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
