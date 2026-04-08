import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseLogistics = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    address: "",
    clientPhone: "",
    assignedDriverId: "",
    notes: "",
  });

  useEffect(() => {
    const loadData = () => {
      const savedDrivers = JSON.parse(
        localStorage.getItem("enterpriseDrivers") || "[]"
      );
      const savedDeliveries = JSON.parse(
        localStorage.getItem("enterpriseDeliveries") || "[]"
      );

      setDrivers(savedDrivers);
      setDeliveries(savedDeliveries);
    };

    loadData();

    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
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
      startedAt: null,
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

  const selectedDriver = useMemo(() => {
    return drivers.find(
      (driver) => String(driver.id) === String(selectedDriverFilter)
    );
  }, [drivers, selectedDriverFilter]);

  const filteredDeliveries = useMemo(() => {
    if (!selectedDriverFilter) return deliveries;

    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriverFilter)
    );
  }, [deliveries, selectedDriverFilter]);

  const stats = useMemo(() => {
    return {
      pending: filteredDeliveries.filter((d) => d.status === "Pendiente").length,
      inProgress: filteredDeliveries.filter((d) => d.status === "En curso").length,
      finished: filteredDeliveries.filter((d) => d.status === "Finalizada").length,
    };
  }, [filteredDeliveries]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de Logística</h1>
            <p className="text-sm text-blue-100 mt-1">
              Asigna pedidos y supervisa conductores en operación
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
                  {driver.name} - CC {driver.cedula} - {driver.vehicle}
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

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Supervisar por conductor
          </h2>

          <select
            value={selectedDriverFilter}
            onChange={(e) => setSelectedDriverFilter(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          >
            <option value="">Ver todos los conductores</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - CC {driver.cedula} - {driver.vehicle}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">En curso</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.inProgress}
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">Finalizadas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.finished}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Ubicación del conductor
          </h2>

          {selectedDriver ? (
            <>
              <div className="mb-4">
                <p className="font-semibold text-gray-900">
                  {selectedDriver.name}
                </p>
                <p className="text-sm text-gray-600">
                  Cédula: {selectedDriver.cedula}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedDriver.vehicle} · {selectedDriver.plate}
                </p>
                <p className="text-sm text-gray-600">
                  Estado: {selectedDriver.status || "Disponible"}
                </p>
                <p className="text-sm text-gray-600">
                  Ubicación:{" "}
                  {selectedDriver.currentLocation
                    ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                    : "Aún no reportada"}
                </p>
              </div>

              <div className="w-full h-80 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
                Aquí irá el mapa en tiempo real del conductor
              </div>
            </>
          ) : (
            <div className="w-full h-52 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-semibold">
              Selecciona un conductor para ver su ubicación y sus pedidos
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pedidos asignados
          </h2>

          {filteredDeliveries.length === 0 ? (
            <p className="text-gray-500">No hay pedidos para este filtro.</p>
          ) : (
            <div className="space-y-4">
              {filteredDeliveries.map((delivery) => (
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

                  <p className="text-sm mt-2">
                    Estado:{" "}
                    <span
                      className={
                        delivery.status === "Finalizada"
                          ? "text-green-600 font-semibold"
                          : delivery.status === "En curso"
                          ? "text-blue-600 font-semibold"
                          : "text-yellow-600 font-semibold"
                      }
                    >
                      {delivery.status}
                    </span>
                  </p>

                  {delivery.startedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Inicio: {new Date(delivery.startedAt).toLocaleString()}
                    </p>
                  )}

                  {delivery.finishedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Finalizó: {new Date(delivery.finishedAt).toLocaleString()}
                    </p>
                  )}

                  {delivery.notes ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Observaciones: {delivery.notes}
                    </p>
                  ) : null}

                  <div className="flex justify-end mt-3">
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
