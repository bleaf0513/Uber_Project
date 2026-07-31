import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { CaptainDataContext } from "../context/CaptainContext";
import { ToastContainer, toast } from "react-toastify";
import { getApiBaseUrl } from "../apiBase";

const CaptainLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const {
    setCaptain,
    isLoading,
    setIsLoading,
    error,
    setError,
  } = React.useContext(CaptainDataContext);

  const navigate = useNavigate();

  const notify = (message, success = false) => {
    const options = {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      className: "w-5/6 mt-6 text-center",
    };

    if (success) {
      toast.success(message, options);
      return;
    }

    toast.error(message, options);
  };

  const submitHandler = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/captain/login`,
        {
          email: email.trim().toLowerCase(),
          password,
        }
      );

      const captainData = response?.data?.captain;
      const captainToken = response?.data?.token;

      if (!captainData?._id || !captainToken) {
        throw new Error(
          "La respuesta del servidor no contiene una sesión válida."
        );
      }

      setCaptain(captainData);

      /*
       * Sesión específica del conductor.
       *
       * captainToken es la llave principal para todas las
       * pantallas y peticiones del transportador.
       */
      localStorage.setItem(
        "captainToken",
        captainToken
      );

      /*
       * Compatibilidad temporal.
       *
       * Se conserva token porque algunos archivos antiguos
       * de Central Go todavía pueden consultarlo.
       */
      localStorage.setItem(
        "token",
        captainToken
      );

      notify(
        "Inicio de sesión correcto.",
        true
      );

      navigate(
        "/captain-home",
        {
          replace: true,
        }
      );
    } catch (loginError) {
      console.error(
        "Captain login error:",
        loginError
      );

      localStorage.removeItem(
        "captainToken"
      );

      const message =
        loginError?.response?.data?.message ||
        "Inicio de sesión fallido. Verifica el correo y la contraseña.";

      notify(message, false);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex flex-col relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative z-10 px-6 pt-7">
          <Link to="/">
            <img
              className="w-40"
              src="/logo-centralgo.png"
              alt="Central Go"
            />
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/20 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-900/30">
                  <i className="ri-truck-line text-4xl text-white" />
                </div>

                <p className="inline-flex items-center gap-2 rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-4 py-2 text-sm font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Acceso para transportadores
                </p>

                <h1 className="text-3xl font-black text-gray-950 mt-4">
                  Bienvenido a Central Go
                </h1>

                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  Inicia sesión para gestionar cargas, rutas,
                  propuestas y servicios asignados.
                </p>
              </div>

              <form onSubmit={submitHandler}>
                <label className="text-sm mb-2 font-black text-gray-800 block">
                  Correo electrónico
                </label>

                <div className="relative mb-5">
                  <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />

                  <input
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    className="bg-gray-50 rounded-2xl pl-12 pr-4 py-3.5 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400"
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="tu_correo@aqui.com"
                  />
                </div>

                <label className="text-sm mb-2 font-black text-gray-800 block">
                  Contraseña
                </label>

                <div className="relative mb-5">
                  <i className="ri-lock-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />

                  <input
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    className="bg-gray-50 rounded-2xl pl-12 pr-4 py-3.5 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Tu contraseña"
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-bold mb-4">
                    <i className="ri-error-warning-line mr-1" />
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-500 text-white font-black px-4 py-4 text-base shadow-xl shadow-purple-900/25 transition active:scale-[0.99] disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Iniciando sesión..."
                    : "Ingresar como transportador"}
                </button>

                <p className="text-center text-sm text-gray-600 mt-5">
                  ¿Aún no estás registrado?{" "}
                  <Link
                    to="/captain-signup"
                    className="text-purple-700 font-black"
                  >
                    Conviértete en transportador
                  </Link>
                </p>
              </form>
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm text-white/70">
                ¿Buscas otro tipo de acceso?{" "}
                <Link
                  to="/"
                  className="text-white font-black"
                >
                  Volver al inicio
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </>
  );
};

export default CaptainLogin;