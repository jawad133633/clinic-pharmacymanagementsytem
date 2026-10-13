
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  createSale,
  getSales,
  getSaleById,
  getDailyReport,
} = require("../controllers/saleController");

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "receptionist", "pharmacist"),
  createSale
);

router.get(
  "/daily-report",
  allowRoles("admin"),
  getDailyReport
);

router.get(
  "/",
  allowRoles("admin", "receptionist", "pharmacist"),
  getSales
);

router.get(
  "/:id",
  allowRoles("admin", "receptionist", "pharmacist"),
  getSaleById
);

module.exports = router;