
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  addMedicine,
  getMedicines,
  getLowStock,
} = require("../controllers/medicineController");

router.use(protect);

router.get("/", getMedicines);
router.get("/low-stock", allowRoles("admin", "pharmacist"), getLowStock);
router.post("/", allowRoles("admin", "pharmacist"), addMedicine);

module.exports = router;