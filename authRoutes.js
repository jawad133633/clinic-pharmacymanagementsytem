
const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginUser,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

router.post("/register-admin", registerAdmin);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

module.exports = router;
