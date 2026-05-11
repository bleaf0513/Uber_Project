import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();
const MIN_CAPTAIN_BALANCE_TO_WORK = 5000;

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

  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getVehicleTypeLabel = (value) => {
  const labels = {
    motorcycle: "Moto",
    car: "Carro",
    light_cargo: "Carga liviana",
    van: "Furgón / camioneta",
    truck: "Camión",
    motocarro: "Motocarro",
    pickup: "Pickup",
    moving: "Mudanza",
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

const getTransactionTypeLabel = (type) => {
  const labels = {
    topup: "Recarga",
    commission_debit: "Comisión descontada",
    refund: "Devolución",
    adjustment: "Ajuste",
    manual_credit: "Crédito manual",
    manual_debit: "Débito manual",
  };

  return labels[type] || type || "Movimiento";
};

const getTransactionTypeClass = (type) => {
  if (["topup", "refund", "manual_credit"].includes(type)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (["commission_debit", "manual_debit"].includes(type)) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
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

const getEnterpriseStatusClass = (active) => {
  if (active) {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }

  return "bg-red-100 text-red-700 border border-red-200";
};

const getBillingAlertClass = (daysSinceRegistration) => {
  const days = Number(daysSinceRegistration || 0);

  if (days >= 30) {
    return "bg-red-50 text-red-700 border border-red-200";
  }

  if (days >= 25) {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
};

const getBillingAlertText = (daysSinceRegistration) => {
  const days = Number(daysSinceRegistration || 0);

  if (days >= 30) return "Periodo cumplido / revisar cobro";
  if (days >= 25) return "Próximo a corte mensual";
  return "Periodo en curso";
};

const getCaptainName = (captain) => {
  const first = captain?.fullname?.firstname || "";
  const last = captain?.fullname?.lastname || "";
  const full = `${first} ${last}`.trim();
  return full || "Conductor sin nombre";
};

const getWalletStatusClass = (canWork) => {
  return canWork
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : "bg-red-50 text-red-700 border border-red-200";
};

const StatCard = ({ title, value, subtitle, tone = "default" }) => {
  const tones = {
    default: "bg-white border-slate-200 text-slate-900",
    dark: "bg-slate-950 border-slate-800 text-white",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-950",
    purple: "bg-purple-50 border-purple-200 text-purple-950",
    amber: "bg-amber-50 border-amber-200 text-amber-950",
    red: "bg-red-50 border-red-200 text-red-950",
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.default}`}>
      <p className="text-sm font-semibold opacity-70">{title}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      {subtitle ? <p className="mt-1 text-xs opacity-60">{subtitle}</p> : null}
    </div>
  );
};

const MiniStat = ({ title, value, subtitle }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p> : null}
    </div>
  );
};

const SectionShell = ({ id, title, description, children, action }) => {
  return (
    <section id={id} className="scroll-mt-28 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};

const EmptyState = ({ title, subtitle }) => {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-base font-black text-slate-800">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [driverApplications, setDriverApplications] = useState([]);
  const [applicationFilter, setApplicationFilter] = useState("pending");

  const [enterprisesOverview, setEnterprisesOverview] = useState([]);
  const [enterprisesLoading, setEnterprisesLoading] = useState(false);

  const [captainWallets, setCaptainWallets] = useState([]);
  const [captainWalletSearch, setCaptainWalletSearch] = useState("");
  const [captainWalletsLoading, setCaptainWalletsLoading] = useState(false);
  const [walletActionLoading, setWalletActionLoading] = useState(false);
  const [selectedCaptainWallet, setSelectedCaptainWallet] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletTransactionsLoading, setWalletTransactionsLoading] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupForm, setTopupForm] = useState({
    amount: "5000",
    description: "Recarga manual por transferencia",
    reference: "",
  });

  const [activeSection, setActiveSection] = useState("resumen");
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

  const isUnauthorizedMessage = (messageValue) => {
    const message = String(messageValue || "").toLowerCase();

    return (
      message.includes("token") ||
      message.includes("sesión") ||
      message.includes("no autorizado") ||
      message.includes("inválida")
    );
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

      if (isUnauthorizedMessage(error.message)) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadEnterprisesOverview = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setEnterprisesLoading(true);
      }

      const response = await fetch(`${API_BASE}/super-admin/enterprises-overview`, {
        method: "GET",
        headers: getHeaders(),
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el resumen de empresas.");
      }

      setEnterprisesOverview(Array.isArray(data.enterprises) ? data.enterprises : []);
    } catch (error) {
      console.error("Error cargando empresas registradas:", error);

      if (isUnauthorizedMessage(error.message)) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudo cargar el resumen de empresas.");
    } finally {
      setEnterprisesLoading(false);
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

      if (isUnauthorizedMessage(error.message)) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudieron cargar las solicitudes.");
    } finally {
      setApplicationsLoading(false);
    }
  };

  const loadCaptainWallets = async ({ search = captainWalletSearch, silent = false } = {}) => {
    try {
      if (!silent) {
        setCaptainWalletsLoading(true);
      }

      const params = new URLSearchParams({
        limit: "80",
      });

      if (String(search || "").trim()) {
        params.set("search", String(search).trim());
      }

      const response = await fetch(`${API_BASE}/super-admin/captain-wallets?${params.toString()}`, {
        method: "GET",
        headers: getHeaders(),
        credentials: "include",
        cache: "no-store",
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los saldos de conductores.");
      }

      setCaptainWallets(Array.isArray(data.captains) ? data.captains : []);
    } catch (error) {
      console.error("Error cargando wallet conductores:", error);

      if (isUnauthorizedMessage(error.message)) {
        handleUnauthorized();
        return;
      }

      alert(error.message || "No se pudieron cargar los saldos de conductores.");
    } finally {
      setCaptainWalletsLoading(false);
    }
  };

  const loadCaptainWalletTransactions = async (captain) => {
    const captainId = captain?._id || captain?.id;

    if (!captainId) return;

    try {
      setWalletTransactionsLoading(true);
      setSelectedCaptainWallet(captain);

      const response = await fetch(
        `${API_BASE}/super-admin/captain-wallets/${captainId}/transactions?limit=30`,
        {
          method: "GET",
          headers: getHeaders(),
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el historial de saldo.");
      }

      setSelectedCaptainWallet(data.captain || captain);
      setWalletTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (error) {
      console.error("Error cargando historial de wallet:", error);
      alert(error.message || "No se pudo cargar el historial de saldo.");
    } finally {
      setWalletTransactionsLoading(false);
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

  const refreshAll = async ({ silent = true } = {}) => {
    await Promise.all([
      loadDashboard({ silent }),
      loadDriverApplications({ status: applicationFilter, silent }),
      loadEnterprisesOverview({ silent }),
      loadCaptainWallets({ silent }),
    ]);
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
        loadCaptainWallets({ silent: true }),
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

  const openTopupModal = async (captain) => {
    setSelectedCaptainWallet(captain);
    setTopupForm({
      amount: "5000",
      description: "Recarga manual por transferencia",
      reference: "",
    });
    setTopupModalOpen(true);
    await loadCaptainWalletTransactions(captain);
  };

  const closeTopupModal = () => {
    setTopupModalOpen(false);
    setWalletTransactions([]);
    setTopupForm({
      amount: "5000",
      description: "Recarga manual por transferencia",
      reference: "",
    });
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();

    const captainId = selectedCaptainWallet?._id || selectedCaptainWallet?.id;
    const amount = Number(topupForm.amount || 0);

    if (!captainId) {
      alert("Selecciona un conductor válido.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("El valor de la recarga debe ser mayor que 0.");
      return;
    }

    if (amount < 1000) {
      alert("La recarga mínima administrativa es de $1.000 COP.");
      return;
    }

    try {
      setWalletActionLoading(true);

      const response = await fetch(`${API_BASE}/super-admin/captain-wallets/${captainId}/topup`, {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          amount,
          description: topupForm.description,
          reference: topupForm.reference,
        }),
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo recargar el saldo.");
      }

      alert(data.message || "Saldo recargado correctamente.");

      if (data.captain) {
        setSelectedCaptainWallet(data.captain);
      }

      await Promise.all([
        loadCaptainWallets({ silent: true }),
        loadCaptainWalletTransactions(data.captain || selectedCaptainWallet),
        loadDashboard({ silent: true }),
      ]);

      setTopupForm({
        amount: "5000",
        description: "Recarga manual por transferencia",
        reference: "",
      });
    } catch (error) {
      console.error("Error recargando saldo:", error);
      alert(error.message || "No se pudo recargar el saldo.");
    } finally {
      setWalletActionLoading(false);
    }
  };

  const goToSection = (sectionId) => {
    setActiveSection(sectionId);

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
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
    loadEnterprisesOverview({ silent: false });
    loadCaptainWallets({ silent: false });

    const interval = setInterval(() => {
      loadDashboard({ silent: true });
      loadDriverApplications({ status: "pending", silent: true });
      loadEnterprisesOverview({ silent: true });
      loadCaptainWallets({ silent: true });
    }, 20000);

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

  const enterpriseOverviewTotals = useMemo(() => {
    return enterprisesOverview.reduce(
      (acc, item) => {
        acc.total += 1;

        if (item.active) acc.active += 1;
        else acc.inactive += 1;

        acc.totalDrivers += Number(item?.stats?.totalDrivers || 0);
        acc.activeDrivers += Number(item?.stats?.activeDrivers || 0);
        acc.driversInRoute += Number(item?.stats?.driversInRoute || 0);
        acc.driversAvailable += Number(item?.stats?.driversAvailable || 0);
        acc.driversInactive += Number(item?.stats?.driversInactive || 0);

        return acc;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        totalDrivers: 0,
        activeDrivers: 0,
        driversInRoute: 0,
        driversAvailable: 0,
        driversInactive: 0,
      }
    );
  }, [enterprisesOverview]);

  const walletTotals = useMemo(() => {
    return captainWallets.reduce(
      (acc, captain) => {
        const balance = Number(captain?.wallet?.balance || 0);
        acc.total += 1;
        acc.totalBalance += balance;

        if (captain?.wallet?.canWork) acc.canWork += 1;
        else acc.blocked += 1;

        if (balance < MIN_CAPTAIN_BALANCE_TO_WORK) acc.critical += 1;

        return acc;
      },
      {
        total: 0,
        canWork: 0,
        blocked: 0,
        critical: 0,
        totalBalance: 0,
      }
    );
  }, [captainWallets]);

  const navigationItems = [
    { key: "resumen", label: "Resumen", icon: "📊" },
    { key: "wallet", label: "Saldo conductores", icon: "💳" },
    { key: "empresas", label: "Empresas", icon: "🏢" },
    { key: "conductores", label: "Solicitudes", icon: "🪪" },
    { key: "marketplace", label: "Marketplace", icon: "📦" },
    { key: "actividad", label: "Actividad", icon: "🛰️" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-5">
        <div className="rounded-[32px] bg-white p-8 text-center shadow-2xl max-w-md">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center text-2xl">
            CG
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">
            Cargando Super Admin
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Consultando operación general de Central Go.
          </p>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white shadow-2xl">
        <div className="mx-auto max-w-7xl px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-300 text-xl font-black text-slate-950 shadow-lg">
                CG
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                  Central Go Super Admin
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Centro de control operativo
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Viajes, empresas, marketplace, conductores y saldos en un solo tablero.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                <b>{admin?.name || "Super Admin"}</b>
                <span className="hidden md:inline"> · {admin?.email || "Sin correo"}</span>
              </div>

              <button
                type="button"
                onClick={() => refreshAll({ silent: true })}
                disabled={
                  refreshing ||
                  applicationsLoading ||
                  enterprisesLoading ||
                  captainWalletsLoading
                }
                className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 shadow-lg disabled:opacity-60"
              >
                {refreshing || applicationsLoading || enterprisesLoading || captainWalletsLoading
                  ? "Actualizando..."
                  : "Actualizar"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-white px-5 py-3 font-black text-slate-950"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {navigationItems.map((item) => {
              const isActive = activeSection === item.key;

              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => goToSection(item.key)}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition ${
                    isActive
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        <SectionShell
          id="resumen"
          title="Resumen ejecutivo"
          description={`Última actualización: ${formatDate(dashboard?.generatedAt)}`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Ingresos brutos estimados"
              value={formatCOP(totals.grossRevenue)}
              subtitle="Viajes + entregas empresariales finalizadas"
              tone="dark"
            />

            <StatCard
              title="Empresas activas"
              value={enterpriseOverviewTotals.active || enterprise.activeEnterprises || 0}
              subtitle={`${enterpriseOverviewTotals.total || enterprise.totalEnterprises || 0} empresas registradas`}
              tone="emerald"
            />

            <StatCard
              title="Capitanes registrados"
              value={rides.totalCaptains || 0}
              subtitle={`${rides.onlineCaptains || 0} conectados actualmente`}
              tone="purple"
            />

            <StatCard
              title="Conductores bloqueados por saldo"
              value={walletTotals.blocked}
              subtitle={`Mínimo para operar: ${formatCOP(MIN_CAPTAIN_BALANCE_TO_WORK)}`}
              tone={walletTotals.blocked > 0 ? "red" : "emerald"}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-950">Usuarios y pasajeros</h3>
              <p className="mt-1 text-sm text-slate-500">Base de usuarios registrados.</p>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <MiniStat title="Usuarios registrados" value={users.totalUsers || 0} />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 xl:col-span-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Viajes tipo Uber / InDriver</h3>
                  <p className="mt-1 text-sm text-slate-500">Solicitudes, negociación, finalización y comisión.</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Comisión estimada</p>
                  <p className="text-lg font-black text-emerald-700">{formatCOP(rides.estimatedCommission)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat title="Viajes totales" value={rides.totalRides || 0} />
                <MiniStat title="Viajes hoy" value={rides.ridesToday || 0} />
                <MiniStat title="Completados" value={rides.completedRides || 0} />
                <MiniStat title="Cancelados" value={rides.cancelledRides || 0} />
                <MiniStat title="Pendientes" value={rides.pendingRides || 0} />
                <MiniStat title="Negociando" value={rides.negotiatingRides || 0} />
                <MiniStat title="Aceptados" value={rides.acceptedRides || 0} />
                <MiniStat title="En curso" value={rides.ongoingRides || 0} />
              </div>
            </div>
          </div>
        </SectionShell>

        <SectionShell
          id="wallet"
          title="Saldo conductores"
          description="Recarga saldo manual, valida quién puede trabajar y revisa movimientos de wallet."
          action={
            <button
              type="button"
              onClick={() => loadCaptainWallets({ silent: false })}
              disabled={captainWalletsLoading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {captainWalletsLoading ? "Cargando saldos..." : "Actualizar saldos"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Conductores listados" value={walletTotals.total} subtitle="Capitanes tipo Uber/InDriver" />
            <StatCard title="Pueden trabajar" value={walletTotals.canWork} subtitle="Saldo igual o mayor a $5.000" tone="emerald" />
            <StatCard title="Bloqueados" value={walletTotals.blocked} subtitle="Requieren recarga" tone={walletTotals.blocked > 0 ? "red" : "emerald"} />
            <StatCard title="Saldo total visible" value={formatCOP(walletTotals.totalBalance)} subtitle="Suma de wallets cargadas" tone="purple" />
          </div>

          <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <label className="text-sm font-black text-slate-700">Buscar conductor</label>
                <input
                  type="text"
                  value={captainWalletSearch}
                  onChange={(e) => setCaptainWalletSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      loadCaptainWallets({ search: captainWalletSearch, silent: false });
                    }
                  }}
                  placeholder="Nombre, correo, placa o tipo de vehículo"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-6 lg:pt-0">
                <button
                  type="button"
                  onClick={() => loadCaptainWallets({ search: captainWalletSearch, silent: false })}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950"
                >
                  Buscar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCaptainWalletSearch("");
                    loadCaptainWallets({ search: "", silent: false });
                  }}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-800 border border-slate-200"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {captainWalletsLoading ? (
              <EmptyState title="Cargando saldos de conductores..." subtitle="Consultando wallet de capitanes." />
            ) : captainWallets.length === 0 ? (
              <EmptyState title="No hay conductores para mostrar" subtitle="Prueba limpiando el filtro de búsqueda." />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {captainWallets.map((captain) => {
                  const captainId = captain._id || captain.id;
                  const balance = Number(captain?.wallet?.balance || 0);
                  const canWork = Boolean(captain?.wallet?.canWork);
                  const missing = Number(captain?.wallet?.missingToWork || 0);

                  return (
                    <div key={captainId} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-950">
                              {getCaptainName(captain)}
                            </h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${getWalletStatusClass(canWork)}`}>
                              {canWork ? "Puede trabajar" : "Bloqueado por saldo"}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">{captain.email || "Sin correo"}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {getVehicleTypeLabel(captain?.vehicle?.vehicleType)} · Placa {captain?.vehicle?.plate || "Sin placa"} · {captain?.vehicle?.color || "Sin color"}
                          </p>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <MiniStat title="Saldo actual" value={formatCOP(balance)} subtitle="Wallet conductor" />
                            <MiniStat title="Mínimo operar" value={formatCOP(captain?.wallet?.minBalanceToWork || MIN_CAPTAIN_BALANCE_TO_WORK)} subtitle="Regla Central Go" />
                            <MiniStat title="Falta" value={formatCOP(missing)} subtitle={canWork ? "Sin faltante" : "Para desbloquear"} />
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 md:min-w-[170px]">
                          <button
                            type="button"
                            onClick={() => openTopupModal(captain)}
                            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                          >
                            Recargar saldo
                          </button>

                          <button
                            type="button"
                            onClick={() => loadCaptainWalletTransactions(captain)}
                            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-800 border border-slate-200"
                          >
                            Ver historial
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCaptainWallet && !topupModalOpen ? (
            <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">
                    Historial de {getCaptainName(selectedCaptainWallet)}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Últimos movimientos registrados en la billetera.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaptainWallet(null)}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 border border-slate-200"
                >
                  Cerrar historial
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {walletTransactionsLoading ? (
                  <p className="text-sm font-bold text-slate-500">Cargando historial...</p>
                ) : walletTransactions.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
                ) : (
                  walletTransactions.map((tx) => (
                    <div key={tx._id || tx.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTransactionTypeClass(tx.type)}`}>
                            {getTransactionTypeLabel(tx.type)}
                          </span>
                          <p className="mt-2 text-sm font-bold text-slate-800">
                            {tx.description || "Movimiento sin descripción"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Referencia: {tx.reference || "Sin referencia"} · {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-lg font-black text-slate-950">{formatCOP(tx.amount)}</p>
                          <p className="text-xs text-slate-500">
                            {formatCOP(tx.balanceBefore)} → {formatCOP(tx.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </SectionShell>

        <SectionShell
          id="empresas"
          title="Empresas registradas"
          description="Control administrativo por empresa: fecha de registro, periodo mensual, conductores y entregas."
          action={
            <button
              type="button"
              onClick={() => loadEnterprisesOverview({ silent: false })}
              disabled={enterprisesLoading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {enterprisesLoading ? "Cargando empresas..." : "Actualizar empresas"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MiniStat title="Empresas" value={enterpriseOverviewTotals.total} />
            <MiniStat title="Activas" value={enterpriseOverviewTotals.active} />
            <MiniStat title="Inactivas" value={enterpriseOverviewTotals.inactive} />
            <MiniStat title="Conductores activos" value={enterpriseOverviewTotals.activeDrivers} />
            <MiniStat title="Conductores en ruta" value={enterpriseOverviewTotals.driversInRoute} />
          </div>

          <div className="mt-5">
            {enterprisesLoading ? (
              <EmptyState title="Cargando empresas registradas..." />
            ) : enterprisesOverview.length === 0 ? (
              <EmptyState title="No hay empresas registradas todavía." />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {enterprisesOverview.map((company) => {
                  const days = Number(company?.billingPeriod?.daysSinceRegistration || 0);
                  const stats = company?.stats || {};

                  return (
                    <div key={company._id || company.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black text-slate-900">
                              {company.companyName || "Empresa sin nombre"}
                            </h3>

                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getEnterpriseStatusClass(company.active)}`}>
                              {company.active ? "Activa" : "Inactiva"}
                            </span>

                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getBillingAlertClass(days)}`}>
                              {getBillingAlertText(days)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-600">
                            NIT: <b>{company.nit || "Sin NIT"}</b> · {company.email || "Sin correo"} · Teléfono: {company.phone || "Sin teléfono"}
                          </p>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <MiniStat title="Fecha registro" value={formatDateOnly(company.createdAt)} subtitle="Inicio del periodo" />
                            <MiniStat title="Próximo corte" value={formatDateOnly(company?.billingPeriod?.nextBillingDate)} subtitle={`${days} días desde registro`} />
                            <MiniStat title="Última actividad GPS" value={formatDate(company?.stats?.lastDriverActivityAt)} subtitle="Conductores empresa" />
                            <MiniStat title="Última entrega" value={formatDate(company?.stats?.lastDeliveryAt)} subtitle="Actividad operativa" />
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                            <MiniStat title="Conductores" value={stats.totalDrivers || 0} />
                            <MiniStat title="Activos" value={stats.activeDrivers || 0} />
                            <MiniStat title="Disponibles" value={stats.driversAvailable || 0} />
                            <MiniStat title="En ruta" value={stats.driversInRoute || 0} />
                            <MiniStat title="Inactivos" value={stats.driversInactive || 0} />
                            <MiniStat title="Entregas" value={stats.totalDeliveries || 0} />
                            <MiniStat title="Pendientes" value={stats.pendingDeliveries || 0} />
                            <MiniStat title="Finalizadas" value={stats.finishedDeliveries || 0} />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:min-w-[250px]">
                          <p className="text-xs font-semibold uppercase text-slate-500">Control mensual</p>
                          <p className="mt-2 text-sm text-slate-700">
                            Esta empresa se controla por <b>mensualidad</b>, no por porcentaje.
                          </p>
                          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                            <p><b>Registrada:</b> {formatDateOnly(company.createdAt)}</p>
                            <p className="mt-1"><b>Días activos:</b> {days}</p>
                            <p className="mt-1"><b>Corte sugerido:</b> {formatDateOnly(company?.billingPeriod?.nextBillingDate)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionShell>

        <SectionShell
          id="conductores"
          title="Solicitudes de conductores"
          description="Revisa documentos, aprueba conductores o rechaza solicitudes con motivo."
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleChangeApplicationFilter("pending")} className={`rounded-2xl px-4 py-2 text-sm font-bold ${applicationFilter === "pending" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                Pendientes ({driverApplicationsStats.pendingDriverApplications || 0})
              </button>
              <button type="button" onClick={() => handleChangeApplicationFilter("approved")} className={`rounded-2xl px-4 py-2 text-sm font-bold ${applicationFilter === "approved" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                Aprobadas ({driverApplicationsStats.approvedDriverApplications || 0})
              </button>
              <button type="button" onClick={() => handleChangeApplicationFilter("rejected")} className={`rounded-2xl px-4 py-2 text-sm font-bold ${applicationFilter === "rejected" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 border border-red-200"}`}>
                Rechazadas ({driverApplicationsStats.rejectedDriverApplications || 0})
              </button>
              <button type="button" onClick={() => handleChangeApplicationFilter("all")} className={`rounded-2xl px-4 py-2 text-sm font-bold ${applicationFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                Todas
              </button>
            </div>
          }
        >
          {applicationsLoading ? (
            <EmptyState title="Cargando solicitudes..." />
          ) : driverApplications.length === 0 ? (
            <EmptyState title="No hay solicitudes para este filtro." />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {driverApplications.map((application) => {
                const applicationId = application._id || application.id;
                const isActionLoading = actionLoadingId === applicationId;

                return (
                  <div key={applicationId} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900">
                            {application?.fullname?.firstname || "Sin nombre"} {application?.fullname?.lastname || ""}
                          </h3>

                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getApplicationStatusClass(application.status)}`}>
                            {getApplicationStatusLabel(application.status)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-600">{application.email}</p>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <MiniStat title="Vehículo" value={getVehicleTypeLabel(application?.vehicle?.vehicleType)} />
                          <MiniStat title="Placa" value={application?.vehicle?.plate || "Sin placa"} />
                          <MiniStat title="Color" value={application?.vehicle?.color || "Sin color"} />
                          <MiniStat title="Fecha solicitud" value={formatDate(application.createdAt)} />
                        </div>

                        {application.status === "rejected" && application.rejectionReason ? (
                          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <b>Motivo rechazo:</b> {application.rejectionReason}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 xl:min-w-[260px]">
                        <button type="button" onClick={() => openDocument(application?.documents?.drivingLicenseImage)} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
                          Ver licencia
                        </button>

                        <button type="button" onClick={() => openDocument(application?.documents?.vehicleRegistrationImage)} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">
                          Ver matrícula
                        </button>

                        {application.status === "pending" ? (
                          <>
                            <button type="button" onClick={() => approveApplication(application)} disabled={isActionLoading} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                              {isActionLoading ? "Procesando..." : "Aprobar"}
                            </button>

                            <button type="button" onClick={() => rejectApplication(application)} disabled={isActionLoading} className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
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
        </SectionShell>

        <SectionShell
          id="marketplace"
          title="Marketplace logístico"
          description="Módulo de mercancía, cupos, espacios y negociaciones logísticas."
        >
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            <p className="text-lg font-black">Estado: {marketplace.status || "pendiente"}</p>
            <p className="mt-1 text-sm">
              {marketplace.note || "El módulo está visible, pero falta conectar modelos backend específicos."}
            </p>
          </div>
        </SectionShell>

        <SectionShell
          id="actividad"
          title="Actividad reciente"
          description="Últimos viajes, entregas empresariales y conductores empresariales con ubicación reciente."
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xl font-black text-slate-900">Últimos viajes</h3>

              <div className="mt-4 space-y-3">
                {(latest.rides || []).length === 0 ? (
                  <p className="text-sm text-slate-500">Sin viajes recientes.</p>
                ) : (
                  latest.rides.map((ride) => (
                    <div key={ride._id || ride.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{ride.pickup} → {ride.destination}</p>
                          <p className="mt-1 text-xs text-slate-500">Estado: {ride.status} · Vehículo: {ride.vehicleType}</p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="font-bold text-emerald-700">{formatCOP(ride.fare)}</p>
                          <p className="text-xs text-slate-500">{formatDate(ride.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xl font-black text-slate-900">Últimas entregas empresariales</h3>

              <div className="mt-4 space-y-3">
                {(latest.enterpriseDeliveries || []).length === 0 ? (
                  <p className="text-sm text-slate-500">Sin entregas recientes.</p>
                ) : (
                  latest.enterpriseDeliveries.map((delivery) => (
                    <div key={delivery._id || delivery.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">Factura #{delivery.invoiceNumber} · {delivery.clientName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Estado: {delivery.status} · Conductor: {delivery.assignedDriverName || delivery.assignedDriverId?.name || "Sin conductor"}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="font-bold text-emerald-700">{formatCOP(delivery.invoiceValue)}</p>
                          <p className="text-xs text-slate-500">{formatDate(delivery.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xl font-black text-slate-900">Conductores empresariales con ubicación reciente</h3>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(latest.enterpriseDrivers || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sin conductores empresariales registrados.</p>
              ) : (
                latest.enterpriseDrivers.map((driver) => (
                  <div key={driver._id || driver.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-bold text-slate-900">{driver.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{driver.vehicle || "Vehículo"} · {driver.plate || "Sin placa"}</p>
                    <p className="mt-1 text-xs text-slate-500">Empresa: {driver.enterprise?.companyName || "Sin empresa"}</p>
                    <p className="mt-2 text-xs font-semibold text-blue-700">Estado: {driver.status || "Disponible"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Última ubicación: {driver.currentLocation?.updatedAt ? formatDate(driver.currentLocation.updatedAt) : "Sin registro"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionShell>
      </main>

      {topupModalOpen && selectedCaptainWallet ? (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 px-4 py-5 backdrop-blur-sm overflow-y-auto">
          <div className="mx-auto max-w-5xl rounded-[32px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Wallet conductor</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Recargar saldo</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {getCaptainName(selectedCaptainWallet)} · {selectedCaptainWallet?.email || "Sin correo"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeTopupModal}
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
              <div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <MiniStat title="Saldo actual" value={formatCOP(selectedCaptainWallet?.wallet?.balance || 0)} />
                  <MiniStat title="Mínimo operar" value={formatCOP(selectedCaptainWallet?.wallet?.minBalanceToWork || MIN_CAPTAIN_BALANCE_TO_WORK)} />
                  <MiniStat title="Estado" value={selectedCaptainWallet?.wallet?.canWork ? "Puede trabajar" : "Bloqueado"} />
                </div>

                <form onSubmit={handleTopupSubmit} className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <label className="text-sm font-black text-slate-700">Valor a recargar</label>
                    <input
                      type="number"
                      min="1000"
                      value={topupForm.amount}
                      onChange={(e) => setTopupForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-black outline-none focus:border-slate-900"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">La recarga administrativa mínima es de $1.000 COP.</p>
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-black text-slate-700">Nota de recarga</label>
                    <textarea
                      value={topupForm.description}
                      onChange={(e) => setTopupForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                      placeholder="Ejemplo: Recarga por transferencia Bancolombia"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-sm font-black text-slate-700">Referencia opcional</label>
                    <input
                      type="text"
                      value={topupForm.reference}
                      onChange={(e) => setTopupForm((prev) => ({ ...prev, reference: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                      placeholder="Ejemplo: Bancolombia-001"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={walletActionLoading}
                    className="mt-5 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-slate-950 shadow-lg disabled:opacity-60"
                  >
                    {walletActionLoading ? "Guardando recarga..." : "Confirmar recarga"}
                  </button>
                </form>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Historial reciente</h3>
                    <p className="text-sm text-slate-500">Movimientos de la billetera.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadCaptainWalletTransactions(selectedCaptainWallet)}
                    className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 border border-slate-200"
                  >
                    Actualizar
                  </button>
                </div>

                <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {walletTransactionsLoading ? (
                    <p className="text-sm font-bold text-slate-500">Cargando historial...</p>
                  ) : walletTransactions.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
                  ) : (
                    walletTransactions.map((tx) => (
                      <div key={tx._id || tx.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getTransactionTypeClass(tx.type)}`}>
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                            <p className="mt-2 text-sm font-bold text-slate-800">{tx.description || "Movimiento sin descripción"}</p>
                            <p className="mt-1 text-xs text-slate-500">Referencia: {tx.reference || "Sin referencia"} · {formatDate(tx.createdAt)}</p>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-lg font-black text-slate-950">{formatCOP(tx.amount)}</p>
                            <p className="text-xs text-slate-500">{formatCOP(tx.balanceBefore)} → {formatCOP(tx.balanceAfter)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SuperAdminDashboard;
