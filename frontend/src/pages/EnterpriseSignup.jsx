import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const EnterpriseSignup = () => {
  const [companyName, setCompanyName] = useState("");
  const [nit, setNit] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submitHandler = (e) => {
    e.preventDefault();

    // Luego conectamos esto al backend real
    navigate("/enterprise-login");
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
          Registro Empresarial
        </h2>

        <p className="text-gray-600 text-center mt-2">
          Crea el acceso de tu empresa a Central Go Empresas.
        </p>

        <form onSubmit={submitHandler} className="mt-8">
          <input
            required
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Nombre de la empresa"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-4 outline-none border border-gray-200 focus:border-blue-500"
          />

          <input
            required
            type="text"
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            placeholder="NIT"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-4 outline-none border border-gray-200 focus:border-blue-500"
          />

          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo empresarial"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-4 outline-none border border-gray-200 focus:border-blue-500"
          />

          <input
            required
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-4 outline-none border border-gray-200 focus:border-blue-500"
          />

          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-6 outline-none border border-gray-200 focus:border-blue-500"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold"
          >
            Crear cuenta
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">¿Ya tienes acceso?</p>

          <Link
            to="/enterprise-login"
            className="inline-block mt-3 text-blue-600 font-semibold"
          >
            Ir al login empresarial
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

export default EnterpriseSignup;
