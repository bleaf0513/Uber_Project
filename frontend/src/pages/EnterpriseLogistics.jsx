import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const EnterpriseDriverPanel = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");

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

  useEffect(() => {
    const interval = setInterval(() => {
      const savedDrivers = JSON.parse(
        localStorage.getItem("enterpriseDrivers") || "[]"
      );
      const savedDeliveries = JSON.parse(
        localStorage.getItem("enterpriseDeliveries") || "[]"
      );

      setDrivers(savedDrivers);
      setDeliveries(savedDeliveries);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const selectedDriver = useMemo(() => {
    return drivers.find((d) => String(d.id) === String(selectedDriverId));
  }, [drivers, selectedDriverId]);

  const assignedDeliveries = useMemo(() => {
    if (!selectedDriverId) return [];
    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriverId)
    );
  }, [deliveries, selectedDriverId]);

  const updateDriversStorage = (updatedDrivers) => {
    setDrivers(updatedDrivers);
    localStorage.setItem("enterpriseDrivers", JSON.stringify(updatedDrivers));
  };

  const updateDeliveriesStorage = (updatedDeliveries) => {
    setDeliveries(updatedDeliveries);
    localStorage.setItem(
      "enterpriseDeliveries",
      JSON.stringify(updatedDeliveries)
    );
  };

  const generateFakeLocationUpdate = () => {
    return {
      lat: (6.20 + Math.random() * 0.08).toFixed(6),
      lng: (-75.60 + Math.random() * 0.08).toFixed(6),
    };
  };

  const handleStartDelivery = (deliveryId) => {
    if (!selectedDriver) return;

    const updatedDeliveries = deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "En curso",
            startedAt: new Date().toISOString(),
          }
        : delivery
    );

    updateDeliveriesStorage(updatedDeliveries);

    const updatedDrivers = drivers.map((driver) =>
      driver.id === selectedDriver.id
        ? {
            ...driver,
            status: "En ruta",
            currentLocation: generateFakeLocationUpdate(),
          }
        : driver
    );

    updateDriversStorage(updatedDrivers);

    alert("Entrega iniciada. Aquí luego mostraremos la ruta inteligente.");
  };

  const handleFinishDelivery = (deliveryId) => {
    if (!selectedDriver) return;

    const updatedDeliveries = deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: "Finalizada",
            finishedAt: new Date().toISOString(),
          }
        : delivery
    );

    updateDeliveriesStorage(updatedDeliveries);

    const hasOtherInProgress = updatedDeliveries.some(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id) &&
        delivery.status === "En curso"
    );

    const updatedDrivers = drivers.map((driver) =>
      driver.id === selectedDriver.id
        ? {
            ...driver,
            status: hasOtherInProgress ? "En ruta" : "Disponible",
            currentLocation: generateFakeLocationUpdate(),
          }
        : driver
    );

    updateDriversStorage(updatedDrivers);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel del Conductor</h1>
            <p className="text-sm text-blue-100 mt-1">
              Inicia y finaliza entregas asignadas
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
            Seleccionar conductor
          </h2>

          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none border border-gray-200"
          >
            <option value="">Selecciona un conductor</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - {driver.vehicle} - {driver.plate}
              </option>
            ))}
          </select>

          {selectedDriver && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
              <p className="text-sm text-gray-600">
                Estado: {selectedDriver.status || "Disponible"}
              </p>
              <p className="text-sm text-gray-600">
                Ubicación:
                {" "}
                {selectedDriver.currentLocation
                  ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                  : "Aún no reportada"}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Ruta inteligente del conductor
          </h2>

          <div className="w-full h-80 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
            Aquí irá el mapa con la ruta optimizada por cercanía
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pedidos asignados
          </h2>

          {assignedDeliveries.length === 0 ? (
            <p className="text-gray-500">
              Este conductor no tiene pedidos asignados.
            </p>
          ) : (
            <div className="space-y-4">
              {assignedDeliveries.map((delivery) => (
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

                  <div className="flex gap-3 mt-4">
                    {delivery.status === "Pendiente" && (
                      <button
                        type="button"
                        onClick={() => handleStartDelivery(delivery.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        Iniciar entrega
                      </button>
                    )}

                    {delivery.status === "En curso" && (
                      <button
                        type="button"
                        onClick={() => handleFinishDelivery(delivery.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        Finalizar entrega
                      </button>
                    )}
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

export default EnterpriseDriverPanel;
