
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  createStaff,
  getStaff,
  updateStaff,
  deactivateStaff,
} = require("../controllers/staffController");

router.use(protect);

router.get("/", allowRoles("admin", "receptionist", "doctor"), getStaff);
router.post("/", allowRoles("admin"), createStaff);
router.put("/:id", allowRoles("admin"), updateStaff);
router.patch("/:id/deactivate", allowRoles("admin"), deactivateStaff);

module.exports = router;