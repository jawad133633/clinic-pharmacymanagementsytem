
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
} = require("../controllers/patientController");

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "receptionist", "doctor"),
  createPatient
);

router.get("/", getPatients);
router.get("/:id", getPatientById);

router.put(
  "/:id",
  allowRoles("admin", "receptionist", "doctor"),
  updatePatient
);

module.exports = router;