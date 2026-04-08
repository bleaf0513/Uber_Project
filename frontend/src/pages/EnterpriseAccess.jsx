import React from "react";
import { Link } from "react-router-dom";

const accessCards = [
  {
    title: "Panel empresa",
    description:
      "Administra conductores, crea entregas, supervisa rutas, revisa estadísticas e historial operativo.",
    to: "/enterprise-login",
    buttonText: "Ingresar como empresa",
    emoji: "🏢",
    badge: "Gestión",
    cardBg: "from-blue-50 to-white",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    buttonClass: "bg-blue-600 text-white",
    accentText: "text-blue-700",
  },
  {
    title: "Conductor de empresa",
    description:
      "Accede a tus asignaciones, inicia entregas, sigue tu ruta y reporta tu ubicación en tiempo real.",
    to: "/enterprise-driver-login",
    buttonText: "Ingresar como conductor",
    emoji: "🚚",
    badge: "Operación",
    cardBg: "from-green-50 to-white",
    border: "border-green-200",
    iconBg: "bg-green-100",
    buttonClass: "bg-green-600 text-white",
    accentText: "text-green-700",
  },
];

const EnterpriseAccess = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-gray-100 flex flex-col">
      <div className="bg-blue-700 text-white px-6 pt-8 pb-8 shadow-lg rounded-b-[30px]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 text-4xl mb-4">
            📦
          </div>

          <h1 className="text-3xl font-bold">Logística empresarial</h1>

          <p className="text-sm text-blue-100 mt-3 leading-relaxed">
            Gestiona entregas, realiza seguimiento en tiempo real y controla la
            operación logística de tu empresa desde un solo lugar.
          </p>
        </div>
      </div>

      <div className="p-5 flex-1">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow p-5 mb-5 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">
              ¿Qué puedes hacer aquí?
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-blue-700">
                  📍 Seguimiento en tiempo real
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Consulta dónde están los conductores y cómo avanza la operación.
                </p>
              </div>

              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-green-700">
                  🚚 Control de entregas
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Asigna recorridos, inicia entregas y visualiza su estado.
                </p>
              </div>

              <div className="bg-purple-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-purple-700">
                  📊 Estadísticas
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Mide rendimiento por día, mes y conductor.
                </p>
              </div>

              <div className="bg-orange-50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-orange-700">
                  🧾 Historial y trazabilidad
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Busca facturas, clientes y movimientos pasados sin perder control.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {accessCards.map((card) => (
              <div
                key={card.title}
                className={`bg-gradient-to-br ${card.cardBg} border ${card.border} rounded-3xl shadow p-5`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 rounded-3xl ${card.iconBg} flex items-center justify-center text-3xl flex-shrink-0 shadow-sm`}
                  >
                    {card.emoji}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {card.title}
                      </h3>

                      <span className="text-xs font-semibold uppercase tracking-wide bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full">
                        {card.badge}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                      {card.description}
                    </p>

                    <p className={`text-sm font-semibold mt-3 ${card.accentText}`}>
                      Acceso recomendado para{" "}
                      {card.title === "Panel empresa"
                        ? "coordinadores, supervisores y empresas."
                        : "conductores asignados a la operación empresarial."}
                    </p>

                    <Link
                      to={card.to}
                      className={`mt-5 flex items-center justify-center w-full py-3.5 rounded-2xl text-base font-semibold shadow-sm ${card.buttonClass}`}
                    >
                      {card.buttonText}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/"
            className="mt-5 flex items-center justify-center w-full bg-gray-200 text-gray-800 py-3 rounded-2xl text-base font-semibold"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseAccess;
