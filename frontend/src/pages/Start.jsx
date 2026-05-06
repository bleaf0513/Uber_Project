import React from "react";
import { Link } from "react-router-dom";

const Start = () => {
  return (
    <div className="min-h-screen w-full bg-[#12091f] text-white overflow-hidden relative">
      {/* Fondos decorativos */}
      <div className="absolute -top-32 -right-24 w-80 h-80 bg-purple-500/40 rounded-full blur-3xl" />
      <div className="absolute top-32 -left-28 w-72 h-72 bg-fuchsia-500/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="px-6 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-centralgo.png"
              alt="Central Go"
              className="w-40 object-contain"
            />
          </div>

          <span className="text-xs font-semibold bg-white/10 border border-white/15 px-3 py-1.5 rounded-full text-white/80">
            Movilidad & logística
          </span>
        </div>

        {/* Hero */}
        <div className="px-6 pt-10 text-center">
          <div className="mx-auto inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2 text-sm text-white/85">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Plataforma activa
          </div>

          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight">
            ¿Cómo quieres empezar en{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-blue-300">
              Central Go?
            </span>
          </h1>

          <p className="mt-4 text-base text-white/70 leading-relaxed max-w-md mx-auto">
            Pide transporte, trabaja como conductor o gestiona la logística de
            tu empresa desde una sola app.
          </p>
        </div>

        {/* Imagen principal */}
        <div className="px-6 mt-6">
          <div className="relative mx-auto max-w-md">
            <div className="absolute inset-0 bg-white/10 rounded-[2rem] blur-xl" />
            <div className="relative bg-white/10 border border-white/15 rounded-[2rem] p-4 backdrop-blur-xl">
              <img
                className="w-full h-48 object-contain"
                src="https://dropinblog.net/34254033/files/featured/Storyboard_Images/City_driver-rafiki.png"
                alt="Central Go transporte"
              />
            </div>
          </div>
        </div>

        {/* Panel inferior */}
        <div className="mt-8 bg-white text-gray-950 rounded-t-[2.2rem] px-5 pt-6 pb-8 shadow-2xl flex-1">
          <div className="max-w-md mx-auto space-y-4">
            {/* Opción usuario */}
            <Link
              to="/login"
              className="group block rounded-[1.7rem] bg-gradient-to-br from-purple-700 to-fuchsia-700 p-[1px] shadow-xl shadow-purple-900/20"
            >
              <div className="rounded-[1.65rem] bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl">
                    🚗
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-black text-gray-950">
                        Pedir transporte
                      </h2>

                      <span className="text-[11px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                        Usuarios
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                      Pide carro, moto o transporte de carga de forma rápida y
                      segura.
                    </p>

                    <div className="mt-4 h-12 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold group-hover:bg-purple-800 transition">
                      Pedir ahora
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Opción conductor */}
            <Link
              to="/captain-login"
              className="group block rounded-[1.7rem] bg-gradient-to-br from-emerald-500 to-teal-600 p-[1px] shadow-xl shadow-emerald-900/10"
            >
              <div className="rounded-[1.65rem] bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl">
                    💰
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-black text-gray-950">
                        Trabajar
                      </h2>

                      <span className="text-[11px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                        Conductores
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                      Recibe servicios, rutas y oportunidades para generar más
                      ingresos.
                    </p>

                    <div className="mt-4 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold group-hover:bg-emerald-700 transition">
                      Quiero trabajar
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* Empresa */}
            <div className="rounded-[1.7rem] bg-gray-50 border border-gray-200 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center text-xl">
                  🏢
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black text-gray-950">
                      ¿Tienes una empresa?
                    </h3>

                    <span className="text-[11px] font-bold uppercase tracking-wide bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full">
                      Empresas
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Gestiona entregas, conductores, seguimiento y rutas
                    inteligentes.
                  </p>

                  <Link
                    to="/enterprise-access"
                    className="mt-4 h-11 rounded-2xl bg-gray-950 text-white flex items-center justify-center font-bold hover:bg-gray-800 transition"
                  >
                    Entrar a Central Go Empresas
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer pequeño */}
            <p className="text-center text-xs text-gray-400 pt-2">
              Central Go — movilidad, carga y logística en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Start;