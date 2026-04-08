import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const EnterpriseDriverPanel = () => {
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [activeCedula, setActiveCedula] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedCedula =
      localStorage.getItem("activeEnterpriseDriverCedula") || "";
    setActiveCedula(savedCedula);

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

  const selectedDriver = useMemo(() => {
    return drivers.find(
      (driver) => String(driver.cedula) === String(activeCedula)
    );
  }, [drivers, activeCedula]);

  const assignedDeliveries = useMemo(() => {
    if (!selectedDriver) return [];
    return deliveries.filter(
      (delivery) =>
        String(delivery.assignedDriverId) === String(selectedDriver.id)
    );
  }, [deliveries, selectedDriver]);

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

  const handleLogout = () => {
    localStorage.removeItem("activeEnterpriseDriverCedula");
    navigate("/enterprise-driver-login");
  };

  if (!activeCedula) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Sesión no válida
          </h2>
          <p className="text-gray-600 mt-3">
            Debes ingresar con tu cédula desde el acceso de conductor.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Ir al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Conductor no encontrado
          </h2>
          <p className="text-gray-600 mt-3">
            La cédula ingresada no está asociada a un conductor activo.
          </p>
          <Link
            to="/enterprise-driver-login"
            className="inline-block mt-5 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Volver al login del conductor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-700 text-white px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel del Conductor</h1>
            <p className="text-sm text-green-100 mt-1">
              Bienvenido, {selectedDriver.name}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="bg-white text-green-700 px-4 py-2 rounded-xl font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Tus datos
          </h2>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{selectedDriver.name}</p>
            <p className="text-sm text-gray-600">
              Cédula: {selectedDriver.cedula}
            </p>
            <p className="text-sm text-gray-600">
              Estado: {selectedDriver.status || "Disponible"}
            </p>
            <p className="text-sm text-gray-600">
              Vehículo: {selectedDriver.vehicle} · {selectedDriver.plate}
            </p>
            <p className="text-sm text-gray-600">
              Ubicación:{" "}
              {selectedDriver.currentLocation
                ? `${selectedDriver.currentLocation.lat}, ${selectedDriver.currentLocation.lng}`
                : "Aún no reportada"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Tu ruta
          </h2>

          <div className="w-full h-80 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
            Aquí irá el mapa con tu ruta optimizada
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Tus pedidos asignados
          </h2>

          {assignedDeliveries.length === 0 ? (
            <p className="text-gray-500">
              No tienes pedidos asignados en este momento.
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

                  {delivery.notes ? (
                    <p className="text-sm text-gray-500 mt-1">
                      Observaciones: {delivery.notes}
                    </p>
                  ) : null}

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
