const express = require("express");
const router = express.Router();

const authEnterprise = require("../middlewares/authEnterprise");
const enterpriseClientController = require("../controllers/enterpriseClient.controller");

router.get("/", authEnterprise, enterpriseClientController.getEnterpriseClients);
router.post("/", authEnterprise, enterpriseClientController.createEnterpriseClient);
router.put("/:id", authEnterprise, enterpriseClientController.updateEnterpriseClient);
router.delete("/:id", authEnterprise, enterpriseClientController.deleteEnterpriseClient);

module.exports = router;
