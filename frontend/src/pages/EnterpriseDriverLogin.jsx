import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../apiBase";

const API_BASE = getApiBaseUrl();

const EnterpriseDriverLogin = () => {
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const normalizeCedula = (value) => {
    return String(value || "")
      .replace(/\./g, "")
      .replace(/-/g, "")
      .replace(/\s+/g, "")
      .trim();
  };

  const extractToken = (data) => {
    return (
      data?.token ||
      data?.driverToken ||
      data?.enterpriseDriverToken ||
      data?.accessToken ||
      data?.authToken ||
      ""
    );
  };

  const extractDriver = (data) => {
    return (
      data?.driver ||
      data?.enterpriseDriver ||
      data?.user ||
      data?.data?.driver ||
      data?.data?.enterpriseDriver ||
      data?.data?.user ||
      null
    );
  };

  const clearOldDriverSession = () => {
    localStorage.removeItem("enterpriseDriverToken");
    localStorage.removeItem("activeEnterpriseDriverCedula");
    localStorage.removeItem("activeEnterpriseDriverId");
    localStorage.removeItem("activeEnterpriseDriverData");
    localStorage.removeItem("enterpriseDeliveries");
  };

  const saveDriverSession = ({ token, driver, cleanedCedula }) => {
    const driverId = driver?._id || driver?.id || driver?.driverId || "";

    if (!token) {
      console.error("[LOGIN DRIVER] El backend no devolvió token");
      throw new Error(
        "El backend no devolvió token. Hay que revisar loginDriverByCedula en el backend."
      );
    }

    if (!driver) {
      console.error("[LOGIN DRIVER] El backend no devolvió driver");
      throw new Error(
        "El backend no devolvió los datos del conductor. Hay que revisar loginDriverByCedula."
      );
    }

    if (!driverId) {
      console.error("[LOGIN DRIVER] El conductor no tiene _id ni id:", driver);
      throw new Error(
        "El conductor no tiene ID válido. El backend debe devolver driver._id o driver.id."
      );
    }

    const normalizedDriver = {
      ...driver,
      _id: driverId,
      id: driverId,
      cedula: driver?.cedula || cleanedCedula,
    };

    localStorage.setItem("enterpriseDriverToken", token);
    localStorage.setItem("activeEnterpriseDriverId", driverId);
    localStorage.setItem(
      "activeEnterpriseDriverCedula",
      normalizedDriver.cedula || cleanedCedula
    );
    localStorage.setItem(
      "activeEnterpriseDriverData",
      JSON.stringify(normalizedDriver)
    );

    console.log("[LOGIN DRIVER] Sesión guardada correctamente:", {
      driverId,
      cedula: normalizedDriver.cedula,
      hasToken: !!token,
      driver: normalizedDriver,
    });

    return normalizedDriver;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanedCedula = normalizeCedula(cedula);

    if (!cleanedCedula) {
      alert("Por favor ingresa la cédula.");
      return;
    }

    try {
      setLoading(true);
      clearOldDriverSession();

      console.log("[LOGIN DRIVER] Intentando login", {
        apiBase: API_BASE,
        cedula: cleanedCedula,
      });

      const response = await fetch(`${API_BASE}/enterprise-drivers/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cedula: cleanedCedula,
        }),
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        console.error("[LOGIN DRIVER] Respuesta no JSON:", text);
        throw new Error(`El backend devolvió una respuesta inválida: ${text}`);
      }

      console.log("[LOGIN DRIVER] Respuesta backend:", data);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Esa cédula no corresponde a un conductor empresarial registrado."
        );
      }

      const token = extractToken(data);
      const driver = extractDriver(data);

      saveDriverSession({
        token,
        driver,
        cleanedCedula,
      });

      navigate("/enterprise-driver-panel");
    } catch (error) {
      console.error("Error en login empresarial:", error);

      alert(error.message || "No fue posible iniciar sesión con esa cédula.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-500 to-blue-700 flex flex-col justify-between">
      <div className="pt-7 px-6">
        <img className="w-48" src="/logo-centralgo.png" alt="Central Go" />
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
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-lg font-semibold disabled:opacity-70"
          >
            {loading ? "Ingresando..." : "Entrar"}
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