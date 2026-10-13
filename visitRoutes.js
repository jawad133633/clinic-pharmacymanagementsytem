
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const {
  createVisit,
  getVisits,
} = require("../controllers/visitController");

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "doctor"),
  createVisit
);

router.get("/", getVisits);

module.exports = router;