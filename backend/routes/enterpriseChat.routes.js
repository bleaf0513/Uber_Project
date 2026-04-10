const express = require("express");
const router = express.Router();

const authEnterprise = require("../middlewares/authEnterprise");
const authEnterpriseDriver = require("../middlewares/authEnterpriseDriver");

const {
  getChatMessages,
  sendChatMessage,
  getChatSummary,
} = require("../controllers/enterpriseChat.controller");

router.get("/enterprise-chat/summary", authEnterprise, getChatSummary);
router.get("/enterprise-chat/:deliveryId", authEnterprise, getChatMessages);
router.post("/enterprise-chat/:deliveryId", authEnterprise, sendChatMessage);

router.get("/enterprise-driver-chat/summary", authEnterpriseDriver, getChatSummary);
router.get("/enterprise-driver-chat/:deliveryId", authEnterpriseDriver, getChatMessages);
router.post("/enterprise-driver-chat/:deliveryId", authEnterpriseDriver, sendChatMessage);

module.exports = router;
