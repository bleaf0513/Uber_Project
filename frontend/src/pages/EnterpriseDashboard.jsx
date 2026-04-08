import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const EnterpriseDashboard = () => {
  const [driversCount, setDriversCount] = useState(0);
  const [deliveriesInProgress, setDeliveriesInProgress] = useState(0);
  const [deliveriesFinishedToday, setDeliveriesFinishedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const parseJsonSafe = async (response, label = "API") => {
    const text = await response.text();
    console.log(`${label} raw response:`, text);

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON. Revisa VITE_BASE_URL o la ruta backend. Respuesta: ${text.slice(
          0,
          150
        )}`
      );
    }
  };

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

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

      const driversData = await parseJsonSafe(
        driversResponse,
        "GET /enterprise-drivers"
      );
      const deliveriesData = await parseJsonSafe(
        deliveriesResponse,
        "GET /enterprise-deliveries"
      );

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

      const drivers = Array.isArray(driversData.drivers)
        ? driversData.drivers
        : [];

      const deliveries = Array.isArray(deliveriesData.deliveries)
        ? deliveriesData.deliveries
        : [];

      setDriversCount(drivers.length);

      const inProgress = deliveries.filter(
        (delivery) => delivery.status === "En curso"
      ).length;

      const today = new Date().toISOString().split("T")[0];

      const finishedToday = deliveries.filter((delivery) => {
        const finishedAt = delivery.finishedAt || delivery.updatedAt || "";
        return (
          delivery.status === "Finalizada" &&
          String(finishedAt).startsWith(today)
        );
      }).length;

      setDeliveriesInProgress(inProgress);
      setDeliveriesFinishedToday(finishedToday);
    } catch (error) {
      console.error("Error cargando estadísticas empresariales:", error);
      alert(error.message || "Error cargando estadísticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    const interval = setInterval(() => {
      loadStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Central Go Empresas</h1>
            <p className="text-sm text-blue-100 mt-1">
              Panel principal de operación empresarial
            </p>
          </div>

          <Link
            to="/"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Salir
          </Link>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Conductores activos
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">
            {loading ? "..." : driversCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Entregas en curso
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">
            {loading ? "..." : deliveriesInProgress}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Finalizadas hoy
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">
            {loading ? "..." : deliveriesFinishedToday}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/enterprise-drivers"
          className="bg-white rounded-2xl shadow p-5 block hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold text-gray-900">
            Conductores empresariales
          </h2>
          <p className="text-gray-600 mt-2">
            Registra, consulta y administra los conductores de tu empresa.
          </p>
        </Link>

        <Link
          to="/enterprise-logistics"
          className="bg-white rounded-2xl shadow p-5 block hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold text-gray-900">
            Panel de logística
          </h2>
          <p className="text-gray-600 mt-2">
            Crea entregas, asigna conductores y organiza la operación.
          </p>
        </Link>

        <Link
          to="/enterprise-delivery-stats"
          className="bg-white rounded-2xl shadow p-5 block hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold text-gray-900">
            Estadísticas de entregas
          </h2>
          <p className="text-gray-600 mt-2">
            Consulta el rendimiento de las entregas por día o por mes y analiza
            el desempeño general de los conductores.
          </p>
        </Link>

        <Link
          to="/enterprise-delivery-history"
          className="bg-white rounded-2xl shadow p-5 block hover:shadow-lg transition"
        >
          <h2 className="text-xl font-bold text-gray-900">
            Historial de entregas
          </h2>
          <p className="text-gray-600 mt-2">
            Busca entregas por factura, cliente, conductor o fecha y revisa todo
            el historial operativo.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default EnterpriseDashboard;
