
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const User = require("../models/User");

// Logged-in user apni profile dekh sakta hai
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

// Sirf admin users ki list dekh sakta hai
router.get("/", protect, allowRoles("admin"), async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name username role isActive createdAt")
      .lean();

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

module.exports = router;