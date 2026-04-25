import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const formatCOP = (value) => {
  const numeric = Number(value || 0);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleString();
};

const getVehicleTypeLabel = (value) => {
  const labels = {
    motorcycle: "Moto",
    car: "Carro",
    light_cargo: "Carga liviana",
    van: "Furgón / camioneta",
    truck: "Camión",
  };

  return labels[value] || value || "Sin tipo";
};

const getApplicationStatusLabel = (status) => {
  const labels = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
  };

  return labels[status] || status || "Sin estado";
};

const getApplicationStatusClass = (status) => {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700 border border-red-200";
  }

  return "bg-amber-100 text-amber-700 border border-amber-200";
};

const StatCard = ({ title, value, subtitle }) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
};

const ModuleCard = ({ title, description, children }) => {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {children}
    </div>
  );
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [driverApplications, setDriverApplications] = useState([]);
  const [applicationFilter, setApplicationFilter] = useState("pending");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");

  const token = useMemo(() => {
    return localStorage.getItem("superAdminToken") || "";
  }, []);

  const getHeaders = () => {
    const currentToken = localStorage.getItem("superAdminToken") || "";

    const headers = {
      "Content-Type": "application/json",
    };

    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    return headers;
  };

  const parseJsonSafe = async (response) => {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Respuesta inválida del backend: ${text}`);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminData");
    navigate("/centralgo-admin-root");
  };

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`${API_BASE}/super-admin/dashboard`, {
        method: "GET",
        headers: getHeaders(),
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el dashboard.");
      }

      setDashboard(data);
    } catch (error) {
      console.error("Error cargando dashboard Super Admin:", error);

      const message = String(error.message || "").toLowerCase();

      if (
        message.includes("token") ||
        message.includes("sesión") ||
        message.includes("no autorizado") ||
        message.includes("inválida")
      ) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDriverApplications = async ({
    status = applicationFilter,
    silent = false,
  } = {}) => {
    try {
      if (!silent) {
        setApplicationsLoading(true);
      }

      const response = await fetch(
        `${API_BASE}/super-admin/driver-applications?status=${encodeURIComponent(
          status
        )}`,
        {
          method: "GET",
          headers: getHeaders(),
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar las solicitudes.");
      }

      setDriverApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (error) {
      console.error("Error cargando solicitudes de conductores:", error);

      const message = String(error.message || "").toLowerCase();

      if (
        message.includes("token") ||
        message.includes("sesión") ||
        message.includes("no autorizado") ||
        message.includes("inválida")
      ) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudieron cargar las solicitudes.");
    } finally {
      setApplicationsLoading(false);
    }
  };

  const loadMe = async () => {
    try {
      const response = await fetch(`${API_BASE}/super-admin/me`, {
        method: "GET",
        headers: getHeaders(),
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "Sesión inválida.");
      }

      setAdmin(data.admin);
      localStorage.setItem("superAdminData", JSON.stringify(data.admin || {}));
    } catch (error) {
      console.error("Error validando Super Admin:", error);
      handleUnauthorized();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/super-admin/logout`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
      });
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    }

    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminData");

    navigate("/centralgo-admin-root");
  };

  const handleChangeApplicationFilter = async (status) => {
    setApplicationFilter(status);
    await loadDriverApplications({ status, silent: false });
  };

  const openDocument = (imageData) => {
    if (!imageData) {
      alert("No hay documento disponible.");
      return;
    }

    const win = window.open("", "_blank");

    if (!win) {
      alert("El navegador bloqueó la ventana emergente. Permite popups para ver el documento.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Documento conductor - Central Go</title>
          <style>
            body {
              margin: 0;
              background: #0f172a;
              color: white;
              font-family: Arial, sans-serif;
              display: flex;
              min-height: 100vh;
              align-items: center;
              justify-content: center;
              padding: 24px;
              box-sizing: border-box;
            }
            .wrap {
              width: 100%;
              max-width: 1100px;
              text-align: center;
            }
            img {
              max-width: 100%;
              max-height: 88vh;
              border-radius: 18px;
              box-shadow: 0 20px 60px rgba(0,0,0,.45);
              background: white;
            }
            p {
              color: #cbd5e1;
              margin-bottom: 18px;
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            <p>Documento cargado por el conductor</p>
            <img src="${imageData}" alt="Documento conductor" />
          </div>
        </body>
      </html>
    `);

    win.document.close();
  };

  const approveApplication = async (application) => {
    const applicationId = application?._id || application?.id;

    if (!applicationId) {
      alert("Solicitud inválida.");
      return;
    }

    const confirmApprove = window.confirm(
      `¿Aprobar la solicitud de ${application?.fullname?.firstname || ""} ${
        application?.fullname?.lastname || ""
      }?\n\nAl aprobarla, se creará el conductor activo y podrá iniciar sesión.`
    );

    if (!confirmApprove) return;

    try {
      setActionLoadingId(applicationId);

      const response = await fetch(
        `${API_BASE}/super-admin/driver-applications/${applicationId}/approve`,
        {
          method: "PATCH",
          headers: getHeaders(),
          credentials: "include",
        }
      );

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo aprobar la solicitud.");
      }

      alert(data.message || "Solicitud aprobada correctamente.");

      await Promise.all([
        loadDashboard({ silent: true }),
        loadDriverApplications({ status: applicationFilter, silent: true }),
      ]);
    } catch (error) {
      console.error("Error aprobando solicitud:", error);
      alert(error.message || "No se pudo aprobar la solicitud.");
    } finally {
      setActionLoadingId("");
    }
  };

  const rejectApplication = async (application) => {
    const applicationId = application?._id || application?.id;

    if (!applicationId) {
      alert("Solicitud inválida.");
      return;
    }

    const reason = window.prompt(
      "Escribe el motivo del rechazo. Este motivo quedará guardado para auditoría:"
    );

    if (reason === null) return;

    const cleanReason = String(reason || "").trim();

    if (cleanReason.length < 5) {
      alert("El motivo debe tener mínimo 5 caracteres.");
      return;
    }

    try {
      setActionLoadingId(applicationId);

      const response = await fetch(
        `${API_BASE}/super-admin/driver-applications/${applicationId}/reject`,
        {
          method: "PATCH",
          headers: getHeaders(),
          credentials: "include",
          body: JSON.stringify({
            reason: cleanReason,
          }),
        }
      );

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo rechazar la solicitud.");
      }

      alert(data.message || "Solicitud rechazada correctamente.");

      await Promise.all([
        loadDashboard({ silent: true }),
        loadDriverApplications({ status: applicationFilter, silent: true }),
      ]);
    } catch (error) {
      console.error("Error rechazando solicitud:", error);
      alert(error.message || "No se pudo rechazar la solicitud.");
    } finally {
      setActionLoadingId("");
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/centralgo-admin-root");
      return;
    }

    loadMe();
    loadDashboard({ silent: false });
    loadDriverApplications({ status: "pending", silent: false });

    const interval = setInterval(() => {
      loadDashboard({ silent: true });
      loadDriverApplications({ status: applicationFilter, silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const modules = dashboard?.modules || {};
  const users = modules?.users || {};
  const rides = modules?.rides || {};
  const enterprise = modules?.enterprise || {};
  const marketplace = modules?.marketplace || {};
  const driverApplicationsStats = modules?.driverApplications || {};
  const totals = modules?.totals || {};
  const latest = dashboard?.latest || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-5">
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Cargando Super Admin...
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Consultando operación general de Central Go.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Central Go Super Admin
              </p>
              <h1 className="mt-1 text-3xl font-extrabold">
                Panel maestro administrativo
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Control general de empresarial, viajes tipo Uber/InDriver y marketplace logístico.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  loadDashboard({ silent: true });
                  loadDriverApplications({ status: applicationFilter, silent: true });
                }}
                disabled={refreshing}
                className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
              >
                {refreshing ? "Actualizando..." : "Actualizar"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-white px-5 py-3 font-bold text-slate-950"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
            Sesión: <b>{admin?.name || "Super Admin"}</b> · {admin?.email || "Sin correo"} · Última generación:{" "}
            {formatDate(dashboard?.generatedAt)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Ingresos brutos estimados"
            value={formatCOP(totals.grossRevenue)}
            subtitle="Viajes + entregas empresariales finalizadas"
          />

          <StatCard
            title="Ingresos hoy"
            value={formatCOP(totals.grossRevenueToday)}
            subtitle="Movimiento finalizado del día"
          />

          <StatCard
            title="Comisión estimada"
            value={formatCOP(totals.estimatedCommission)}
            subtitle={`Comisión ${dashboard?.commissionPercent || 0}%`}
          />

          <StatCard
            title="Solicitudes pendientes"
            value={driverApplicationsStats.pendingDriverApplications || 0}
            subtitle="Conductores esperando aprobación"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ModuleCard
            title="Usuarios y pasajeros"
            description="Base de usuarios registrados en la aplicación."
          >
            <div className="grid grid-cols-1 gap-3">
              <StatCard title="Usuarios registrados" value={users.totalUsers || 0} />
            </div>
          </ModuleCard>

          <ModuleCard
            title="Viajes tipo Uber / InDriver"
            description="Solicitudes, negociación, viajes completados y capitanes."
          >
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Viajes totales" value={rides.totalRides || 0} />
              <StatCard title="Viajes hoy" value={rides.ridesToday || 0} />
              <StatCard title="Completados" value={rides.completedRides || 0} />
              <StatCard title="Cancelados" value={rides.cancelledRides || 0} />
              <StatCard title="Pendientes" value={rides.pendingRides || 0} />
              <StatCard title="Negociando" value={rides.negotiatingRides || 0} />
              <StatCard title="Capitanes" value={rides.totalCaptains || 0} />
              <StatCard title="Online" value={rides.onlineCaptains || 0} />
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">Dinero viajes</p>
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                {formatCOP(rides.revenue)}
              </p>
              <p className="text-xs text-slate-500">
                Comisión estimada: {formatCOP(rides.estimatedCommission)}
              </p>
            </div>
          </ModuleCard>

          <ModuleCard
            title="Empresarial"
            description="Empresas, conductores empresariales y entregas."
          >
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Empresas" value={enterprise.totalEnterprises || 0} />
              <StatCard title="Activas" value={enterprise.activeEnterprises || 0} />
              <StatCard
                title="Conductores"
                value={enterprise.totalEnterpriseDrivers || 0}
              />
              <StatCard
                title="En ruta"
                value={enterprise.enterpriseDriversInRoute || 0}
              />
              <StatCard
                title="Entregas"
                value={enterprise.totalEnterpriseDeliveries || 0}
              />
              <StatCard
                title="Entregas hoy"
                value={enterprise.enterpriseDeliveriesToday || 0}
              />
              <StatCard
                title="Pendientes"
                value={enterprise.enterpriseDeliveriesPending || 0}
              />
              <StatCard
                title="Finalizadas"
                value={enterprise.enterpriseDeliveriesFinished || 0}
              />
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">Dinero empresarial</p>
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                {formatCOP(enterprise.revenue)}
              </p>
              <p className="text-xs text-slate-500">
                Comisión estimada: {formatCOP(enterprise.estimatedCommission)}
              </p>
            </div>
          </ModuleCard>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Solicitudes de conductores
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revisa documentos, aprueba conductores o rechaza solicitudes con motivo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleChangeApplicationFilter("pending")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                  applicationFilter === "pending"
                    ? "bg-amber-500 text-white"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                Pendientes ({driverApplicationsStats.pendingDriverApplications || 0})
              </button>

              <button
                type="button"
                onClick={() => handleChangeApplicationFilter("approved")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                  applicationFilter === "approved"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                Aprobadas ({driverApplicationsStats.approvedDriverApplications || 0})
              </button>

              <button
                type="button"
                onClick={() => handleChangeApplicationFilter("rejected")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                  applicationFilter === "rejected"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                Rechazadas ({driverApplicationsStats.rejectedDriverApplications || 0})
              </button>

              <button
                type="button"
                onClick={() => handleChangeApplicationFilter("all")}
                className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                  applicationFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                Todas
              </button>
            </div>
          </div>

          <div className="mt-5">
            {applicationsLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                Cargando solicitudes...
              </div>
            ) : driverApplications.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No hay solicitudes para este filtro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {driverApplications.map((application) => {
                  const applicationId = application._id || application.id;
                  const isActionLoading = actionLoadingId === applicationId;

                  return (
                    <div
                      key={applicationId}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-extrabold text-slate-900">
                              {application?.fullname?.firstname || "Sin nombre"}{" "}
                              {application?.fullname?.lastname || ""}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getApplicationStatusClass(
                                application.status
                              )}`}
                            >
                              {getApplicationStatusLabel(application.status)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-600">
                            {application.email}
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Vehículo
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {getVehicleTypeLabel(application?.vehicle?.vehicleType)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Placa
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {application?.vehicle?.plate || "Sin placa"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Color
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {application?.vehicle?.color || "Sin color"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Fecha solicitud
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {formatDate(application.createdAt)}
                              </p>
                            </div>
                          </div>

                          {application.status === "rejected" && application.rejectionReason ? (
                            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                              <b>Motivo rechazo:</b> {application.rejectionReason}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2 xl:min-w-[260px]">
                          <button
                            type="button"
                            onClick={() =>
                              openDocument(application?.documents?.drivingLicenseImage)
                            }
                            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                          >
                            Ver licencia
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openDocument(application?.documents?.vehicleRegistrationImage)
                            }
                            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
                          >
                            Ver matrícula
                          </button>

                          {application.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => approveApplication(application)}
                                disabled={isActionLoading}
                                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                              >
                                {isActionLoading ? "Procesando..." : "Aprobar"}
                              </button>

                              <button
                                type="button"
                                onClick={() => rejectApplication(application)}
                                disabled={isActionLoading}
                                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                              >
                                {isActionLoading ? "Procesando..." : "Rechazar"}
                              </button>
                            </>
                          ) : (
                            <div className="rounded-2xl bg-white px-4 py-3 text-center text-xs font-semibold text-slate-500 border border-slate-200">
                              Solicitud ya revisada
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold text-slate-900">
              Marketplace logístico
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Módulo de mercancía, cupos, espacios y negociaciones logísticas.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-bold">Estado: {marketplace.status || "pendiente"}</p>
            <p className="mt-1 text-sm">
              {marketplace.note ||
                "El módulo está visible, pero falta conectar modelos backend específicos."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">
              Últimos viajes
            </h2>

            <div className="mt-4 space-y-3">
              {(latest.rides || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sin viajes recientes.</p>
              ) : (
                latest.rides.map((ride) => (
                  <div
                    key={ride._id || ride.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-bold text-slate-900">
                          {ride.pickup} → {ride.destination}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Estado: {ride.status} · Vehículo: {ride.vehicleType}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-emerald-700">
                          {formatCOP(ride.fare)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(ride.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">
              Últimas entregas empresariales
            </h2>

            <div className="mt-4 space-y-3">
              {(latest.enterpriseDeliveries || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sin entregas recientes.</p>
              ) : (
                latest.enterpriseDeliveries.map((delivery) => (
                  <div
                    key={delivery._id || delivery.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-bold text-slate-900">
                          Factura #{delivery.invoiceNumber} · {delivery.clientName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Estado: {delivery.status} · Conductor:{" "}
                          {delivery.assignedDriverName ||
                            delivery.assignedDriverId?.name ||
                            "Sin conductor"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-emerald-700">
                          {formatCOP(delivery.invoiceValue)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(delivery.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-slate-900">
            Conductores empresariales con ubicación reciente
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(latest.enterpriseDrivers || []).length === 0 ? (
              <p className="text-sm text-slate-500">
                Sin conductores empresariales registrados.
              </p>
            ) : (
              latest.enterpriseDrivers.map((driver) => (
                <div
                  key={driver._id || driver.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-bold text-slate-900">{driver.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {driver.vehicle || "Vehículo"} · {driver.plate || "Sin placa"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Empresa: {driver.enterprise?.companyName || "Sin empresa"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-blue-700">
                    Estado: {driver.status || "Disponible"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Última ubicación:{" "}
                    {driver.currentLocation?.updatedAt
                      ? formatDate(driver.currentLocation.updatedAt)
                      : "Sin registro"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;