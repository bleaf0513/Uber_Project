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
          cache: "no-store",
        }),
        fetch(`${API_BASE}/enterprise-deliveries`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
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

  const statCards = [
    {
      title: "Conductores activos",
      value: loading ? "..." : driversCount,
      icon: "🚚",
      tone:
        "from-blue-600 to-cyan-500 text-white shadow-blue-200 border-blue-400/20",
      subtitle: "Equipo disponible en la operación",
    },
    {
      title: "Entregas en curso",
      value: loading ? "..." : deliveriesInProgress,
      icon: "📍",
      tone:
        "from-amber-500 to-orange-500 text-white shadow-orange-200 border-orange-400/20",
      subtitle: "Operaciones activas en tiempo real",
    },
    {
      title: "Finalizadas hoy",
      value: loading ? "..." : deliveriesFinishedToday,
      icon: "✅",
      tone:
        "from-emerald-500 to-green-500 text-white shadow-emerald-200 border-emerald-400/20",
      subtitle: "Entregas cerradas durante el día",
    },
  ];

  const modules = [
    {
      to: "/enterprise-drivers",
      title: "Conductores empresariales",
      description:
        "Registra, consulta y administra los conductores de tu empresa.",
      icon: "👨‍✈️",
      badge: "Gestión",
      accent: "from-blue-500 to-cyan-500",
    },
    {
      to: "/enterprise-logistics",
      title: "Panel de logística",
      description:
        "Crea entregas, asigna conductores y organiza la operación.",
      icon: "📦",
      badge: "Operación",
      accent: "from-violet-500 to-indigo-500",
    },
    {
      to: "/enterprise-delivery-stats",
      title: "Estadísticas de entregas",
      description:
        "Consulta el rendimiento por día o por mes y analiza el desempeño general.",
      icon: "📊",
      badge: "Analítica",
      accent: "from-emerald-500 to-green-500",
    },
    {
      to: "/enterprise-delivery-history",
      title: "Historial de entregas",
      description:
        "Busca entregas por factura, cliente, conductor o fecha.",
      icon: "🗂️",
      badge: "Historial",
      accent: "from-amber-500 to-orange-500",
    },
  ];

  const enterpriseName = "Tu Empresa";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-blue-900 to-blue-700 text-white">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute top-8 right-0 h-56 w-56 rounded-full bg-indigo-400 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur">
                <span>🏢</span>
                <span>Central Go Empresas</span>
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                Bienvenido
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
                {enterpriseName}
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-blue-100 md:text-base">
                Administra conductores, supervisa entregas y controla toda la
                operación logística desde un entorno profesional, claro y moderno.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-blue-800 shadow-lg transition duration-200 hover:scale-[1.03] hover:shadow-2xl"
              >
                Salir
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            {statCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-3xl border bg-gradient-to-br p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur ${card.tone}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      {card.title}
                    </p>
                    <p className="mt-3 text-4xl font-extrabold">{card.value}</p>
                    <p className="mt-2 text-sm text-white/80">{card.subtitle}</p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner">
                    {card.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Centro de control
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Accede rápidamente a los módulos principales del sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="group relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${module.accent}`} />

              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${module.accent} text-3xl text-white shadow-lg transition duration-300 group-hover:scale-110`}>
                  {module.icon}
                </div>

                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                  {module.badge}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="text-xl font-extrabold text-slate-900 transition group-hover:text-blue-700">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {module.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                  Abrir módulo
                  <span className="transition duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </div>

                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 transition duration-300 group-hover:bg-slate-900 group-hover:text-white">
                  ↗
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDashboard;
