import React from "react";
import { Link } from "react-router-dom";

const EnterpriseDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Central Go Empresas</h1>
            <p className="text-sm text-blue-100 mt-1">
              Panel de monitoreo empresarial
            </p>
          </div>

          <Link
            to="/"
            className="bg-white text-blue-700 px-4 py-2 rounded-xl font-semibold"
          >
            Salir
          </Link>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Conductores activos
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">12</p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Rutas en curso
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">8</p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-gray-500 text-sm font-semibold">
            Servicios finalizados hoy
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-3">27</p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Mapa y seguimiento en tiempo real
          </h2>

          <div className="w-full h-96 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
            Aquí irá el mapa con tracking de conductores
          </div>
        </div>
      </div>

      <div className="px-5 pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            Conductores conectados
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span>Carlos Gómez</span>
              <span className="text-green-600 font-semibold">En ruta</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>Juan Pérez</span>
              <span className="text-yellow-600 font-semibold">Detenido</span>
            </div>
            <div className="flex justify-between">
              <span>Andrés Ruiz</span>
              <span className="text-blue-600 font-semibold">Disponible</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            Últimas rutas
          </h3>

          <div className="space-y-3">
            <div className="border-b pb-2">
              <p className="font-semibold">Ruta 001</p>
              <p className="text-sm text-gray-500">
                Centro → Itagüí · 35 min
              </p>
            </div>
            <div className="border-b pb-2">
              <p className="font-semibold">Ruta 002</p>
              <p className="text-sm text-gray-500">
                Envigado → Sabaneta · 28 min
              </p>
            </div>
            <div>
              <p className="font-semibold">Ruta 003</p>
              <p className="text-sm text-gray-500">
                Mayorista → La Estrella · 42 min
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDashboard;
