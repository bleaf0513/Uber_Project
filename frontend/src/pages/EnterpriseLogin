import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const EnterpriseLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submitHandler = (e) => {
    e.preventDefault();

    // Aquí después conectamos el login real con backend
    // Por ahora solo redirige al panel empresarial
    navigate("/enterprise-dashboard");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-500 to-blue-700 flex flex-col justify-between">
      <div className="pt-7 px-6">
        <img
          className="w-48"
          src="/logo-centralgo.png"
          alt="Central Go"
        />
      </div>

      <div className="bg-white rounded-t-3xl shadow-2xl px-6 py-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center">
          Panel Empresarial
        </h2>

        <p className="text-gray-600 text-center mt-2">
          Ingresa para supervisar conductores, rutas y servicios en tiempo real.
        </p>

        <form onSubmit={submitHandler} className="mt-8">
          <label className="block text-left text-gray-700 font-semibold mb-2">
            Correo empresarial
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="empresa@correo.com"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-4 outline-none border border-gray-200 focus:border-blue-500"
          />

          <label className="block text-left text-gray-700 font-semibold mb-2">
            Contraseña
          </label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-6 outline-none border border-gray-200 focus:border-blue-500"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold"
          >
            Ingresar
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            ¿Tu empresa aún no tiene acceso?
          </p>

          <Link
            to="/enterprise-signup"
            className="inline-block mt-3 text-blue-600 font-semibold"
          >
            Crear cuenta empresarial
          </Link>
        </div>

        <Link
          to="/"
          className="block text-center mt-6 text-gray-500 font-medium"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};

export default EnterpriseLogin;
