
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const isValidEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const createStaff = async (req, res) => {
  try {
    const { name, username, email: rawEmail, password, role } = req.body;

    if (!name || !username || !rawEmail || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, username, email, password and role are required",
      });
    }

    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    // Public/admin request mein sirf ye staff roles allowed hain.
    const allowedRoles = ["doctor", "receptionist", "pharmacist"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be doctor, receptionist or pharmacist",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const email = rawEmail.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const staff = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email,
      passwordHash,
      role,
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        username: staff.username,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    console.error("Create staff error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create staff account",
    });
  }
};


const getStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: { $in: ["doctor", "receptionist", "pharmacist"] },
    })
      .select("_id name username email role isActive createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff",
    });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { name, email: rawEmail, role } = req.body;
    const allowedRoles = ["doctor", "receptionist", "pharmacist"];
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name must be a non-empty string",
        });
      }
      updates.name = name.trim();
    }

    if (rawEmail !== undefined) {
      if (!isValidEmail(rawEmail)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }
      updates.email = rawEmail.trim().toLowerCase();
    }

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff role",
        });
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide name, email or role to update",
      });
    }

    const staff = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: { $in: allowedRoles },
      },
      updates,
      { new: true, runValidators: true }
    ).select("_id name username email role isActive createdAt");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      staff,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already belongs to another account",
      });
    }

    res.status(400).json({
      success: false,
      message: "Invalid staff ID or update data",
    });
  }
};

const deactivateStaff = async (req, res) => {
  try {
    const staff = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: { $in: ["doctor", "receptionist", "pharmacist"] },
      },
      { isActive: false },
      { new: true }
    ).select("_id name username role isActive");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Staff account deactivated",
      staff,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid staff ID",
    });
  }
};


module.exports = { createStaff,  getStaff,
  updateStaff,
  deactivateStaff };

  