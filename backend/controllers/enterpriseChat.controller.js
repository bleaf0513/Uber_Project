const EnterpriseChatMessage = require("../models/enterpriseChatMessage.model");
const EnterpriseDelivery = require("../models/enterpriseDelivery.model");

function normalizeText(value) {
  return String(value || "").trim();
}

async function findDeliveryForEnterprise(deliveryId, enterpriseId) {
  return EnterpriseDelivery.findOne({
    _id: deliveryId,
    enterprise: enterpriseId,
  });
}

async function findDeliveryForDriver(deliveryId, driverId) {
  return EnterpriseDelivery.findOne({
    _id: deliveryId,
    assignedDriverId: driverId,
  });
}

module.exports.getChatMessages = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        message: "deliveryId es obligatorio.",
      });
    }

    let delivery = null;
    let actorType = null;

    if (req.enterprise?._id) {
      actorType = "logistics";
      delivery = await findDeliveryForEnterprise(deliveryId, req.enterprise._id);
    } else {
      const driverId = req.driver?._id || req.enterpriseDriver?._id;

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "No autorizado.",
        });
      }

      actorType = "driver";
      delivery = await findDeliveryForDriver(deliveryId, driverId);
    }

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Entrega no encontrada o sin acceso al chat.",
      });
    }

    const messages = await EnterpriseChatMessage.find({
      delivery: delivery._id,
    }).sort({ createdAt: 1 });

    if (actorType === "logistics") {
      await EnterpriseChatMessage.updateMany(
        {
          delivery: delivery._id,
          senderType: "driver",
          readByLogistics: false,
        },
        {
          $set: { readByLogistics: true },
        }
      );
    } else {
      await EnterpriseChatMessage.updateMany(
        {
          delivery: delivery._id,
          senderType: "logistics",
          readByDriver: false,
        },
        {
          $set: { readByDriver: true },
        }
      );
    }

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error en getChatMessages:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudieron obtener los mensajes del chat.",
    });
  }
};

module.exports.sendChatMessage = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const text = normalizeText(req.body?.text);

    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        message: "deliveryId es obligatorio.",
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "El mensaje no puede estar vacío.",
      });
    }

    if (text.length > 1500) {
      return res.status(400).json({
        success: false,
        message: "El mensaje es demasiado largo.",
      });
    }

    let delivery = null;
    let senderType = null;
    let senderId = null;
    let senderName = null;
    let enterpriseId = null;
    let driverId = null;

    if (req.enterprise?._id) {
      senderType = "logistics";
      senderId = req.enterprise._id;
      senderName =
        req.enterprise.companyName ||
        req.enterprise.name ||
        "Logística";

      delivery = await findDeliveryForEnterprise(deliveryId, req.enterprise._id);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Entrega no encontrada o sin acceso al chat.",
        });
      }

      enterpriseId = delivery.enterprise;
      driverId = delivery.assignedDriverId;
    } else {
      const authDriver = req.driver || req.enterpriseDriver;
      const authDriverId = authDriver?._id;

      if (!authDriverId) {
        return res.status(401).json({
          success: false,
          message: "Conductor no autorizado.",
        });
      }

      senderType = "driver";
      senderId = authDriverId;
      senderName = authDriver.name || "Conductor";

      delivery = await findDeliveryForDriver(deliveryId, authDriverId);

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Entrega no encontrada o sin acceso al chat.",
        });
      }

      enterpriseId = delivery.enterprise;
      driverId = authDriverId;
    }

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "La entrega no tiene conductor asignado.",
      });
    }

    const newMessage = await EnterpriseChatMessage.create({
      delivery: delivery._id,
      enterprise: enterpriseId,
      driver: driverId,
      senderType,
      senderId,
      senderName,
      text,
      readByLogistics: senderType === "logistics",
      readByDriver: senderType === "driver",
    });

    return res.status(201).json({
      success: true,
      message: "Mensaje enviado correctamente.",
      chatMessage: newMessage,
    });
  } catch (error) {
    console.error("Error en sendChatMessage:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo enviar el mensaje.",
    });
  }
};

module.exports.getChatSummary = async (req, res) => {
  try {
    let filter = {};

    if (req.enterprise?._id) {
      filter.enterprise = req.enterprise._id;
    } else {
      const driverId = req.driver?._id || req.enterpriseDriver?._id;

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "No autorizado.",
        });
      }

      filter.driver = driverId;
    }

    const messages = await EnterpriseChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    const grouped = new Map();

    for (const msg of messages) {
      const key = String(msg.delivery);

      if (!grouped.has(key)) {
        grouped.set(key, {
          deliveryId: msg.delivery,
          lastMessage: msg,
          unreadForLogistics: 0,
          unreadForDriver: 0,
        });
      }

      const item = grouped.get(key);

      if (!item.lastMessage || msg.createdAt > item.lastMessage.createdAt) {
        item.lastMessage = msg;
      }

      if (msg.senderType === "driver" && !msg.readByLogistics) {
        item.unreadForLogistics += 1;
      }

      if (msg.senderType === "logistics" && !msg.readByDriver) {
        item.unreadForDriver += 1;
      }
    }

    return res.status(200).json({
      success: true,
      chats: Array.from(grouped.values()),
    });
  } catch (error) {
    console.error("Error en getChatSummary:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo obtener el resumen de chats.",
    });
  }
};
