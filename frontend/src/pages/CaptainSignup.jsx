import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { getApiBaseUrl, getApiHintOrigin } from "../apiBase";

const MAX_FILE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 1200;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.72);

        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error("No se pudo cargar la imagen."));
      };

      img.src = reader.result;
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer el archivo."));
    };

    reader.readAsDataURL(file);
  });
};

const validateImageFile = (file, label) => {
  if (!file) {
    throw new Error(`Debes subir la foto de ${label}.`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`${label} debe ser una imagen JPG, PNG o WEBP.`);
  }

  const sizeMb = file.size / (1024 * 1024);

  if (sizeMb > MAX_FILE_MB) {
    throw new Error(`${label} no puede pesar más de ${MAX_FILE_MB} MB.`);
  }
};

const CaptainSignup = () => {
  const [firstname, setFirstName] = useState("");
  const [lastname, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  const [drivingLicenseFile, setDrivingLicenseFile] = useState(null);
  const [vehicleRegistrationFile, setVehicleRegistrationFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [applicationSent, setApplicationSent] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setVehicleColor("");
    setVehiclePlate("");
    setVehicleCapacity("");
    setVehicleType("");
    setDrivingLicenseFile(null);
    setVehicleRegistrationFile(null);
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      validateImageFile(drivingLicenseFile, "la licencia de conducción");
      validateImageFile(vehicleRegistrationFile, "la matrícula o tarjeta de propiedad");

      setSubmitting(true);

      const drivingLicenseImage = await fileToBase64(drivingLicenseFile);
      const vehicleRegistrationImage = await fileToBase64(vehicleRegistrationFile);

      const captainData = {
        fullname: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
        },
        email: email.trim().toLowerCase(),
        password,
        vehicle: {
          color: vehicleColor.trim(),
          plate: vehiclePlate.trim().toUpperCase(),
          capacity: Number(vehicleCapacity),
          vehicleType,
        },
        documents: {
          drivingLicenseImage,
          vehicleRegistrationImage,
        },
      };

      const response = await axios.post(
        `${getApiBaseUrl()}/captain/register`,
        captainData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 201 && response.data?.success) {
        resetForm();
        setApplicationSent(true);

        toast.success(
          response.data?.message ||
            "Solicitud enviada correctamente. Un administrador la revisará."
        );
      }
    } catch (err) {
      const isOffline =
        err.code === "ERR_NETWORK" ||
        err.message === "Network Error" ||
        (typeof err.message === "string" &&
          err.message.toLowerCase().includes("network"));

      if (isOffline) {
        toast.error(
          `No se puede conectar con la API (${getApiHintOrigin()}). Revisa que el backend esté activo.`
        );
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          (Array.isArray(err.response?.data?.errors) &&
            err.response.data.errors[0]?.msg) ||
          err.message ||
          "Error al enviar la solicitud.";

        toast.error(typeof msg === "string" ? msg : "Error al enviar la solicitud.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="px-6 pt-7">
          <Link to="/">
            <img
              className="w-40"
              src="/logo-centralgo.png"
              alt="Central Go"
            />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-xl">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">
                  🚚
                </div>

                <p className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold">
                  Solicitud para transportadores
                </p>

                <h1 className="text-3xl font-bold text-gray-900 mt-4">
                  Solicita tu activación
                </h1>

                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  Regístrate como conductor o transportador. Tu solicitud será
                  revisada por el equipo de Central Go antes de activar tu cuenta.
                </p>
              </div>

              {applicationSent ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl text-white">
                    ✓
                  </div>

                  <h2 className="text-2xl font-bold text-emerald-900">
                    Solicitud enviada
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-emerald-800">
                    Tu información quedó pendiente de revisión. Cuando el equipo
                    de Central Go apruebe tu solicitud, podrás iniciar sesión como
                    conductor.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/captain-login"
                      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white"
                    >
                      Ir al login
                    </Link>

                    <button
                      type="button"
                      onClick={() => setApplicationSent(false)}
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-semibold text-emerald-700"
                    >
                      Enviar otra solicitud
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitHandler}>
                  <h3 className="text-base mb-2 font-semibold text-gray-800">
                    ¿Cómo quieres que te llamemos?
                  </h3>

                  <div className="flex gap-3 mb-5">
                    <input
                      value={firstname}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      type="text"
                      placeholder="Nombre"
                    />

                    <input
                      value={lastname}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      type="text"
                      placeholder="Apellido"
                    />
                  </div>

                  <h3 className="text-base mb-2 font-semibold text-gray-800">
                    ¿Cuál es tu correo?
                  </h3>

                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    type="email"
                    placeholder="tu_correo@aqui.com"
                  />

                  <h3 className="text-base mb-2 font-semibold text-gray-800">
                    Crea una contraseña
                  </h3>

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#f3f4f6] mb-5 rounded-2xl px-4 py-3 border border-gray-200 w-full text-base outline-none focus:ring-2 focus:ring-emerald-500"
                    type="password"
                    required
                    placeholder="Tu contraseña"
                  />

                  <h3 className="text-base mb-2 font-semibold text-gray-800">
                    Información del vehículo
                  </h3>

                  <div className="flex gap-3 mb-4">
                    <input
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      type="text"
                      placeholder="Color del vehículo"
                    />

                    <input
                      value={vehiclePlate}
                      onChange={(e) =>
                        setVehiclePlate(e.target.value.toUpperCase())
                      }
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      type="text"
                      placeholder="Placa"
                    />
                  </div>

                  <div className="flex gap-3 mb-6">
                    <input
                      value={vehicleCapacity}
                      onChange={(e) => setVehicleCapacity(e.target.value)}
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                      type="number"
                      min="1"
                      placeholder="Capacidad"
                    />

                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="bg-[#f3f4f6] rounded-2xl px-4 py-3 border border-gray-200 text-base w-1/2 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="" disabled>
                        Selecciona el tipo
                      </option>
                      <option value="motorcycle">Moto</option>
                      <option value="car">Carro</option>
                      <option value="light_cargo">Carga liviana</option>
                      <option value="van">Furgón / camioneta</option>
                      <option value="truck">Camión</option>
                    </select>
                  </div>

                  <h3 className="text-base mb-2 font-semibold text-gray-800">
                    Documentos obligatorios
                  </h3>

                  <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Foto de la licencia de conducción
                    </label>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        setDrivingLicenseFile(e.target.files?.[0] || null)
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
                      required
                    />

                    {drivingLicenseFile ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        Archivo seleccionado: {drivingLicenseFile.name}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">
                        Formatos permitidos: JPG, PNG o WEBP. Máximo {MAX_FILE_MB} MB.
                      </p>
                    )}
                  </div>

                  <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Foto de la matrícula o tarjeta de propiedad
                    </label>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        setVehicleRegistrationFile(e.target.files?.[0] || null)
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
                      required
                    />

                    {vehicleRegistrationFile ? (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        Archivo seleccionado: {vehicleRegistrationFile.name}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">
                        Formatos permitidos: JPG, PNG o WEBP. Máximo {MAX_FILE_MB} MB.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 text-white font-semibold rounded-2xl px-4 py-3 w-full text-base transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {submitting ? "Enviando solicitud..." : "Enviar solicitud"}
                  </button>

                  <p className="text-center text-sm text-gray-600 mt-5">
                    ¿Ya tienes cuenta aprobada?{" "}
                    <Link
                      to="/captain-login"
                      className="text-emerald-600 font-semibold"
                    >
                      Inicia sesión aquí
                    </Link>
                  </p>
                </form>
              )}
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-600">
                ¿Buscas otro tipo de acceso?{" "}
                <Link to="/" className="text-blue-600 font-semibold">
                  Volver a selección de acceso
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </>
  );
};

export default CaptainSignup;