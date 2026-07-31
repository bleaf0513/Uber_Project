import React from "react";
import { Link } from "react-router-dom";

const ACCESS_OPTIONS = [
  {
    key: "user",
    title: "Pedir transporte",
    badgeLabel: "Usuarios",
    description:
      "Solicita carro, moto o transporte de carga de forma rápida y segura.",
    action: "Pedir ahora",
    to: "/login",
    icon: "ri-car-line",
    accent:
      "from-violet-700 via-purple-700 to-fuchsia-600",
    iconBox:
      "bg-purple-100 text-purple-700",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-100",
  },
  {
    key: "captain",
    title: "Soy transportador",
    badgeLabel: "Conductores",
    description:
      "Encuentra cargas, envía propuestas y gestiona tus servicios.",
    action: "Quiero trabajar",
    to: "/captain-login",
    icon: "ri-truck-line",
    accent:
      "from-emerald-600 via-teal-600 to-cyan-600",
    iconBox:
      "bg-emerald-100 text-emerald-700",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    key: "enterprise",
    title: "Central Go Empresas",
    badgeLabel: "Empresas",
    description:
      "Administra entregas, conductores, seguimiento y rutas.",
    action: "Entrar a Empresas",
    to: "/enterprise-access",
    icon: "ri-building-2-line",
    accent:
      "from-slate-950 via-slate-900 to-blue-950",
    iconBox:
      "bg-slate-100 text-slate-800",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200",
  },
];

const BENEFITS = [
  {
    icon: "ri-map-pin-time-line",
    title: "Seguimiento en vivo",
  },
  {
    icon: "ri-shield-check-line",
    title: "Operación segura",
  },
  {
    icon: "ri-route-line",
    title: "Logística conectada",
  },
];

const Start = () => {
  return (
    <div className="min-h-screen w-full bg-[#0e0718] text-white overflow-x-hidden relative">
      <div className="absolute -top-32 -right-24 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl" />
      <div className="absolute top-48 -left-24 w-72 h-72 bg-fuchsia-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-screen">
        <header className="px-4 pt-5 sm:px-6 sm:pt-7">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <img
              src="/logo-centralgo.png"
              alt="Central Go"
              className="w-32 sm:w-40 object-contain"
            />

            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-2 text-[10px] sm:text-xs font-black text-white/80 backdrop-blur-xl">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Activa
            </div>
          </div>
        </header>

        <main>
          <section className="px-4 pt-6 pb-6 sm:px-6 sm:pt-10 sm:pb-10">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-7 lg:gap-12 items-center">
                <div className="text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-2 text-[11px] sm:text-sm text-white/85 backdrop-blur-xl">
                    <i className="ri-flashlight-line text-emerald-300" />
                    Movilidad, carga y logística
                  </div>

                  <h1 className="mt-5 text-[2.35rem] sm:text-5xl lg:text-6xl font-black leading-[1.02] tracking-tight">
                    Muévete, trabaja y haz crecer tu negocio con{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-cyan-300">
                      Central Go
                    </span>
                  </h1>

                  <p className="mt-4 text-sm sm:text-lg text-white/70 leading-6 sm:leading-8 max-w-xl mx-auto lg:mx-0">
                    Usuarios, transportadores y empresas conectados en una sola plataforma.
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-6 max-w-xl mx-auto lg:mx-0">
                    {BENEFITS.map((benefit) => (
                      <div
                        key={benefit.title}
                        className="rounded-2xl bg-white/8 border border-white/10 px-2 py-3 backdrop-blur-xl"
                      >
                        <i className={`${benefit.icon} text-lg text-purple-300`} />

                        <p className="text-[9px] sm:text-xs font-black text-white/80 mt-2 leading-3 sm:leading-4">
                          {benefit.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-4 bg-gradient-to-r from-purple-600/25 to-cyan-500/20 rounded-[2rem] blur-3xl" />

                  <div className="relative rounded-[1.8rem] border border-white/15 bg-white/10 backdrop-blur-2xl p-3 sm:p-5 shadow-2xl">
                    <div className="rounded-[1.4rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 h-48 sm:h-72 lg:h-80 flex items-center justify-center overflow-hidden">
                      <img
                        src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
                        alt="Central Go transporte y logística"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-2xl bg-white/10 border border-white/10 px-2 py-2.5 text-center">
                        <p className="text-base sm:text-lg font-black">
                          1
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-white/60 mt-1">
                          Plataforma
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/10 border border-white/10 px-2 py-2.5 text-center">
                        <p className="text-base sm:text-lg font-black">
                          3
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-white/60 mt-1">
                          Accesos
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/10 border border-white/10 px-2 py-2.5 text-center">
                        <p className="text-base sm:text-lg font-black">
                          24/7
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-white/60 mt-1">
                          Conectividad
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white text-gray-950 rounded-t-[2.2rem] sm:rounded-t-[3rem] shadow-[0_-20px_60px_rgba(0,0,0,0.22)]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-11">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] text-purple-700">
                  Elige tu acceso
                </p>

                <h2 className="text-2xl sm:text-4xl font-black text-gray-950 mt-2">
                  ¿Cómo quieres usar Central Go?
                </h2>

                <p className="text-xs sm:text-base text-gray-600 mt-2">
                  Selecciona una opción para continuar.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-3 sm:gap-5 mt-6 sm:mt-8">
                {ACCESS_OPTIONS.map((option) => (
                  <Link
                    key={option.key}
                    to={option.to}
                    className="group block"
                  >
                    <article className="rounded-[1.6rem] border border-gray-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.08)] overflow-hidden transition active:scale-[0.99] md:h-full">
                      <div className={`h-1.5 bg-gradient-to-r ${option.accent}`} />

                      <div className="p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${option.iconBox} flex items-center justify-center shrink-0`}
                          >
                            <i className={`${option.icon} text-xl sm:text-2xl`} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-lg sm:text-xl font-black text-gray-950 truncate">
                                {option.title}
                              </h3>

                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wide ${option.badgeClass}`}
                              >
                                {option.badgeLabel}
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-5">
                              {option.description}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`mt-4 rounded-2xl bg-gradient-to-r ${option.accent} text-white px-4 py-3 font-black flex items-center justify-between shadow-lg`}
                        >
                          <span className="text-sm sm:text-base">
                            {option.action}
                          </span>

                          <i className="ri-arrow-right-line text-lg sm:text-xl" />
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>

              <div className="mt-6 rounded-[1.4rem] bg-gray-50 border border-gray-200 px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-black text-gray-900">
                      Central Go
                    </p>

                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                      Movilidad, carga y logística en tiempo real.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-gray-500">
                    <i className="ri-shield-check-line text-emerald-600" />
                    Plataforma segura y organizada
                  </div>
                </div>
              </div>

              <div className="h-4 sm:hidden" />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Start;