import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const EnterpriseDriverLogin = () => {
  const [driverCode, setDriverCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!driverCode.trim()) {
      alert("Ingresa tu identificador de conductor.");
      return;
    }

    localStorage.setItem("activeEnterpriseDriverId", driverCode);
    navigate("/enterprise-driver-panel");
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
          Ingreso Conductor Empresarial
        </h2>

        <p className="text-gray-600 text-center mt-2">
          Ingresa con tu identificador para ver tus entregas asignadas.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block text-left text-gray-700 font-semibold mb-2">
            ID del conductor
          </label>

          <input
            type="text"
            value={driverCode}
            onChange={(e) => setDriverCode(e.target.value)}
            placeholder="Ejemplo: 1743637382"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-6 outline-none border border-gray-200 focus:border-green-500"
          />

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-xl text-lg font-semibold"
          >
            Entrar
          </button>
        </form>

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

export default EnterpriseDriverLogin;
