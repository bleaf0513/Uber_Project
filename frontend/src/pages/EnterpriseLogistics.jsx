import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseLogistics = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    address: "",
    clientPhone: "",
    assignedDriverId: "",
    notes: "",
  });

  useEffect(() => {
    const savedDrivers = JSON.parse(
      localStorage.getItem("enterpriseDrivers") || "[]"
    );
    const savedDeliveries = JSON.parse(
      localStorage.getItem("enterpriseDeliveries") || "[]"
    );

    setDrivers(savedDrivers);
    setDeliveries(savedDeliveries);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveDelivery = (e) => {
    e.preventDefault();

    const {
      invoiceNumber,
      clientName,
      address,
      clientPhone,
      assignedDriverId,
      notes,
    } = formData;

    if (
      !invoiceNumber ||
      !clientName ||
      !address ||
      !clientPhone ||
      !assignedDriverId
    ) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => String(driver.id) === String(assignedDriverId)
    );

    if (!selectedDriver) {
      alert("Debes seleccionar un conductor válido.");
      return;
    }

    const newDelivery = {
      id: Date.now(),
      invoiceNumber,
      clientName,
      address,
      clientPhone,
      assignedDriverId: selectedDriver.id,
      assignedDriverName: selectedDriver.name,
      notes,
      status: "Pendiente",
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };

    const updatedDeliveries = [...deliveries, newDelivery];
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );

    setFormData({
      invoiceNumber: "",
      clientName: "",
      address: "",
      clientPhone: "",
      assignedDriverId: "",
      notes: "",
    });

    alert("Entrega guardada y asignada correctamente.");
  };

  const handleDeleteDelivery = (id) => {
    const updatedDeliveries = deliveries.filter((delivery) => delivery.id !== id);
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

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

          <form onSubmit={handleSaveDelivery} className="grid grid-cols-1 gap-4">
            <input
              name="invoiceNumber"
              type="text"
              placeholder="Número de factura"
              value={formData.invoiceNumber}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="clientName"
              type="text"
              placeholder="Nombre del cliente"
              value={formData.clientName}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="address"
              type="text"
              placeholder="Dirección de entrega"
              value={formData.address}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <input
              name="clientPhone"
              type="text"
              placeholder="Teléfono del cliente"
              value={formData.clientPhone}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            />

            <select
              name="assignedDriverId"
              value={formData.assignedDriverId}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
            >
              <option value="">Seleccionar conductor</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} - {driver.vehicle} - {driver.plate}
                </option>
              ))}
            </select>

            <textarea
              name="notes"
              placeholder="Observaciones"
              value={formData.notes}
              onChange={handleChange}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
              rows="4"
            ></textarea>

            <button
              type="submit"
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

          {deliveries.length === 0 ? (
            <p className="text-gray-500">Aún no hay entregas asignadas.</p>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="border rounded-xl p-4">
                  <p className="font-bold text-gray-900">
                    Factura #{delivery.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cliente: {delivery.clientName}
                  </p>
                  <p className="text-sm text-gray-600">
                    Dirección: {delivery.address}
                  </p>
                  <p className="text-sm text-gray-600">
                    Teléfono: {delivery.clientPhone}
                  </p>
                  <p className="text-sm text-blue-600 font-semibold mt-2">
                    Asignado a: {delivery.assignedDriverName}
                  </p>
                  {delivery.notes ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Observaciones: {delivery.notes}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-yellow-600 font-semibold">
                      {delivery.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDelivery(delivery.id)}
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

export default EnterpriseLogistics;
