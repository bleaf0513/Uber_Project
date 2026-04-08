import React from "react";
import { Link } from "react-router-dom";

const EnterpriseDrivers = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Conductores Empresariales</h1>
            <p className="text-sm text-blue-100 mt-1">
              Administra los conductores registrados por tu empresa
            </p>
          </div>

          <Link
            to="/enterprise-dashboard"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Volver
          </Link>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Registrar nuevo conductor
          </h2>

          <form className="grid grid-cols-1 gap-4">
            <input
              type="text"
              placeholder="Nombre completo"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Teléfono"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="email"
              placeholder="Correo"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Vehículo"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Placa"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <button
              type="button"
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold"
            >
              Guardar conductor
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Conductores registrados
          </h2>

          <div className="space-y-4">
            <div className="border rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">Carlos Gómez</p>
                <p className="text-sm text-gray-600">Camión NPR · ABC123</p>
              </div>
              <span className="text-green-600 font-semibold">Disponible</span>
            </div>

            <div className="border rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">Andrés Ruiz</p>
                <p className="text-sm text-gray-600">Furgón · XYZ987</p>
              </div>
              <span className="text-yellow-600 font-semibold">En ruta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDrivers;
