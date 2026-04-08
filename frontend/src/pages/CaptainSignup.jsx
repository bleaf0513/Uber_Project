import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
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
        firstname: firstname,
        lastname: lastname,
      },
      email: email,
      password: password,
      vehicle: {
        color: vehicleColor,
        plate: vehiclePlate,
        capacity: vehicleCapacity,
        vehicleType: vehicleType,
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
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
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
    <div className="flex flex-col justify-between h-screen">
      <div>
        <div className="ml-6 pt-5 pb-2.5">
          <Link to="/">
            <img
              className="w-40"
  src="/logo-centralgo.png"
              alt="logo"
            />
          </Link>
        </div>

        <div className="px-6 pt-6">
          <form
            onSubmit={(e) => {
              submitHandler(e);
            }}
          >
            <h3 className="text-base mb-2 font-semibold">
              Como quieres que te llamemos?
            </h3>
            <div className="flex gap-3 mb-4">
              <input
                value={firstname}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-base placeholder:text-base  placeholder:ml-2 w-1/2"
                required
                type="text"
                placeholder="Nombre"
              />
              <input
                value={lastname}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-base placeholder:text-base  placeholder:ml-2 w-1/2"
                required
                type="text"
                placeholder="Apellido"
              />
            </div>

            <h3 className="text-base mb-2 font-semibold">Cual es tu correo?</h3>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#ededed] mb-4 rounded-lg px-4 py-2 border w-full text-base placeholder:text-base  placeholder:ml-2"
              required
              type="email"
              placeholder="tu_correo@aqui.com"
            />
            <h3 className="text-base mb-2 font-semibold">Ingresa la contrasena</h3>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#ededed] mb-4 rounded-lg px-4 py-2 border w-full text-base placeholder:text-base  placeholder:ml-2"
              type="password"
              required
              placeholder="tuContrasena"
            />
            <h3 className="text-base mb-2 font-semibold">
              Informacion del vehiculo
            </h3>
            <div className="flex gap-3 mb-5">
              <input
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-lg placeholder:text-base  placeholder:ml-2 w-1/2"
                required
                type="text"
                placeholder="Color del vehiculo"
              />
              <input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-lg placeholder:text-base  placeholder:ml-2 w-1/2"
                required
                type="text"
                placeholder="Placa del vehiculo"
              />
            </div>
            <div className="flex gap-3 mb-10">
              <input
                value={vehicleCapacity}
                onChange={(e) => setVehicleCapacity(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-lg placeholder:text-base  placeholder:ml-2 w-1/2"
                required
                type="number"
                placeholder="Capacidad del vehiculo"
              />
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="bg-[#ededed] rounded-lg px-4 py-2 border text-base placeholder:text-base  placeholder:ml-2 w-1/2"
                required
              >
                <option value="" disabled>
                  Selecciona tipo de vehiculo
                </option>
                <option value="car">Auto</option>
                <option value="auto">Auto</option>
                <option value="motorcycle">Motocicleta</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-black text-white font-semibold mb-3 rounded-lg px-4 py-3 border w-full text-lg mt-2 disabled:opacity-60"
            >
              {submitting ? "Creando..." : "Crear cuenta"}
            </button>
            <p className="text-center">
              Ya eres capitan?{" "}
              <Link to="/captain-login" className="text-blue-600">
                Inicia sesion aqui.
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CaptainSignup;
