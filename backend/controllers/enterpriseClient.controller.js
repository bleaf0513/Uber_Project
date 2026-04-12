const mongoose = require("mongoose");
const EnterpriseClient = require("../models/enterpriseClient.model");

const normalizeString = (value, fallback = "") =>
  String(value ?? fallback).trim();

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
};

const validateClientPayload = (body = {}) => {
  const payload = {
    name: normalizeString(body.name),
    address: normalizeString(body.address),
    phone: normalizeString(body.phone),
    neighborhood: normalizeString(body.neighborhood),
    reference: normalizeString(body.reference),
    notes: normalizeString(body.notes),
    placeId: normalizeString(body.placeId),
    isActive: normalizeBoolean(body.isActive, true),
  };

  if (!payload.name) {
    return { error: "El nombre del cliente es obligatorio." };
  }

  if (!payload.address) {
    return { error: "La dirección del cliente es obligatoria." };
  }

  if (!payload.phone) {
    return { error: "El teléfono del cliente es obligatorio." };
  }

  return { payload };
};

module.exports.getEnterpriseClients = async (req, res) => {
  try {
    if (!req.enterprise?._id) {
      return res.status(401).json({
        message: "Empresa no autorizada.",
      });
    }

    const clients = await EnterpriseClient.find({
      enterprise: req.enterprise._id,
    }).sort({ updatedAt: -1, createdAt: -1 });

    return res.status(200).json({ clients });
  } catch (error) {
    console.error("Error obteniendo clientes empresariales:", error);
    return res.status(500).json({
      message: "Error obteniendo los clientes.",
    });
  }
};

module.exports.createEnterpriseClient = async (req, res) => {
  try {
    if (!req.enterprise?._id) {
      return res.status(401).json({
        message: "Empresa no autorizada.",
      });
    }

    const { error, payload } = validateClientPayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const client = await EnterpriseClient.create({
      enterprise: req.enterprise._id,
      ...payload,
    });

    return res.status(201).json({
      message: "Cliente creado correctamente.",
      client,
    });
  } catch (error) {
    console.error("Error creando cliente empresarial:", error);
    return res.status(500).json({
      message: "Error creando el cliente.",
    });
  }
};

module.exports.updateEnterpriseClient = async (req, res) => {
  try {
    if (!req.enterprise?._id) {
      return res.status(401).json({
        message: "Empresa no autorizada.",
      });
    }

    const clientId = String(req.params.id || "").trim();

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        message: "ID de cliente inválido.",
      });
    }

    const { error, payload } = validateClientPayload(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const client = await EnterpriseClient.findOneAndUpdate(
      {
        _id: clientId,
        enterprise: req.enterprise._id,
      },
      payload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!client) {
      return res.status(404).json({
        message: "Cliente no encontrado.",
      });
    }

    return res.status(200).json({
      message: "Cliente actualizado correctamente.",
      client,
    });
  } catch (error) {
    console.error("Error actualizando cliente empresarial:", error);
    return res.status(500).json({
      message: "Error actualizando el cliente.",
    });
  }
};

module.exports.deleteEnterpriseClient = async (req, res) => {
  try {
    if (!req.enterprise?._id) {
      return res.status(401).json({
        message: "Empresa no autorizada.",
      });
    }

    const clientId = String(req.params.id || "").trim();

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        message: "ID de cliente inválido.",
      });
    }

    const deletedClient = await EnterpriseClient.findOneAndDelete({
      _id: clientId,
      enterprise: req.enterprise._id,
    });

    if (!deletedClient) {
      return res.status(404).json({
        message: "Cliente no encontrado.",
      });
    }

    return res.status(200).json({
      message: "Cliente eliminado correctamente.",
    });
  } catch (error) {
    console.error("Error eliminando cliente empresarial:", error);
    return res.status(500).json({
      message: "Error eliminando el cliente.",
    });
  }
};
