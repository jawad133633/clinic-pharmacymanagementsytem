
const Patient = require("../models/Patient");

const normalizeGender = (gender) => {
  if (typeof gender !== "string") return gender;

  const normalizedGender = gender.trim().toLowerCase();
  const genderValues = {
    male: "Male",
    female: "Female",
    other: "Other",
  };

  return genderValues[normalizedGender] || gender;
};

const createPatient = async (req, res) => {
  try {
    const { patientId, name, age, gender, phone, address } = req.body;

    if (
      !patientId ||
      !name ||
      age === undefined ||
      age === null ||
      age === "" ||
      !gender ||
      !phone
    ) {
      return res.status(400).json({
        success: false,
        message: "Patient ID, name, age, gender and phone are required",
      });
    }

    const patient = await Patient.create({
      patientId,
      name,
      age,
      gender: normalizeGender(gender),
      phone,
      address,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      patient,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Patient ID already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create patient error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to register patient",
    });
  }
};

const getPatients = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    const filter = search
      ? {
          $or: [
            { patientId: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const patients = await Patient.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
    });
  }
};

const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({ success: true, patient });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid patient ID",
    });
  }
};

const updatePatient = async (req, res) => {
  try {
    const allowedFields = ["name", "age", "gender", "phone", "address"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] =
          field === "gender"
            ? normalizeGender(req.body[field])
            : req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide patient details to update",
      });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      message: "Patient updated successfully",
      patient,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update patient",
    });
  }
};

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
};