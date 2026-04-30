import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #9333EA, #D946EF)";
const DARK_PURPLE_GRADIENT =
  "linear-gradient(135deg, #1E103B, #3B0764, #6D28D9)";
const SOFT_PURPLE = "linear-gradient(135deg, #F5F3FF, #FAE8FF)";

const EnterpriseDashboard = () => {
  const [driversCount, setDriversCount] = useState(0);
  const [deliveriesInProgress, setDeliveriesInProgress] = useState(0);
  const [deliveriesFinishedToday, setDeliveriesFinishedToday] = useState(0);
  const [pendingSmartRoutes, setPendingSmartRoutes] = useState(0);
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

      const pendingRoutes = deliveries.filter((delivery) => {
        const assignedDriverId =
          delivery?.assignedDriverId?._id ||
          delivery?.assignedDriverId ||
          delivery?.driver?._id ||
          delivery?.driver ||
          "";

        return (
          delivery?.status === "Pendiente" &&
          delivery?.optimizationStatus === "pending" &&
          !assignedDriverId
        );
      }).length;

      setDeliveriesInProgress(inProgress);
      setDeliveriesFinishedToday(finishedToday);
      setPendingSmartRoutes(pendingRoutes);
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
      subtitle: "Equipo disponible en la operación",
      accent: "from-violet-600 via-purple-600 to-fuchsia-500",
    },
    {
      title: "Entregas en curso",
      value: loading ? "..." : deliveriesInProgress,
      icon: "📍",
      subtitle: "Operaciones activas en tiempo real",
      accent: "from-purple-700 via-violet-600 to-indigo-500",
    },
    {
      title: "Finalizadas hoy",
      value: loading ? "..." : deliveriesFinishedToday,
      icon: "✅",
      subtitle: "Entregas cerradas durante el día",
      accent: "from-fuchsia-600 via-purple-600 to-violet-500",
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
      accent: "from-violet-600 to-purple-600",
    },
    {
      to: "/enterprise-logistics",
      title: "Panel de logística",
      description:
        "Crea entregas, asigna conductores y organiza la operación.",
      icon: "📦",
      badge: "Operación",
      accent: "from-purple-600 to-fuchsia-600",
    },
    {
      to: "/enterprise-logistics#rutas-inteligentes",
      title: "Rutas inteligentes",
      description:
        pendingSmartRoutes > 0
          ? `Tienes ${pendingSmartRoutes} pedido${
              pendingSmartRoutes === 1 ? "" : "s"
            } pendiente${
              pendingSmartRoutes === 1 ? "" : "s"
            } para organizar por cercanía.`
          : "Organiza pedidos pendientes por cercanía, optimiza recorridos y asigna rutas completas a conductores.",
      icon: "🧠",
      badge:
        pendingSmartRoutes > 0
          ? `${pendingSmartRoutes} pendientes`
          : "Inteligencia",
      accent: "from-indigo-600 to-purple-600",
    },
    {
      to: "/enterprise-clients",
      title: "Base de datos de clientes",
      description:
        "Crea, edita y consulta clientes en línea desde cualquier dispositivo. Selecciona un cliente y autollena las nuevas entregas.",
      icon: "👥",
      badge: "Clientes",
      accent: "from-fuchsia-600 to-pink-500",
    },
    {
      to: "/enterprise-delivery-stats",
      title: "Estadísticas de entregas",
      description:
        "Consulta el rendimiento por día o por mes y analiza el desempeño general.",
      icon: "📊",
      badge: "Analítica",
      accent: "from-purple-700 to-violet-500",
    },
    {
      to: "/enterprise-delivery-history",
      title: "Historial de entregas",
      description: "Busca entregas por factura, cliente, conductor o fecha.",
      icon: "🗂️",
      badge: "Historial",
      accent: "from-violet-700 to-fuchsia-500",
    },
  ];

  const enterpriseName = "Tu Empresa";

  return (
    <div className="min-h-screen bg-[#F8F5FF]">
      <div
        className="relative overflow-hidden border-b border-purple-200 text-white"
        style={{ background: DARK_PURPLE_GRADIENT }}
      >
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-16 -left-10 h-52 w-52 rounded-full bg-fuchsia-400 blur-3xl" />
          <div className="absolute top-10 right-0 h-64 w-64 rounded-full bg-violet-400 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-48 w-48 rounded-full bg-purple-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-purple-100 backdrop-blur">
                <span>🏢</span>
                <span>Central Go Empresas</span>
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
                Bienvenido
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
                {enterpriseName}
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-purple-100 md:text-base">
                Administra conductores, supervisa entregas, controla clientes y
                gestiona toda la operación logística desde un entorno moderno,
                claro y profesional.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white px-5 py-3 font-semibold text-purple-800 shadow-lg transition duration-200 hover:scale-[1.03] hover:shadow-2xl"
              >
                Salir
              </Link>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            {statCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-3xl border border-white/20 bg-gradient-to-br ${card.accent} p-5 text-white shadow-[0_18px_45px_rgba(88,28,135,0.28)] backdrop-blur`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      {card.title}
                    </p>
                    <p className="mt-3 text-4xl font-extrabold">
                      {card.value}
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      {card.subtitle}
                    </p>
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
        {pendingSmartRoutes > 0 ? (
          <Link
            to="/enterprise-logistics#rutas-inteligentes"
            className="mb-6 block rounded-[28px] border border-purple-200 bg-white p-5 shadow-[0_14px_40px_rgba(126,34,206,0.14)] transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(126,34,206,0.2)]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-purple-700">
                  🧠 Rutas inteligentes pendientes
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Tienes {pendingSmartRoutes} pedido
                  {pendingSmartRoutes === 1
                    ? ""
                    : "s"} esperando organización de ruta
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Entra al panel de logística para optimizar por cercanía y
                  asignar la ruta completa a un conductor.
                </p>
              </div>

              <div
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg"
                style={{ background: PURPLE_GRADIENT }}
              >
                Abrir rutas inteligentes →
              </div>
            </div>
          </Link>
        ) : null}

        <div className="mb-6 rounded-[28px] border border-purple-100 bg-white p-6 shadow-[0_12px_40px_rgba(88,28,135,0.08)]">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Centro de control
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Accede rápidamente a los módulos principales del sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className="group relative overflow-hidden rounded-[30px] border border-purple-100 bg-white p-6 shadow-[0_10px_30px_rgba(88,28,135,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(88,28,135,0.15)]"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${module.accent}`}
              />

              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-purple-100 opacity-70 transition group-hover:scale-125" />

              <div className="relative flex items-start justify-between gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${module.accent} text-3xl text-white shadow-lg transition duration-300 group-hover:scale-110`}
                >
                  {module.icon}
                </div>

                <div className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 transition group-hover:bg-purple-700 group-hover:text-white">
                  {module.badge}
                </div>
              </div>

              <div className="relative mt-5">
                <h3 className="text-xl font-extrabold text-slate-900 transition group-hover:text-purple-700">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {module.description}
                </p>
              </div>

              <div className="relative mt-6 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition group-hover:bg-purple-700 group-hover:text-white">
                  Abrir módulo
                  <span className="transition duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition duration-300 group-hover:bg-slate-900 group-hover:text-white">
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