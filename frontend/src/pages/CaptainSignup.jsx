import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  toast,
  ToastContainer,
} from "react-toastify";

import {
  getApiBaseUrl,
  getApiHintOrigin,
} from "../apiBase";

const MAX_FILE_MB = 8;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const VEHICLE_OPTIONS = [
  {
    value: "motorcycle",
    label: "Moto",
    minKg: 1,
    maxKg: 120,
  },
  {
    value: "car",
    label: "Carro",
    minKg: 121,
    maxKg: 300,
  },
  {
    value: "motocarro",
    label: "Motocarro",
    minKg: 301,
    maxKg: 700,
  },
  {
    value: "pickup",
    label: "Pickup",
    minKg: 701,
    maxKg: 1000,
  },
  {
    value: "van",
    label: "Van / furgón pequeño",
    minKg: 1001,
    maxKg: 1500,
  },
  {
    value: "light_truck",
    label: "Camión liviano",
    minKg: 1501,
    maxKg: 3500,
  },
  {
    value: "medium_truck",
    label: "Camión mediano",
    minKg: 3501,
    maxKg: 10000,
  },
  {
    value: "heavy_truck",
    label: "Camión pesado",
    minKg: 10001,
    maxKg: 17000,
  },
  {
    value: "simple_truck",
    label: "Camión sencillo",
    minKg: 7000,
    maxKg: 10000,
  },
  {
    value: "double_troque",
    label: "Doble troque",
    minKg: 10001,
    maxKg: 17000,
  },
  {
    value: "dump_truck",
    label: "Volqueta",
    minKg: 5000,
    maxKg: 25000,
  },
  {
    value: "mini_trailer",
    label: "Minimula",
    minKg: 17001,
    maxKg: 24000,
  },
  {
    value: "tractor_trailer",
    label: "Tractomula",
    minKg: 24001,
    maxKg: 35000,
  },
  {
    value: "lowboy",
    label: "Cama baja",
    minKg: 20000,
    maxKg: 60000,
  },
  {
    value: "special_vehicle",
    label: "Vehículo especial",
    minKg: 1,
    maxKg: Number.MAX_SAFE_INTEGER,
  },
];

const BODY_OPTIONS = [
  {
    value: "not_specified",
    label: "No especificada",
  },
  {
    value: "closed_van",
    label: "Furgón cerrado",
  },
  {
    value: "stakes",
    label: "Estacas",
  },
  {
    value: "platform",
    label: "Plataforma",
  },
  {
    value: "refrigerated",
    label: "Refrigerada",
  },
  {
    value: "dump",
    label: "Volco / volqueta",
  },
  {
    value: "tank",
    label: "Tanque",
  },
  {
    value: "container_carrier",
    label: "Portacontenedor",
  },
  {
    value: "lowboy",
    label: "Cama baja",
  },
  {
    value: "open_body",
    label: "Carrocería abierta",
  },
  {
    value: "other",
    label: "Otra",
  },
];

const STEPS = [
  {
    number: 1,
    label: "Datos",
  },
  {
    number: 2,
    label: "Vehículo",
  },
  {
    number: 3,
    label: "Documentos",
  },
  {
    number: 4,
    label: "Confirmar",
  },
];

const formatKg = (value) =>
  new Intl.NumberFormat("es-CO").format(
    Number(value) || 0
  );

const capacityToKg = (
  capacity,
  unit
) => {
  const numericValue =
    Number(capacity) || 0;

  return unit === "ton"
    ? numericValue * 1000
    : numericValue;
};

const suggestVehicle = (
  capacityKg
) => {
  if (!capacityKg) {
    return null;
  }

  if (capacityKg <= 120) {
    return VEHICLE_OPTIONS[0];
  }

  if (capacityKg <= 300) {
    return VEHICLE_OPTIONS[1];
  }

  if (capacityKg <= 700) {
    return VEHICLE_OPTIONS[2];
  }

  if (capacityKg <= 1000) {
    return VEHICLE_OPTIONS[3];
  }

  if (capacityKg <= 1500) {
    return VEHICLE_OPTIONS[4];
  }

  if (capacityKg <= 3500) {
    return VEHICLE_OPTIONS[5];
  }

  if (capacityKg <= 10000) {
    return VEHICLE_OPTIONS[6];
  }

  if (capacityKg <= 17000) {
    return VEHICLE_OPTIONS[7];
  }

  if (capacityKg <= 24000) {
    return VEHICLE_OPTIONS[11];
  }

  return VEHICLE_OPTIONS[12];
};

const fileToBase64 = (
  file
) =>
  new Promise(
    (resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }

      const reader =
        new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const maxWidth = 1400;
          const maxHeight = 1400;

          let width = image.width;
          let height = image.height;

          if (
            width > maxWidth ||
            height > maxHeight
          ) {
            const ratio = Math.min(
              maxWidth / width,
              maxHeight / height
            );

            width = Math.round(
              width * ratio
            );

            height = Math.round(
              height * ratio
            );
          }

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width = width;
          canvas.height = height;

          const context =
            canvas.getContext("2d");

          if (!context) {
            reject(
              new Error(
                "No se pudo procesar la imagen."
              )
            );
            return;
          }

          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.76
            )
          );
        };

        image.onerror = () => {
          reject(
            new Error(
              "No se pudo cargar la imagen."
            )
          );
        };

        image.src = reader.result;
      };

      reader.onerror = () => {
        reject(
          new Error(
            "No se pudo leer el archivo."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );

const validateImageFile = (
  file,
  label
) => {
  if (!file) {
    throw new Error(
      `Debes subir ${label}.`
    );
  }

  if (
    !ALLOWED_TYPES.includes(
      file.type
    )
  ) {
    throw new Error(
      `${label} debe ser JPG, PNG o WEBP.`
    );
  }

  const sizeMb =
    file.size /
    (1024 * 1024);

  if (sizeMb > MAX_FILE_MB) {
    throw new Error(
      `${label} no puede pesar más de ${MAX_FILE_MB} MB.`
    );
  }
};

const DocumentCard = ({
  title,
  description,
  file,
  onChange,
}) => (
  <label className="block rounded-[22px] border border-gray-200 bg-gray-50 p-4 cursor-pointer transition active:scale-[0.99]">
    <div className="flex items-start gap-3">
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          file
            ? "bg-emerald-100 text-emerald-700"
            : "bg-white text-gray-500 border border-gray-200"
        }`}
      >
        <i
          className={
            file
              ? "ri-checkbox-circle-line text-xl"
              : "ri-camera-line text-xl"
          }
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-950">
          {title}
        </p>

        <p className="text-xs text-gray-500 mt-1 leading-5">
          {description}
        </p>

        <div
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${
            file
              ? "bg-emerald-50 text-emerald-700"
              : "bg-white border border-gray-200 text-purple-700"
          }`}
        >
          {file
            ? `Imagen lista: ${file.name}`
            : "Tomar foto o seleccionar imagen"}
        </div>
      </div>
    </div>

    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      capture="environment"
      className="hidden"
      onChange={(event) =>
        onChange(
          event.target.files?.[0] ||
            null
        )
      }
    />
  </label>
);

const CaptainSignup = () => {
  const [step, setStep] =
    useState(1);

  const [firstname, setFirstName] =
    useState("");

  const [lastname, setLastName] =
    useState("");

  const [
    identificationNumber,
    setIdentificationNumber,
  ] = useState("");

  const [
    identificationType,
    setIdentificationType,
  ] = useState("CC");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    vehicleCapacity,
    setVehicleCapacity,
  ] = useState("");

  const [
    capacityUnit,
    setCapacityUnit,
  ] = useState("kg");

  const [
    vehicleType,
    setVehicleType,
  ] = useState("");

  const [
    vehicleColor,
    setVehicleColor,
  ] = useState("");

  const [
    vehiclePlate,
    setVehiclePlate,
  ] = useState("");

  const [
    vehicleBrand,
    setVehicleBrand,
  ] = useState("");

  const [
    vehicleReference,
    setVehicleReference,
  ] = useState("");

  const [
    vehicleModel,
    setVehicleModel,
  ] = useState("");

  const [
    bodyType,
    setBodyType,
  ] = useState(
    "not_specified"
  );

  const [
    axleCount,
    setAxleCount,
  ] = useState("");

  const [
    identificationFront,
    setIdentificationFront,
  ] = useState(null);

  const [
    identificationBack,
    setIdentificationBack,
  ] = useState(null);

  const [
    licenseFront,
    setLicenseFront,
  ] = useState(null);

  const [
    licenseBack,
    setLicenseBack,
  ] = useState(null);

  const [
    registrationFront,
    setRegistrationFront,
  ] = useState(null);

  const [
    registrationBack,
    setRegistrationBack,
  ] = useState(null);

  const [
    vehiclePhoto,
    setVehiclePhoto,
  ] = useState(null);

  const [
    acceptedSecurity,
    setAcceptedSecurity,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    applicationSent,
    setApplicationSent,
  ] = useState(false);

  const capacityKg = useMemo(
    () =>
      capacityToKg(
        vehicleCapacity,
        capacityUnit
      ),
    [
      vehicleCapacity,
      capacityUnit,
    ]
  );

  const suggestedVehicle =
    useMemo(
      () =>
        suggestVehicle(
          capacityKg
        ),
      [capacityKg]
    );

  const selectedVehicle =
    VEHICLE_OPTIONS.find(
      (option) =>
        option.value ===
        vehicleType
    ) || null;

  const goToStep = (
    nextStep
  ) => {
    if (nextStep === 2) {
      if (
        !firstname.trim() ||
        !lastname.trim() ||
        !identificationNumber.trim() ||
        !email.trim() ||
        password.length < 6
      ) {
        toast.error(
          "Completa tus datos personales antes de continuar."
        );
        return;
      }
    }

    if (nextStep === 3) {
      if (
        capacityKg <= 0 ||
        !vehicleType ||
        !vehicleColor.trim() ||
        !vehiclePlate.trim()
      ) {
        toast.error(
          "Completa la información principal del vehículo."
        );
        return;
      }
    }

    if (nextStep === 4) {
      const documents = [
        [
          identificationFront,
          "la cédula por delante",
        ],
        [
          identificationBack,
          "la cédula por detrás",
        ],
        [
          licenseFront,
          "la licencia por delante",
        ],
        [
          licenseBack,
          "la licencia por detrás",
        ],
        [
          registrationFront,
          "la tarjeta de propiedad por delante",
        ],
        [
          registrationBack,
          "la tarjeta de propiedad por detrás",
        ],
      ];

      try {
        documents.forEach(
          ([file, label]) =>
            validateImageFile(
              file,
              label
            )
        );
      } catch (error) {
        toast.error(
          error.message
        );
        return;
      }
    }

    setStep(nextStep);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const resetForm = () => {
    setStep(1);
    setFirstName("");
    setLastName("");
    setIdentificationNumber("");
    setIdentificationType("CC");
    setEmail("");
    setPassword("");
    setVehicleCapacity("");
    setCapacityUnit("kg");
    setVehicleType("");
    setVehicleColor("");
    setVehiclePlate("");
    setVehicleBrand("");
    setVehicleReference("");
    setVehicleModel("");
    setBodyType(
      "not_specified"
    );
    setAxleCount("");
    setIdentificationFront(null);
    setIdentificationBack(null);
    setLicenseFront(null);
    setLicenseBack(null);
    setRegistrationFront(null);
    setRegistrationBack(null);
    setVehiclePhoto(null);
    setAcceptedSecurity(false);
  };

  const submitHandler = async (
    event
  ) => {
    event.preventDefault();

    if (!acceptedSecurity) {
      toast.error(
        "Debes aceptar el tratamiento seguro de tus datos."
      );
      return;
    }

    try {
      setSubmitting(true);

      const [
        identificationFrontImage,
        identificationBackImage,
        licenseFrontImage,
        licenseBackImage,
        registrationFrontImage,
        registrationBackImage,
        vehiclePhotoImage,
      ] = await Promise.all([
        fileToBase64(
          identificationFront
        ),
        fileToBase64(
          identificationBack
        ),
        fileToBase64(
          licenseFront
        ),
        fileToBase64(
          licenseBack
        ),
        fileToBase64(
          registrationFront
        ),
        fileToBase64(
          registrationBack
        ),
        fileToBase64(
          vehiclePhoto
        ),
      ]);

      const captainData = {
        fullname: {
          firstname:
            firstname.trim(),
          lastname:
            lastname.trim(),
        },

        identification: {
          number:
            identificationNumber.trim(),
          type:
            identificationType,
        },

        email:
          email
            .trim()
            .toLowerCase(),

        password,

        vehicle: {
          color:
            vehicleColor.trim(),

          plate:
            vehiclePlate
              .trim()
              .toUpperCase(),

          brand:
            vehicleBrand.trim(),

          reference:
            vehicleReference.trim(),

          model:
            vehicleModel.trim(),

          capacity:
            Number(
              vehicleCapacity
            ),

          capacityUnit,

          capacityKg,

          vehicleType,

          bodyType,

          axleCount:
            axleCount
              ? Number(axleCount)
              : null,

          photo:
            vehiclePhotoImage,
        },

        documents: {
          identificationCard: {
            front:
              identificationFrontImage,
            back:
              identificationBackImage,
          },

          drivingLicense: {
            front:
              licenseFrontImage,
            back:
              licenseBackImage,
          },

          vehicleRegistration: {
            front:
              registrationFrontImage,
            back:
              registrationBackImage,
          },
        },

        securityConsent: {
          accepted: true,
          acceptedAt:
            new Date().toISOString(),
          privacyPolicyVersion:
            "2026-07",
        },
      };

      const response =
        await axios.post(
          `${getApiBaseUrl()}/captain/register`,
          captainData,
          {
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      if (
        response.status === 201 &&
        response.data?.success
      ) {
        resetForm();
        setApplicationSent(true);

        toast.success(
          response.data?.message ||
            "Solicitud enviada correctamente."
        );
      }
    } catch (error) {
      const isOffline =
        error.code ===
          "ERR_NETWORK" ||
        error.message ===
          "Network Error";

      if (isOffline) {
        toast.error(
          `No se puede conectar con la API (${getApiHintOrigin()}).`
        );
      } else {
        const message =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          error.message ||
          "No se pudo enviar la solicitud.";

        toast.error(
          String(message)
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (applicationSent) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 px-5 py-8 flex items-center justify-center">
          <div className="w-full max-w-md rounded-[32px] bg-white p-7 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-[26px] bg-emerald-600 text-white flex items-center justify-center mx-auto">
              <i className="ri-checkbox-circle-line text-4xl" />
            </div>

            <h1 className="text-2xl font-black text-gray-950 mt-5">
              Solicitud enviada
            </h1>

            <p className="text-sm text-gray-600 mt-3 leading-6">
              Recibimos tu información y documentos. El equipo de Central Go revisará la solicitud antes de activar tu cuenta.
            </p>

            <Link
              to="/captain-login"
              className="block mt-6 rounded-2xl bg-gradient-to-r from-purple-800 to-fuchsia-600 text-white py-3.5 font-black"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        </div>

        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-purple-50">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <Link
              to="/"
              className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center"
            >
              <i className="ri-arrow-left-line text-xl" />
            </Link>

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-700">
                Registro seguro
              </p>

              <h1 className="text-base font-black text-gray-950">
                Transportador Central Go
              </h1>
            </div>

            <div className="w-11" />
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-5">
          <section className="rounded-[28px] bg-gradient-to-r from-purple-900 via-violet-700 to-fuchsia-600 p-5 text-white shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
              Crea tu perfil
            </p>

            <h2 className="text-2xl font-black mt-2">
              Empieza a recibir oportunidades
            </h2>

            <p className="text-sm text-white/75 mt-2 leading-6">
              Completa cuatro pasos. Tus documentos serán revisados antes de activar la cuenta.
            </p>
          </section>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {STEPS.map(
              (item) => (
                <div
                  key={item.number}
                  className={`rounded-2xl border px-2 py-3 text-center ${
                    step === item.number
                      ? "bg-purple-700 border-purple-700 text-white"
                      : step >
                        item.number
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-400"
                  }`}
                >
                  <p className="text-sm font-black">
                    {step >
                    item.number ? (
                      <i className="ri-check-line" />
                    ) : (
                      item.number
                    )}
                  </p>

                  <p className="text-[9px] font-black mt-1">
                    {item.label}
                  </p>
                </div>
              )
            )}
          </div>

          <form
            onSubmit={
              submitHandler
            }
            className="mt-4"
          >
            {step === 1 ? (
              <section className="rounded-[28px] bg-white border border-gray-200 p-5 shadow-lg">
                <h2 className="text-xl font-black text-gray-950">
                  Tus datos
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Información personal y de acceso.
                </p>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <input
                    value={
                      firstname
                    }
                    onChange={(
                      event
                    ) =>
                      setFirstName(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Nombre"
                    required
                  />

                  <input
                    value={
                      lastname
                    }
                    onChange={(
                      event
                    ) =>
                      setLastName(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Apellido"
                    required
                  />
                </div>

                <div className="grid grid-cols-[110px_1fr] gap-3 mt-3">
                  <select
                    value={
                      identificationType
                    }
                    onChange={(
                      event
                    ) =>
                      setIdentificationType(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-3.5 outline-none"
                  >
                    <option value="CC">
                      C.C.
                    </option>
                    <option value="CE">
                      C.E.
                    </option>
                    <option value="PASSPORT">
                      Pasaporte
                    </option>
                    <option value="OTHER">
                      Otro
                    </option>
                  </select>

                  <input
                    value={
                      identificationNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setIdentificationNumber(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Número de identificación"
                    required
                  />
                </div>

                <input
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
                    )
                  }
                  className="w-full mt-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                  type="email"
                  placeholder="Correo electrónico"
                  required
                />

                <input
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  className="w-full mt-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                  type="password"
                  minLength={6}
                  placeholder="Contraseña, mínimo 6 caracteres"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    goToStep(2)
                  }
                  className="w-full mt-5 rounded-2xl bg-purple-700 text-white py-3.5 font-black"
                >
                  Continuar
                  <i className="ri-arrow-right-line ml-1" />
                </button>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="rounded-[28px] bg-white border border-gray-200 p-5 shadow-lg">
                <h2 className="text-xl font-black text-gray-950">
                  Tu vehículo
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Escribe primero la capacidad real y Central Go te sugerirá una clasificación.
                </p>

                <div className="grid grid-cols-[1fr_110px] gap-3 mt-5">
                  <input
                    value={
                      vehicleCapacity
                    }
                    onChange={(
                      event
                    ) =>
                      setVehicleCapacity(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Capacidad real"
                    required
                  />

                  <select
                    value={
                      capacityUnit
                    }
                    onChange={(
                      event
                    ) =>
                      setCapacityUnit(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-3.5 outline-none"
                  >
                    <option value="kg">
                      kg
                    </option>
                    <option value="ton">
                      toneladas
                    </option>
                  </select>
                </div>

                {suggestedVehicle ? (
                  <div className="mt-4 rounded-[22px] border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <i className="ri-magic-line text-xl" />
                      </div>

                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
                          Sugerencia automática
                        </p>

                        <p className="text-lg font-black text-blue-950 mt-1">
                          {suggestedVehicle.label}
                        </p>

                        <p className="text-xs text-blue-700 mt-1">
                          La capacidad equivale a{" "}
                          {formatKg(
                            capacityKg
                          )}{" "}
                          kg.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setVehicleType(
                              suggestedVehicle.value
                            )
                          }
                          className="mt-3 rounded-xl bg-blue-600 text-white px-4 py-2 text-xs font-black"
                        >
                          Usar esta clasificación
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <label className="block text-xs font-black uppercase text-gray-500 mt-5 mb-2">
                  Tipo de vehículo confirmado
                </label>

                <select
                  value={
                    vehicleType
                  }
                  onChange={(
                    event
                  ) =>
                    setVehicleType(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">
                    Selecciona o confirma
                  </option>

                  {VEHICLE_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

                {selectedVehicle ? (
                  <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <p className="text-sm font-black text-emerald-900">
                      Vehículo seleccionado:{" "}
                      {selectedVehicle.label}
                    </p>

                    <p className="text-xs text-emerald-700 mt-1">
                      Capacidad registrada:{" "}
                      {formatKg(
                        capacityKg
                      )}{" "}
                      kg.
                    </p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <input
                    value={
                      vehicleColor
                    }
                    onChange={(
                      event
                    ) =>
                      setVehicleColor(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    placeholder="Color"
                    required
                  />

                  <input
                    value={
                      vehiclePlate
                    }
                    onChange={(
                      event
                    ) =>
                      setVehiclePlate(
                        event.target
                          .value
                          .toUpperCase()
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    placeholder="Placa"
                    required
                  />

                  <input
                    value={
                      vehicleBrand
                    }
                    onChange={(
                      event
                    ) =>
                      setVehicleBrand(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    placeholder="Marca"
                  />

                  <input
                    value={
                      vehicleReference
                    }
                    onChange={(
                      event
                    ) =>
                      setVehicleReference(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    placeholder="Referencia"
                  />

                  <input
                    value={
                      vehicleModel
                    }
                    onChange={(
                      event
                    ) =>
                      setVehicleModel(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    placeholder="Modelo"
                  />

                  <input
                    value={
                      axleCount
                    }
                    onChange={(
                      event
                    ) =>
                      setAxleCount(
                        event.target
                          .value
                      )
                    }
                    className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                    type="number"
                    min="1"
                    placeholder="Número de ejes"
                  />
                </div>

                <select
                  value={bodyType}
                  onChange={(
                    event
                  ) =>
                    setBodyType(
                      event.target
                        .value
                    )
                  }
                  className="w-full mt-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3.5 outline-none"
                >
                  {BODY_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() =>
                      goToStep(1)
                    }
                    className="rounded-2xl border border-gray-200 bg-white py-3.5 font-black text-gray-700"
                  >
                    Atrás
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goToStep(3)
                    }
                    className="rounded-2xl bg-purple-700 text-white py-3.5 font-black"
                  >
                    Continuar
                  </button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="rounded-[28px] bg-white border border-gray-200 p-5 shadow-lg">
                <h2 className="text-xl font-black text-gray-950">
                  Documentos
                </h2>

                <p className="text-xs text-gray-500 mt-1 leading-5">
                  Toma fotos claras, completas y sin reflejos. Solo el equipo autorizado podrá revisarlas.
                </p>

                <div className="mt-5 space-y-3">
                  <DocumentCard
                    title="Cédula — parte delantera"
                    description="Debe verse completa y legible."
                    file={
                      identificationFront
                    }
                    onChange={
                      setIdentificationFront
                    }
                  />

                  <DocumentCard
                    title="Cédula — parte trasera"
                    description="Incluye códigos y datos posteriores."
                    file={
                      identificationBack
                    }
                    onChange={
                      setIdentificationBack
                    }
                  />

                  <DocumentCard
                    title="Licencia — parte delantera"
                    description="Fotografía la licencia de conducción."
                    file={
                      licenseFront
                    }
                    onChange={
                      setLicenseFront
                    }
                  />

                  <DocumentCard
                    title="Licencia — parte trasera"
                    description="Asegúrate de que toda la información sea visible."
                    file={
                      licenseBack
                    }
                    onChange={
                      setLicenseBack
                    }
                  />

                  <DocumentCard
                    title="Tarjeta de propiedad — delante"
                    description="Debe coincidir con la placa registrada."
                    file={
                      registrationFront
                    }
                    onChange={
                      setRegistrationFront
                    }
                  />

                  <DocumentCard
                    title="Tarjeta de propiedad — detrás"
                    description="Fotografía completa del reverso."
                    file={
                      registrationBack
                    }
                    onChange={
                      setRegistrationBack
                    }
                  />

                  <DocumentCard
                    title="Foto del vehículo"
                    description="Opcional, pero ayuda a validar más rápido."
                    file={vehiclePhoto}
                    onChange={
                      setVehiclePhoto
                    }
                  />
                </div>

                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs text-amber-800 leading-5">
                    <i className="ri-shield-check-line mr-1" />
                    No compartiremos estos documentos con clientes ni otros conductores.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() =>
                      goToStep(2)
                    }
                    className="rounded-2xl border border-gray-200 bg-white py-3.5 font-black text-gray-700"
                  >
                    Atrás
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goToStep(4)
                    }
                    className="rounded-2xl bg-purple-700 text-white py-3.5 font-black"
                  >
                    Revisar
                  </button>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="rounded-[28px] bg-white border border-gray-200 p-5 shadow-lg">
                <h2 className="text-xl font-black text-gray-950">
                  Confirma tu solicitud
                </h2>

                <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs font-black uppercase text-gray-500">
                    Transportador
                  </p>

                  <p className="text-base font-black text-gray-950 mt-1">
                    {firstname}{" "}
                    {lastname}
                  </p>

                  <p className="text-xs text-gray-600 mt-1">
                    {identificationType}:{" "}
                    {identificationNumber}
                  </p>
                </div>

                <div className="mt-3 rounded-2xl bg-purple-50 border border-purple-100 p-4">
                  <p className="text-xs font-black uppercase text-purple-600">
                    Vehículo
                  </p>

                  <p className="text-base font-black text-purple-950 mt-1">
                    {selectedVehicle?.label ||
                      "Sin seleccionar"}
                  </p>

                  <p className="text-xs text-purple-700 mt-1">
                    {formatKg(
                      capacityKg
                    )}{" "}
                    kg · Placa{" "}
                    {vehiclePlate}
                  </p>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      acceptedSecurity
                    }
                    onChange={(
                      event
                    ) =>
                      setAcceptedSecurity(
                        event.target
                          .checked
                      )
                    }
                    className="mt-1 w-5 h-5 accent-purple-700"
                  />

                  <span className="text-xs text-gray-700 leading-5">
                    Autorizo a Central Go a almacenar y revisar estos datos únicamente para validar mi identidad, licencia y vehículo.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() =>
                      goToStep(3)
                    }
                    className="rounded-2xl border border-gray-200 bg-white py-3.5 font-black text-gray-700"
                  >
                    Atrás
                  </button>

                  <button
                    type="submit"
                    disabled={
                      submitting
                    }
                    className="rounded-2xl bg-gradient-to-r from-purple-800 to-fuchsia-600 text-white py-3.5 font-black disabled:opacity-60"
                  >
                    {submitting
                      ? "Enviando..."
                      : "Enviar solicitud"}
                  </button>
                </div>
              </section>
            ) : null}
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            ¿Ya tienes una cuenta aprobada?{" "}
            <Link
              to="/captain-login"
              className="font-black text-purple-700"
            >
              Inicia sesión
            </Link>
          </p>
        </main>
      </div>

      <ToastContainer />
    </>
  );
};

export default CaptainSignup;