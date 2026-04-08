import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseDeliveryHistory = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [searchDriver, setSearchDriver] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchStatus, setSearchStatus] = useState("");

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

  const hasActiveFilters = useMemo(() => {
    return (
      searchInvoice.trim() !== "" ||
      searchClient.trim() !== "" ||
      searchDriver.trim() !== "" ||
      searchDate.trim() !== "" ||
      searchStatus.trim() !== ""
    );
  }, [searchInvoice, searchClient, searchDriver, searchDate, searchStatus]);

  const filteredDeliveries = useMemo(() => {
    if (!hasActiveFilters) return [];

    return deliveries.filter((delivery) => {
      const invoiceMatch = String(delivery.invoiceNumber || "")
        .toLowerCase()
        .includes(searchInvoice.toLowerCase());

      const clientMatch = String(delivery.clientName || "")
        .toLowerCase()
        .includes(searchClient.toLowerCase());

      const driverMatch = String(delivery.assignedDriverName || "")
        .toLowerCase()
        .includes(searchDriver.toLowerCase());

      const statusMatch = searchStatus
        ? String(delivery.status || "") === searchStatus
        : true;

      const baseDate =
        delivery.finishedAt ||
        delivery.startedAt ||
        delivery.createdAt ||
        "";

      const dateMatch = searchDate
        ? String(baseDate).startsWith(searchDate)
        : true;

      return (
        invoiceMatch &&
        clientMatch &&
        driverMatch &&
        statusMatch &&
        dateMatch
      );
    });
  }, [
    deliveries,
    searchInvoice,
    searchClient,
    searchDriver,
    searchDate,
    searchStatus,
    hasActiveFilters,
  ]);

  const totalResults = filteredDeliveries.length;

  const clearFilters = () => {
    setSearchInvoice("");
    setSearchClient("");
    setSearchDriver("");
    setSearchDate("");
    setSearchStatus("");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Historial de entregas</h1>
            <p className="text-sm text-blue-100 mt-1">
              Consulta y busca entregas por factura, cliente, conductor o fecha
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
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Filtros de búsqueda
            </h2>

            <button
              type="button"
              onClick={clearFilters}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl font-semibold"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Buscar por factura"
              value={searchInvoice}
              onChange={(e) => setSearchInvoice(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Buscar por cliente"
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Buscar por conductor"
              value={searchDriver}
              onChange={(e) => setSearchDriver(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En curso">En curso</option>
              <option value="Finalizada">Finalizada</option>
            </select>
          </div>

          <div className="mt-4 bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-blue-700 font-semibold">
              {hasActiveFilters
                ? `Resultados encontrados: ${totalResults}`
                : "Usa los filtros para buscar entregas específicas."}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Resultados del historial
          </h2>

          {!hasActiveFilters ? (
            <p className="text-gray-500">
              Aún no has realizado ninguna búsqueda.
            </p>
          ) : filteredDeliveries.length === 0 ? (
            <p className="text-gray-500">
              No se encontraron entregas con esos filtros.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredDeliveries
                .slice()
                .sort((a, b) => {
                  const timeA = new Date(
                    a.finishedAt || a.startedAt || a.createdAt || 0
                  ).getTime();
                  const timeB = new Date(
                    b.finishedAt || b.startedAt || b.createdAt || 0
                  ).getTime();
                  return timeB - timeA;
                })
                .map((delivery) => {
                  const assignedDriver = drivers.find(
                    (driver) =>
                      String(driver.id) === String(delivery.assignedDriverId)
                  );

                  return (
                    <div
                      key={delivery.id}
                      className="border rounded-2xl p-4 bg-gray-50"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-gray-900">
                            Factura #{delivery.invoiceNumber}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Cliente: {delivery.clientName}
                          </p>
                          <p className="text-sm text-gray-600">
                            Dirección: {delivery.address}
                          </p>
                          <p className="text-sm text-gray-600">
                            Teléfono: {delivery.clientPhone}
                          </p>
                        </div>

                        <div>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                              delivery.status === "Finalizada"
                                ? "bg-green-100 text-green-700"
                                : delivery.status === "En curso"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {delivery.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Conductor asignado
                          </p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {delivery.assignedDriverName || "Sin asignar"}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Vehículo</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {assignedDriver?.vehicle || "No registrado"}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Placa</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {assignedDriver?.plate || "No registrada"}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Creación</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {delivery.createdAt
                              ? new Date(delivery.createdAt).toLocaleString()
                              : "Sin registro"}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Inicio</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {delivery.startedAt
                              ? new Date(delivery.startedAt).toLocaleString()
                              : "Sin iniciar"}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Finalización</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            {delivery.finishedAt
                              ? new Date(delivery.finishedAt).toLocaleString()
                              : "Aún no finaliza"}
                          </p>
                        </div>
                      </div>

                      {delivery.notes ? (
                        <div className="mt-4 bg-white rounded-xl p-3">
                          <p className="text-xs text-gray-500">Observaciones</p>
                          <p className="text-sm text-gray-700 mt-1">
                            {delivery.notes}
                          </p>
                        </div>
                      ) : null}

                      {delivery.placeId ? (
                        <p className="text-xs text-gray-400 mt-3">
                          placeId: {delivery.placeId}
                        </p>
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

export default EnterpriseDeliveryHistory;
