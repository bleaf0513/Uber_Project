import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle: "",
    plate: "",
  });

  useEffect(() => {
    const savedDrivers = localStorage.getItem("enterpriseDrivers");
    if (savedDrivers) {
      setDrivers(JSON.parse(savedDrivers));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveDriver = (e) => {
    e.preventDefault();

    const { name, phone, email, vehicle, plate } = formData;

    if (!name || !phone || !email || !vehicle || !plate) {
      alert("Por favor completa todos los campos del conductor.");
      return;
    }

    const newDriver = {
      id: Date.now(),
      name,
      phone,
      email,
      vehicle,
      plate,
      status: "Disponible",
    };

    const updatedDrivers = [...drivers, newDriver];
    setDrivers(updatedDrivers);
    localStorage.setItem("enterpriseDrivers", JSON.stringify(updatedDrivers));

    setFormData({
      name: "",
      phone: "",
      email: "",
      vehicle: "",
      plate: "",
    });

    alert("Conductor guardado correctamente.");
  };

  const handleDeleteDriver = (id) => {
    const updatedDrivers = drivers.filter((driver) => driver.id !== id);
    setDrivers(updatedDrivers);
    localStorage.setItem("enterpriseDrivers", JSON.stringify(updatedDrivers));
  };

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

          <form onSubmit={handleSaveDriver} className="grid grid-cols-1 gap-4">
            <input
              name="name"
              type="text"
              placeholder="Nombre completo"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="phone"
              type="text"
              placeholder="Teléfono"
              value={formData.phone}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="email"
              type="email"
              placeholder="Correo"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="vehicle"
              type="text"
              placeholder="Vehículo"
              value={formData.vehicle}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="plate"
              type="text"
              placeholder="Placa"
              value={formData.plate}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <button
              type="submit"
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

          {drivers.length === 0 ? (
            <p className="text-gray-500">
              Aún no hay conductores registrados.
            </p>
          ) : (
            <div className="space-y-4">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="border rounded-xl p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-gray-900">{driver.name}</p>
                    <p className="text-sm text-gray-600">
                      {driver.vehicle} · {driver.plate}
                    </p>
                    <p className="text-sm text-gray-500">{driver.phone}</p>
                    <p className="text-sm text-gray-500">{driver.email}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-green-600 font-semibold">
                      {driver.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteDriver(driver.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDrivers;
