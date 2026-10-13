
const mongoose = require("mongoose");
const Patient = require("../models/Patient");
const Visit = require("../models/Visit");

const createVisit = async (req, res) => {
  try {
    const { patientId, symptoms, diagnosis, notes, prescription } = req.body;

    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: "A valid patient database ID is required",
      });
    }

    if (
      typeof symptoms !== "string" ||
      !symptoms.trim() ||
      typeof diagnosis !== "string" ||
      !diagnosis.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Symptoms and diagnosis are required",
      });
    }

    if (prescription !== undefined && !Array.isArray(prescription)) {
      return res.status(400).json({
        success: false,
        message: "Prescription must be an array",
      });
    }

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const safePrescription = prescription || [];
    const requiredMedicineFields = [
      "medicineName",
      "dosage",
      "frequency",
      "duration",
    ];

    for (const item of safePrescription) {
      if (
        !item ||
        requiredMedicineFields.some(
          (field) =>
            typeof item[field] !== "string" || !item[field].trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each medicine requires name, dosage, frequency and duration",
        });
      }
    }

    const visit = await Visit.create({
      patient: patient._id,
      doctor: req.user._id,
      symptoms: symptoms.trim(),
      diagnosis: diagnosis.trim(),
      notes,
      prescription: safePrescription,
    });

    res.status(201).json({
      success: true,
      message: "Visit and prescription saved successfully",
      visit,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create visit error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to save visit",
    });
  }
};

const getVisits = async (req, res) => {
  try {
    const filter = {};

    // Doctor sirf apni visits dekhega.
    if (req.user.role === "doctor") {
      filter.doctor = req.user._id;
    }

    if (req.query.patientId) {
      if (!mongoose.isValidObjectId(req.query.patientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid patient database ID",
        });
      }

      filter.patient = req.query.patientId;
    }

    const visits = await Visit.find(filter)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name username")
      .sort({ visitDate: -1 })
      .lean();

    res.json({
      success: true,
      count: visits.length,
      visits,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch visits",
    });
  }
};

module.exports = { createVisit, getVisits };