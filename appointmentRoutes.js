
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  createAppointment,
  getAppointments,
  updateAppointmentDoctor,
  updateAppointmentStatus,
} = require("../controllers/appointmentController");

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "receptionist"),
  createAppointment
);

router.get(
  "/",
  allowRoles("admin", "receptionist", "doctor"),
  getAppointments
);

router.patch(
  "/:id/status",
  allowRoles("admin", "receptionist", "doctor"),
  updateAppointmentStatus
);

router.patch(
  "/:id/doctor",
  allowRoles("admin", "receptionist", "doctor"),
  updateAppointmentDoctor
);

module.exports = router;