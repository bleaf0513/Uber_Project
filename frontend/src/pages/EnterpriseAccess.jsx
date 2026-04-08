import React from "react";
import { Link } from "react-router-dom";

const EnterpriseAccess = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-blue-700 text-white px-6 py-6 shadow-lg">
        <h1 className="text-2xl font-bold">Logística empresarial</h1>
        <p className="text-sm text-blue-100 mt-2">
          Gestiona entregas, realiza seguimiento en tiempo real y supervisa la operación logística de tu empresa.
        </p>
      </div>

      <div className="p-5 flex-1">
        <div className="bg-white rounded-3xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            ¿Qué puedes hacer aquí?
          </h2>

          <div className="mt-4 space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>📍 Seguimiento en tiempo real de conductores</p>
            <p>📦 Asignación y control de entregas</p>
            <p>🛣️ Visualización de rutas y trazabilidad</p>
            <p>📊 Estadísticas e historial operativo</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow p-5 mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Panel empresa
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Administra conductores, crea entregas, revisa estadísticas y controla toda la operación.
          </p>

          <Link
            to="/enterprise-login"
            className="mt-4 flex items-center justify-center w-full bg-blue-600 text-white py-3 rounded-2xl text-base font-semibold"
          >
            Ingresar como empresa
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow p-5">
          <h3 className="text-lg font-bold text-gray-900">
            Conductor de empresa
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Accede a tus asignaciones, inicia entregas, sigue la ruta y reporta tu ubicación.
          </p>

          <Link
            to="/enterprise-driver-login"
            className="mt-4 flex items-center justify-center w-full bg-green-600 text-white py-3 rounded-2xl text-base font-semibold"
          >
            Ingresar como conductor de empresa
          </Link>
        </div>

        <Link
          to="/"
          className="mt-5 flex items-center justify-center w-full bg-gray-200 text-gray-800 py-3 rounded-2xl text-base font-semibold"
        >
          Volver
        </Link>
      </div>
    </div>
  );
};

export default EnterpriseAccess;
