import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const EnterpriseSignup = () => {
  const [companyName, setCompanyName] = useState("");
  const [nit, setNit] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const parseJsonSafe = async (response, label = "API") => {
    const text = await response.text();
    console.log(`${label} raw response:`, text);

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `La API no devolvió JSON. Revisa VITE_BASE_URL o la ruta backend. Respuesta: ${text.slice(
          0,
          150
        )}`
      );
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!companyName || !nit || !email || !phone || !password) {
      alert("Completa todos los campos.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/enterprise/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          companyName: companyName.trim(),
          nit: nit.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      });

      const data = await parseJsonSafe(response, "POST /enterprise/signup");

      if (!response.ok) {
        throw new Error(data.message || "No se pudo crear la cuenta.");
      }

      alert("Cuenta empresarial creada correctamente.");
      navigate("/enterprise-login");
    } catch (error) {
      console.error("Error en registro empresarial:", error);
      alert(error.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold disabled:opacity-70"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
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
