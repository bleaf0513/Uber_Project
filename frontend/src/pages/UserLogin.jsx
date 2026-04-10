import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserDataContext } from "../context/UserContext";
import { ToastContainer, toast } from "react-toastify";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";

const UserLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setUser } = React.useContext(UserDataContext);

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

    try {
      setLoading(true);

      const response = await axios.post(`${getApiBaseUrl()}/users/login`, {
        email,
        password,
      });

      if (response.status === 200) {
        const { user: userData, token } = response.data;

        if (userData && userData.email) {
          setUser(userData);
          localStorage.setItem("token", token);
          navigate("/home");
        } else {
          console.error("Invalid user data received from API");
          notify("No se pudo validar la cuenta. Intenta nuevamente.", false);
        }
      }
    } catch (error) {
      notify("Inicio de sesion fallido, correo o contrasena invalida", false);
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-6 pt-7">
          <Link to="/">
            <img className="w-40" src="/logo-centralgo.png" alt="Central Go" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-4">
                  🙋
                </div>

                <p className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-4 py-2 text-sm font-semibold">
                  Acceso para clientes
                </p>

                <h1 className="text-3xl font-bold text-gray-900 mt-4">
                  Inicia sesión
                </h1>

                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  Ingresa a tu cuenta para solicitar servicios de transporte en
                  Central Go.
                </p>
              </div>

              <form onSubmit={submitHandler}>
                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  ¿Cuál es tu correo?
                </h3>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="bg-[#f3f4f6] mb-6 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  type="password"
                  required
                  placeholder="Tu contraseña"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-black text-white font-semibold rounded-2xl px-4 py-3 w-full text-base transition hover:bg-gray-900 disabled:opacity-70"
                >
                  {loading ? "Cargando..." : "Iniciar sesión"}
                </button>

                <p className="text-center text-sm text-gray-600 mt-5">
                  ¿Nuevo aquí?{" "}
                  <Link to="/signup" className="text-blue-600 font-semibold">
                    Crea una cuenta ahora
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

export default UserLogin;
