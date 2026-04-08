import React from "react";
import { Link } from "react-router-dom";

const accessCards = [
  {
    title: "Cliente",
    description:
      "Solicita un carro o servicio de transporte de forma rápida y segura.",
    buttonText: "Entrar como cliente",
    to: "/login",
    badge: "Viajes",
    buttonClass: "bg-black text-white",
    cardAccent: "border-black/10",
    iconBg: "bg-gray-100",
    emoji: "🙋",
  },
  {
    title: "Conductor de empresa",
    description:
      "Accede a tus asignaciones empresariales, revisa rutas y gestiona entregas.",
    buttonText: "Entrar como conductor de empresa",
    to: "/enterprise-driver-login",
    badge: "Logística",
    buttonClass: "bg-green-600 text-white",
    cardAccent: "border-green-200",
    iconBg: "bg-green-100",
    emoji: "🚚",
  },
  {
    title: "Panel empresa",
    description:
      "Supervisa conductores, entregas, rutas y rendimiento operativo de tu empresa.",
    buttonText: "Entrar al panel empresa",
    to: "/enterprise-login",
    badge: "Gestión",
    buttonClass: "bg-blue-600 text-white",
    cardAccent: "border-blue-200",
    iconBg: "bg-blue-100",
    emoji: "🏢",
  },
];

const Start = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-500 to-blue-600 flex flex-col">
      <div className="pt-7 px-6">
        <img
          className="w-44"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <div className="px-6 mt-4">
        <img
          className="w-full max-w-md mx-auto object-contain"
          src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
          alt="banner"
        />
      </div>

      <div className="mt-4 bg-white rounded-t-[32px] shadow-2xl px-5 pt-8 pb-10 flex-1">
        <div className="text-center max-w-xl mx-auto">
          <p className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-4 py-2 text-sm font-semibold">
            Selección de acceso
          </p>

          <h1 className="text-3xl font-bold text-gray-900 mt-4 leading-tight">
            ¿Cómo quieres ingresar a Central Go?
          </h1>

          <p className="text-gray-600 mt-3 text-base leading-relaxed">
            Selecciona tu perfil para continuar y entrar al módulo correcto.
          </p>
        </div>

        <div className="mt-8 space-y-4 max-w-2xl mx-auto">
          {accessCards.map((card) => (
            <div
              key={card.title}
              className={`bg-gray-50 border ${card.cardAccent} rounded-3xl p-5 shadow-sm`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center text-2xl flex-shrink-0`}
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

                  <Link
                    to={card.to}
                    className={`mt-5 flex items-center justify-center w-full py-3.5 rounded-2xl text-base font-semibold transition ${card.buttonClass}`}
                  >
                    {card.buttonText}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto mt-7 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            <span className="font-semibold text-gray-900">Cliente:</span> solicita tu viaje.{" "}
            <span className="font-semibold text-gray-900">Conductor de empresa:</span> entra a operar entregas.{" "}
            <span className="font-semibold text-gray-900">Panel empresa:</span> administra la logística.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Start;
