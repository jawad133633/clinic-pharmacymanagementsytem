
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const createMailTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);

  if (
    !SMTP_HOST ||
    !SMTP_USER ||
    !SMTP_PASS ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("SMTP configuration is incomplete");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

const getOtpHash = (userId, otp) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${userId}:${otp}`)
    .digest("hex");

const registerAdmin = async (req, res) => {
  try {
    const { name, username, email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, username, email and password are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin already exists. Registration is closed.",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

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

    const admin = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email,
      passwordHash,
      role: "admin",
    });

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      user: {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    console.error("Admin registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

const requestPasswordReset = async (req, res) => {
  let user;

  try {
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    const mailTransport = createMailTransport();
    user = await User.findOne({ email, isActive: { $ne: false } });

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an active account uses this email, a reset code has been sent.",
      });
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    user.resetOtpHash = getOtpHash(user._id.toString(), otp);
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOtpAttempts = 0;
    await user.save();

    try {
      await mailTransport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: "Your ClinicCare password reset code",
        text: `Hello ${user.name},\n\nYour password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      });
    } catch (error) {
      user.resetOtpHash = undefined;
      user.resetOtpExpiresAt = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      throw error;
    }

    return res.status(200).json({
      success: true,
      message:
        "If an active account uses this email, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Password reset code email failed:", error.message);

    if (error.message === "SMTP configuration is incomplete") {
      return res.status(503).json({
        success: false,
        message:
          "Email reset is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS to server/.env, then restart the backend.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not send the reset code. Please try again later.",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp, password } = req.body;

    if (!isValidEmail(email) || !/^\d{6}$/.test(String(otp || ""))) {
      return res.status(400).json({
        success: false,
        message: "A valid email and 6-digit reset code are required",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const user = await User.findOne({
      email,
      isActive: { $ne: false },
      resetOtpExpiresAt: { $gt: new Date() },
      resetOtpAttempts: { $lt: 5 },
    });

    if (!user || !user.resetOtpHash) {
      return res.status(400).json({
        success: false,
        message: "Reset code is invalid or expired. Request a new code.",
      });
    }

    const expectedHash = Buffer.from(user.resetOtpHash, "hex");
    const submittedHash = Buffer.from(
      getOtpHash(user._id.toString(), String(otp)),
      "hex"
    );

    if (
      expectedHash.length !== submittedHash.length ||
      !crypto.timingSafeEqual(expectedHash, submittedHash)
    ) {
      await User.updateOne(
        { _id: user._id, resetOtpAttempts: { $lt: 5 } },
        { $inc: { resetOtpAttempts: 1 } }
      );

      return res.status(400).json({
        success: false,
        message: "Reset code is invalid or expired. Request a new code.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetOtpHash: user.resetOtpHash,
        resetOtpExpiresAt: { $gt: new Date() },
        resetOtpAttempts: { $lt: 5 },
      },
      {
        $set: { passwordHash, resetOtpAttempts: 0 },
        $unset: {
          resetOtpHash: 1,
          resetOtpExpiresAt: 1,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: "Reset code is invalid or expired. Request a new code.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not reset password. Please try again later.",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const user = await User.findOne({
      username: normalizedUsername,
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

module.exports = {
  registerAdmin,
  loginUser,
  requestPasswordReset,
  resetPassword,
};
