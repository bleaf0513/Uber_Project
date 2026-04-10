import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { getApiBaseUrl, getApiHintOrigin } from "../apiBase";

const CaptainSignup = () => {
  const [firstname, setFirstName] = useState("");
  const [lastname, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();

    const captainData = {
      fullname: {
        firstname,
        lastname,
      },
      email,
      password,
      vehicle: {
        color: vehicleColor,
        plate: vehiclePlate,
        capacity: vehicleCapacity,
        vehicleType,
      },
    };

    setSubmitting(true);

    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/captain/register`,
        captainData
      );

      if (response.status === 201 && response.data?.token) {
        localStorage.setItem("token", response.data.token);

        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setVehicleColor("");
        setVehiclePlate("");
        setVehicleCapacity("");
        setVehicleType("");

        navigate("/captain-home");
      }
    } catch (err) {
      const isOffline =
        err.code === "ERR_NETWORK" ||
        err.message === "Network Error" ||
        (typeof err.message === "string" &&
          err.message.toLowerCase().includes("network"));

      if (isOffline) {
        toast.error(
          `No se puede conectar con la API (${getApiHintOrigin()}). Inicia el backend en otra terminal: cd backend -> npm run dev:memory y luego recarga esta pagina.`
        );
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          (Array.isArray(err.response?.data?.errors) &&
            err.response.data.errors[0]?.msg) ||
          err.message ||
          "Error al registrarse.";

        toast.error(typeof msg === "string" ? msg : "Error al registrarse.");
      }
    } finally {
      setSubmitting(false);
    }
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
          <div className="w-full max-w-xl">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">
                  🚚
                </div>

                <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
                  Registro para transportadores
                </p>

                <h1 className="text-3xl font-bold text-gray-900 mt-4">
                  Crea tu cuenta
                </h1>

                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  Regístrate como conductor o transportador para recibir
                  servicios y operar dentro de Central Go.
                </p>
              </div>

              <form onSubmit={submitHandler}>
                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  ¿Cómo quieres que te llamemos?
                </h3>

                <div className="flex gap-3 mb-5">
                  <input
                    value={firstname}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="text"
                    placeholder="Nombre"
                  />
                  <input
                    value={lastname}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="text"
                    placeholder="Apellido"
                  />
                </div>

                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  ¿Cuál es tu correo?
                </h3>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  type="email"
                  placeholder="tu_correo@aqui.com"
                />

                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  Crea una contraseña
                </h3>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base outline-none focus:ring-2 focus:ring-emerald-500"
                  type="password"
                  required
                  placeholder="Tu contraseña"
                />

                <h3 className="text-base mb-2 font-semibold text-gray-800">
                  Información del vehículo
                </h3>

                <div className="flex gap-3 mb-4">
                  <input
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="text"
                    placeholder="Color del vehículo"
                  />
                  <input
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="text"
                    placeholder="Placa"
                  />
                </div>

                <div className="flex gap-3 mb-6">
                  <input
                    value={vehicleCapacity}
                    onChange={(e) => setVehicleCapacity(e.target.value)}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="number"
                    min="1"
                    placeholder="Capacidad"
                  />

                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="" disabled>
                      Selecciona el tipo
                    </option>
                    <option value="motorcycle">Moto</option>
<option value="car">Carro</option>
<option value="light_cargo">Carga liviana</option>
<option value="van">Furgón / camioneta</option>
<option value="truck">Camión</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 text-white font-semibold rounded-2xl px-4 py-3 w-full text-base transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Creando..." : "Crear cuenta"}
                </button>

                <p className="text-center text-sm text-gray-600 mt-5">
                  ¿Ya tienes cuenta?{" "}
                  <Link to="/captain-login" className="text-emerald-600 font-semibold">
                    Inicia sesión aquí
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

export default CaptainSignup;
