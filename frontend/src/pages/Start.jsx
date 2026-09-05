import React from "react";
import { Link } from "react-router-dom";

import heroImg from "../assets/equipo_de_entregas_con_ubicación_inteligente.png";
import pedirImg from "../assets/coche_morado_con_pin_de_ubicación_brillante.png";
import conductorImg from "../assets/camión_neón_con_paquetes_flotantes.png";
import empresaImg from "../assets/complejo_corporativo_con_panel_analítico_3d.png";

const Start = () => {
  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#020617] text-white">
      <div className="relative mx-auto min-h-[100dvh] max-w-[980px] overflow-hidden px-5 pb-6 pt-6 sm:px-8">
        {/* Fondo */}
        <div className="pointer-events-none absolute -right-28 top-10 h-80 w-80 rounded-full bg-violet-700/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-[28%] h-72 w-72 rounded-full bg-fuchsia-600/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-600/10 blur-3xl" />

        <div className="relative z-10">
          {/* Header */}
          <header className="flex items-start justify-between gap-4">
            <img
              src="/logo-centralgo.png"
              alt="Central Go"
              className="w-[126px] object-contain sm:w-[150px]"
            />

            <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-black text-white/90 backdrop-blur-xl">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,.8)]" />
              Activa
            </div>
          </header>

          {/* Hero */}
          <section className="mt-6 grid grid-cols-[1.12fr_.88fr] items-center gap-1 sm:gap-6">
            <div className="min-w-0">
              <h1 className="text-[42px] font-black leading-[0.98] tracking-[-0.045em] sm:text-[56px]">
                Muévete,
                <br />
                trabaja y crece
                <br />
                con{" "}
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  Central Go
                </span>
              </h1>

              <p className="mt-5 max-w-[540px] text-[17px] font-medium leading-7 text-white/72 sm:text-[19px]">
                Usuarios, transportadores y empresas en una sola plataforma.
              </p>
            </div>

            <div className="relative flex min-h-[250px] items-end justify-center sm:min-h-[330px]">
              <div className="absolute right-3 top-2 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
              <img
                src={heroImg}
                alt="Central Go"
                className="relative z-10 w-full max-w-[390px] object-contain drop-shadow-[0_22px_36px_rgba(0,0,0,.35)]"
              />
            </div>
          </section>

          {/* Métricas */}
          <section className="mt-5 rounded-[28px] border border-cyan-400/15 bg-slate-950/55 px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,.24)] backdrop-blur-xl">
            <div className="grid grid-cols-3">
              <div className="border-r border-white/10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-violet-700 to-fuchsia-700 text-2xl font-black shadow-lg">
                  1
                </div>
                <p className="mt-2 text-[14px] font-bold">Plataforma</p>
              </div>

              <div className="border-r border-white/10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-700 to-blue-700 text-2xl font-black shadow-lg">
                  3
                </div>
                <p className="mt-2 text-[14px] font-bold">Accesos</p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-12 min-w-16 items-center justify-center rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-700 to-teal-700 px-2 text-2xl font-black shadow-lg">
                  24/7
                </div>
                <p className="mt-2 text-[14px] font-bold">Conectividad</p>
              </div>
            </div>
          </section>

          {/* Accesos */}
          <section className="mt-5 rounded-[30px] border border-white/10 bg-[#06101f]/90 p-4 shadow-[0_26px_80px_rgba(0,0,0,.30)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-700/20 text-violet-300">
                <i className="ri-group-fill text-2xl" />
              </div>
              <div>
                <h2 className="text-[22px] font-black">Elige tu acceso</h2>
                <p className="text-[13px] text-white/55">
                  Selecciona la opción que mejor se adapte a ti.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Usuario */}
              <Link to="/login" className="block">
                <article className="relative min-h-[230px] overflow-hidden rounded-[28px] border border-fuchsia-300/20 bg-gradient-to-br from-[#3c0f7b] via-[#4b1593] to-[#1f144d] p-4 shadow-[0_22px_50px_rgba(76,29,149,.28)] transition active:scale-[0.985]">
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="max-w-[58%]">
                        <h3 className="text-[23px] font-black leading-[1.02]">
                          Pedir
                          <br />
                          transporte
                        </h3>

                        <p className="mt-3 text-[14px] leading-5 text-white/70">
                          Solicita carro,
                          <br />
                          moto o carga
                        </p>
                      </div>

                      <img
                        src={pedirImg}
                        alt=""
                        className="mt-1 w-[46%] max-w-[145px] object-contain"
                      />
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-black/10 px-3 py-2 text-[12px] font-black text-white/85">
                      <i className="ri-user-3-fill" />
                      Usuarios
                    </div>
                  </div>
                </article>
              </Link>

              {/* Conductor */}
              <Link to="/captain-login" className="block">
                <article className="relative min-h-[230px] overflow-hidden rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-[#075f5e] via-[#087a78] to-[#063e50] p-4 shadow-[0_22px_50px_rgba(8,122,120,.25)] transition active:scale-[0.985]">
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="max-w-[58%]">
                        <h3 className="text-[23px] font-black leading-[1.02]">
                          Soy
                          <br />
                          transportador
                        </h3>

                        <p className="mt-3 text-[14px] leading-5 text-white/70">
                          Encuentra cargas
                          <br />
                          y servicios
                        </p>
                      </div>

                      <img
                        src={conductorImg}
                        alt=""
                        className="mt-1 w-[46%] max-w-[145px] object-contain"
                      />
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-black/10 px-3 py-2 text-[12px] font-black text-white/85">
                      <i className="ri-user-3-fill" />
                      Conductores
                    </div>
                  </div>
                </article>
              </Link>

              {/* Empresa */}
              <Link to="/enterprise-access" className="col-span-2 block">
                <article className="relative overflow-hidden rounded-[28px] border border-blue-300/20 bg-gradient-to-r from-[#082f71] via-[#0c3d89] to-[#071a46] p-4 shadow-[0_22px_50px_rgba(15,58,141,.28)] transition active:scale-[0.99]">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl" />

                  <div className="relative z-10 flex items-center gap-4">
                    <img
                      src={empresaImg}
                      alt=""
                      className="w-[32%] max-w-[170px] shrink-0 object-contain"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-[24px] font-black leading-tight">
                        Central Go Empresas
                      </h3>

                      <p className="mt-2 text-[14px] leading-5 text-white/68">
                        Administra entregas
                        <br />
                        y conductores
                      </p>

                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-black/10 px-3 py-2 text-[12px] font-black text-white/85">
                        <i className="ri-briefcase-fill" />
                        Empresas
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            </div>
          </section>

          <footer className="mt-5 flex items-center justify-center gap-3 text-[12px] font-semibold text-white/45">
            <span className="h-px flex-1 bg-white/10" />
            <i className="ri-shield-check-fill text-emerald-400" />
            Plataforma segura y organizada
            <span className="h-px flex-1 bg-white/10" />
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Start;