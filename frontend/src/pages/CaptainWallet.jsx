import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "remixicon/fonts/remixicon.css";
import {
  createWalletTopup,
  formatCOP,
  getMyTopups,
  getMyWallet,
  getMyWalletMovements,
} from "../services/walletService";

const PURPLE_GRADIENT = "linear-gradient(135deg, #6D28D9, #A855F7, #D946EF)";
const PURPLE_DEEP = "linear-gradient(135deg, #3B0764, #6D28D9, #C026D3)";
const SOFT_PURPLE = "linear-gradient(135deg, #FAF5FF 0%, #FDF4FF 100%)";

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

const PAYMENT_METHODS = [
  {
    key: "nequi",
    title: "Nequi",
    description: "Recarga con transferencia Nequi",
    icon: "ri-smartphone-line",
  },
  {
    key: "bancolombia",
    title: "Bancolombia",
    description: "Transferencia a cuenta Bancolombia",
    icon: "ri-bank-line",
  },
  {
    key: "pse",
    title: "PSE",
    description: "Pago bancario en línea",
    icon: "ri-secure-payment-line",
  },
];

function formatDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Sin fecha";
  }
}

function getMovementLabel(type) {
  const labels = {
    topup: "Recarga aprobada",
    commission_debit: "Comisión descontada",
    refund: "Devolución",
    adjustment: "Ajuste",
    manual_credit: "Crédito manual",
    manual_debit: "Débito manual",
  };

  return labels[type] || "Movimiento";
}

function getTopupStatusLabel(status) {
  const labels = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
    expired: "Expirada",
  };

  return labels[status] || status || "Pendiente";
}

function getTopupStatusClass(status) {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  if (status === "rejected" || status === "expired") {
    return "bg-red-50 text-red-700 border-red-100";
  }

  return "bg-amber-50 text-amber-700 border-amber-100";
}

const CaptainWallet = () => {
  const navigate = useNavigate();

  const [walletData, setWalletData] = useState(null);
  const [topups, setTopups] = useState([]);
  const [movements, setMovements] = useState([]);

  const [selectedAmount, setSelectedAmount] = useState(20000);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("nequi");

  const [loading, setLoading] = useState(true);
  const [creatingTopup, setCreatingTopup] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedTopupAmount = useMemo(() => {
    const custom = Number(customAmount);
    if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
    return Number(selectedAmount) || 0;
  }, [customAmount, selectedAmount]);

  const walletBalance = walletData?.wallet?.balance || 0;
  const commission = walletData?.commission || {};

  const loadWalletData = async () => {
    try {
      setError("");
      setLoading(true);

      const [walletResponse, topupsResponse, movementsResponse] =
        await Promise.all([
          getMyWallet(),
          getMyTopups({ limit: 10 }),
          getMyWalletMovements({ limit: 20 }),
        ]);

      setWalletData(walletResponse);
      setTopups(Array.isArray(topupsResponse?.topups) ? topupsResponse.topups : []);
      setMovements(
        Array.isArray(movementsResponse?.movements)
          ? movementsResponse.movements
          : []
      );
    } catch (requestError) {
      console.error("[CaptainWallet] Error cargando billetera:", requestError);

      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "No se pudo cargar la billetera."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleCreateTopup = async () => {
    try {
      setError("");
      setSuccessMessage("");

      if (!selectedTopupAmount || selectedTopupAmount < 1000) {
        setError("La recarga mínima es de $1.000 COP.");
        return;
      }

      setCreatingTopup(true);

      const response = await createWalletTopup({
        amount: selectedTopupAmount,
        method: selectedMethod,
      });

      setSuccessMessage(
        `Recarga creada por ${formatCOP(
          selectedTopupAmount
        )}. Queda pendiente de aprobación.`
      );

      setCustomAmount("");

      if (response?.topup) {
        setTopups((prev) => [response.topup, ...prev]);
      }

      await loadWalletData();
    } catch (requestError) {
      console.error("[CaptainWallet] Error creando recarga:", requestError);

      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "No se pudo crear la recarga."
      );
    } finally {
      setCreatingTopup(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className="px-5 pt-5 pb-8 text-white rounded-b-[34px] shadow-xl"
        style={{ background: PURPLE_DEEP }}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-full bg-white/15 border border-white/15 flex items-center justify-center"
          >
            <i className="ri-arrow-left-line text-2xl"></i>
          </button>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70 font-black">
              Central Go
            </p>
            <h1 className="text-xl font-black">Mi billetera</h1>
          </div>

          <button
            type="button"
            onClick={loadWalletData}
            className="w-11 h-11 rounded-full bg-white/15 border border-white/15 flex items-center justify-center"
          >
            <i className="ri-refresh-line text-2xl"></i>
          </button>
        </div>

        <div className="mt-6 rounded-[30px] bg-white/12 border border-white/15 p-5 backdrop-blur">
          <p className="text-sm text-white/75 font-semibold">Saldo disponible</p>

          <h2 className="text-4xl font-black mt-2">
            {loading ? "Cargando..." : formatCOP(walletBalance)}
          </h2>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-white/12 border border-white/10 p-3">
              <p className="text-[11px] uppercase font-black text-white/65">
                Comisión
              </p>
              <p className="text-lg font-black mt-1">
                {commission?.active === false
                  ? "Inactiva"
                  : `${commission?.percentage ?? 10}%`}
              </p>
            </div>

            <div className="rounded-2xl bg-white/12 border border-white/10 p-3">
              <p className="text-[11px] uppercase font-black text-white/65">
                Saldo mínimo
              </p>
              <p className="text-lg font-black mt-1">
                {formatCOP(commission?.minimumBalanceToAccept || 0)}
              </p>
            </div>
          </div>

          <p className="text-xs text-white/70 mt-4 leading-5">
            Este saldo se usa para descontar la comisión de Central Go al
            finalizar cada servicio.
          </p>
        </div>
      </div>

      <div className="px-4 -mt-4 pb-8">
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 mb-3">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 mb-3">
            {successMessage}
          </div>
        )}

        <div className="rounded-[28px] bg-white border border-purple-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-purple-700 font-black">
                Recargar saldo
              </p>
              <h3 className="text-xl font-black text-gray-950 mt-1">
                Elige el valor
              </h3>
            </div>

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: PURPLE_GRADIENT }}
            >
              <i className="ri-wallet-3-line text-2xl text-white"></i>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {QUICK_AMOUNTS.map((amount) => {
              const selected = !customAmount && selectedAmount === amount;

              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                  }}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? "border-purple-500 bg-purple-50 text-purple-900"
                      : "border-gray-200 bg-white text-gray-900"
                  }`}
                >
                  <p className="text-lg font-black">{formatCOP(amount)}</p>
                  <p className="text-xs text-gray-500 mt-1">Recarga rápida</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Otro valor
            </label>

            <input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              type="number"
              min="1000"
              placeholder="Ejemplo: 30000"
              className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-4 outline-none text-lg font-bold focus:border-purple-400"
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-gray-700 mb-3">
              Método de recarga
            </p>

            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => {
                const selected = selectedMethod === method.key;

                return (
                  <button
                    key={method.key}
                    type="button"
                    onClick={() => setSelectedMethod(method.key)}
                    className={`w-full rounded-2xl border p-4 text-left flex items-center gap-3 transition ${
                      selected
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: selected ? PURPLE_GRADIENT : SOFT_PURPLE,
                      }}
                    >
                      <i
                        className={`${method.icon} text-2xl ${
                          selected ? "text-white" : "text-purple-700"
                        }`}
                      ></i>
                    </div>

                    <div className="flex-1">
                      <p className="text-base font-black text-gray-950">
                        {method.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {method.description}
                      </p>
                    </div>

                    {selected && (
                      <i className="ri-checkbox-circle-fill text-2xl text-purple-700"></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm font-black text-amber-800">
              Recarga pendiente de aprobación
            </p>
            <p className="text-xs text-amber-700 mt-1 leading-5">
              En esta primera fase, la recarga queda pendiente hasta que el
              administrador confirme el pago. Luego conectamos Wompi para que
              Nequi, Bancolombia y PSE aprueben automáticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateTopup}
            disabled={creatingTopup}
            className="w-full mt-5 rounded-2xl py-4 text-white font-black text-lg disabled:opacity-60"
            style={{ background: PURPLE_GRADIENT }}
          >
            {creatingTopup
              ? "Creando recarga..."
              : `Recargar ${formatCOP(selectedTopupAmount)}`}
          </button>
        </div>

        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-purple-700 font-black">
                Recargas
              </p>
              <h3 className="text-xl font-black text-gray-950 mt-1">
                Últimas solicitudes
              </h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {topups.length === 0 ? (
              <p className="text-sm text-gray-500">
                Todavía no tienes recargas registradas.
              </p>
            ) : (
              topups.map((topup) => (
                <div
                  key={topup._id}
                  className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-gray-950">
                        {formatCOP(topup.amount)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {String(topup.method || "").toUpperCase()} · Ref:{" "}
                        {topup.reference}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(topup.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${getTopupStatusClass(
                        topup.status
                      )}`}
                    >
                      {getTopupStatusLabel(topup.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] bg-white border border-gray-200 shadow-sm p-4 mt-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-purple-700 font-black">
              Movimientos
            </p>
            <h3 className="text-xl font-black text-gray-950 mt-1">
              Historial de saldo
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {movements.length === 0 ? (
              <p className="text-sm text-gray-500">
                Todavía no tienes movimientos de billetera.
              </p>
            ) : (
              movements.map((movement) => {
                const isDebit =
                  movement.type === "commission_debit" ||
                  movement.type === "manual_debit";

                return (
                  <div
                    key={movement._id}
                    className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black text-gray-950">
                          {getMovementLabel(movement.type)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {movement.description || "Movimiento de billetera"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(movement.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-base font-black ${
                            isDebit ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {isDebit ? "-" : "+"}
                          {formatCOP(movement.amount)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Saldo: {formatCOP(movement.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Link
          to="/captain-home"
          className="mt-5 w-full rounded-2xl border border-purple-200 bg-white py-4 font-black text-purple-700 flex items-center justify-center"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
};

export default CaptainWallet;