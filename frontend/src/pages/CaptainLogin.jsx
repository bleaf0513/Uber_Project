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
    if (success) {
      toast.success(message, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        className: "w-5/6 mt-6 text-center",
      });
    } else {
      toast.error(message, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        className: "w-5/6 mt-6 text-center",
      });
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload = {
        email,
        password,
      };

      const response = await axios.post(
        `${getApiBaseUrl()}/captain/login`,
        payload
      );

      if (response.status === 200) {
        const data = response.data;
        setCaptain(data.captain);
        localStorage.setItem("token", data.token);
        navigate("/captain-home");
      }
    } catch (error) {
      console.error("Login error:", error);
      notify("Inicio de sesion fallido, correo o contrasena invalida", false);
      setError("Error al iniciar sesion. Intentalo de nuevo.");
    } finally {
      setIsLoading(false);
    }

    setEmail("");
    setPassword("");
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-6 pt-7">
          <Link to="/">
            <img
              className="w-40"
              src="/logo-centralgo.png"
              alt="Central Go"
            />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">
                  🚚
                </div>

                <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
                  Acceso para transportadores
                </p>

                <h1 className="text-3xl font-bold text-gray-900 mt-4">
                  Inicia sesión
                </h1>

                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  Ingresa como conductor o transportador para gestionar
                  servicios, rutas y oportunidades de carga en Central Go.
                </p>
              </div>

              <form onSubmit={submitHandler}>
                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  ¿Cuál es tu correo?
                </h3>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  type="email"
                  placeholder="tu_correo@aqui.com"
                />

                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  Ingresa la contraseña
                </h3>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  type="password"
                  required
                  placeholder="Tu contraseña"
                />

                {error ? (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                ) : null}

                <button
                  type="submit"
                  className="bg-emerald-600 text-white font-semibold rounded-2xl px-4 py-3 w-full text-base transition hover:bg-emerald-700 disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading ? "Cargando..." : "Iniciar sesión"}
                </button>

                <p className="text-center text-sm text-gray-600 mt-5">
                  ¿Aún no estás registrado?{" "}
                  <Link to="/captain-signup" className="text-emerald-600 font-semibold">
                    Conviértete en transportador
                  </Link>
                </p>
              </form>
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-600">
                ¿Buscas otro tipo de acceso?{" "}
                <Link to="/" className="text-blue-600 font-semibold">
                  Volver a selección de acceso
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
