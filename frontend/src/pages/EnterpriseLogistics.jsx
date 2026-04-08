import React from "react";
import { Link } from "react-router-dom";

const EnterpriseLogistics = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de Logística</h1>
            <p className="text-sm text-blue-100 mt-1">
              Crea y asigna entregas a tus conductores
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
            Crear nueva entrega
          </h2>

          <form className="grid grid-cols-1 gap-4">
            <input
              type="text"
              placeholder="Número de factura"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Nombre del cliente"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Dirección de entrega"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              type="text"
              placeholder="Teléfono del cliente"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200">
              <option>Seleccionar conductor</option>
              <option>Carlos Gómez</option>
              <option>Andrés Ruiz</option>
            </select>

            <textarea
              placeholder="Observaciones"
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              rows="4"
            ></textarea>

            <button
              type="button"
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold"
            >
              Guardar y asignar entrega
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Entregas asignadas
          </h2>

          <div className="space-y-4">
            <div className="border rounded-xl p-4">
              <p className="font-bold text-gray-900">Factura #1001</p>
              <p className="text-sm text-gray-600">Cliente: Juan Pérez</p>
              <p className="text-sm text-gray-600">Dirección: Itagüí, Ditaires</p>
              <p className="text-sm text-blue-600 font-semibold mt-2">
                Asignado a: Carlos Gómez
              </p>
            </div>

            <div className="border rounded-xl p-4">
              <p className="font-bold text-gray-900">Factura #1002</p>
              <p className="text-sm text-gray-600">Cliente: Laura Ramírez</p>
              <p className="text-sm text-gray-600">Dirección: Sabaneta, San José</p>
              <p className="text-sm text-blue-600 font-semibold mt-2">
                Asignado a: Andrés Ruiz
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseLogistics;
