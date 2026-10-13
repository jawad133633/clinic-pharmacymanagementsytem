
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  addBatch,
  getExpiringStock,
} = require("../controllers/stockController");

router.use(protect);

router.post(
  "/:id/batches",
  allowRoles("admin", "pharmacist"),
  addBatch
);

router.get(
  "/expiring",
  allowRoles("admin", "pharmacist"),
  getExpiringStock
);

module.exports = router;