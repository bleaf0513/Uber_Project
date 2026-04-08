import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const EnterpriseDriverLogin = () => {
  const [cedula, setCedula] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    const savedDrivers = JSON.parse(
      localStorage.getItem("enterpriseDrivers") || "[]"
    );

    const matchedDriver = savedDrivers.find(
      (driver) => String(driver.cedula) === String(cedula).trim()
    );

    if (!matchedDriver) {
      alert("Esa cédula no corresponde a un conductor empresarial registrado.");
      return;
    }

    localStorage.setItem(
      "activeEnterpriseDriverCedula",
      String(matchedDriver.cedula)
    );

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
          Ingresa con tu cédula registrada por la empresa.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block text-left text-gray-700 font-semibold mb-2">
            Cédula
          </label>

          <input
            type="text"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            placeholder="Ingresa tu cédula"
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
