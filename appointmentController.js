
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const DailyTokenCounter = require("../models/DailyTokenCounter");
const Patient = require("../models/Patient");
const User = require("../models/User");

const getLocalDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isValidDayKey = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    getLocalDayKey(parsed) === value
  );
};

const getNextToken = async (dayKey) => {
  try {
    const counter = await DailyTokenCounter.findOneAndUpdate(
      { dayKey },
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return counter.sequence;
  } catch (error) {
    // Agar pehli dafa concurrent requests mein duplicate upsert ho,
    // existing counter ko increment karke dobara try karein.
    if (error.code === 11000) {
      const counter = await DailyTokenCounter.findOneAndUpdate(
        { dayKey },
        { $inc: { sequence: 1 } },
        { new: true }
      );

      return counter.sequence;
    }

    throw error;
  }
};

const createAppointment = async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      date,
      reason = "",
    } = req.body;

    if (typeof patientId !== "string" || !patientId.trim()) {
      return res.status(400).json({
        message: "Patient database ID ya clinic patient ID required hai",
      });
    }

    const dayKey = date || getLocalDayKey();

    if (!isValidDayKey(dayKey)) {
      return res.status(400).json({
        message: "Date YYYY-MM-DD format mein dein",
      });
    }

    const patientIdentifier = patientId.trim();
    let patient = null;

    if (mongoose.Types.ObjectId.isValid(patientIdentifier)) {
      patient = await Patient.findById(patientIdentifier);
    }

    if (!patient) {
      patient = await Patient.findOne({ patientId: patientIdentifier });
    }

    if (!patient) {
      return res.status(404).json({
        message: "Patient nahi mila",
      });
    }

    let doctor = null;

    if (doctorId) {
      const trimmedDoctorId = String(doctorId).trim();

      if (!trimmedDoctorId || !mongoose.Types.ObjectId.isValid(trimmedDoctorId)) {
        return res.status(400).json({
          message: "Please select a valid doctor from the list or leave it unassigned.",
        });
      }

      doctor = await User.findOne({
        _id: trimmedDoctorId,
        role: "doctor",
        isActive: { $ne: false },
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Active doctor nahi mila",
        });
      }
    }

    if (typeof reason !== "string" || reason.length > 500) {
      return res.status(400).json({
        message: "Reason maximum 500 characters ka ho sakta hai",
      });
    }

    const tokenNumber = await getNextToken(dayKey);

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor ? doctor._id : null,
      dayKey,
      appointmentDate: new Date(`${dayKey}T00:00:00`),
      tokenNumber,
      reason: reason.trim(),
      status: "waiting",
      createdBy: req.user._id,
    });

    const result = await Appointment.findById(appointment._id)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name username");

    return res.status(201).json({
      message: "Appointment created successfully",
      appointment: result,
    });
  } catch (error) {
    console.error("Create appointment error:", error.message);

    return res.status(500).json({
      message: "Appointment create nahi hui",
    });
  }
};

const getAppointments = async (req, res) => {
  try {
    const dayKey = req.query.date || getLocalDayKey();
    const { status } = req.query;

    if (!isValidDayKey(dayKey)) {
      return res.status(400).json({
        message: "Date YYYY-MM-DD format mein dein",
      });
    }

    const allowedStatuses = [
      "waiting",
      "in_consultation",
      "completed",
      "cancelled",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid appointment status",
      });
    }

    const filter = { dayKey };

    if (status) {
      filter.status = status;
    }

    // Doctor ko apni assigned appointments aur unassigned queue
    // nazar aayegi. Admin aur receptionist poori queue dekh sakte hain.
    if (req.user.role === "doctor") {
      filter.$or = [
        { doctor: req.user._id },
        { doctor: null },
      ];
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name username")
      .sort({ tokenNumber: 1 });

    return res.json({
      date: dayKey,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error("Get appointments error:", error.message);

    return res.status(500).json({
      message: "Appointments fetch nahi ho sakin",
    });
  }
};

const updateAppointmentDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID",
      });
    }

    const nextDoctorId =
      doctorId === null || doctorId === undefined || doctorId === ""
        ? null
        : String(doctorId).trim();

    if (nextDoctorId && !mongoose.Types.ObjectId.isValid(nextDoctorId)) {
      return res.status(400).json({
        message: "Please select a valid doctor or leave unassigned.",
      });
    }

    if (nextDoctorId) {
      const doctor = await User.findOne({
        _id: nextDoctorId,
        role: "doctor",
        isActive: { $ne: false },
      });

      if (!doctor) {
        return res.status(404).json({
          message: "Selected doctor not found or inactive.",
        });
      }

      if (req.user.role === "doctor" && nextDoctorId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Doctor sirf apne liye appointment assign kar sakta hai",
        });
      }
    }

    if (req.user.role === "doctor" && nextDoctorId === null) {
      return res.status(403).json({
        message: "Doctor appointment ko unassign nahi kar sakta",
      });
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment nahi mili",
      });
    }

    appointment.doctor = nextDoctorId ? new mongoose.Types.ObjectId(nextDoctorId) : null;
    await appointment.save();

    const result = await Appointment.findById(appointment._id)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name username");

    return res.json({
      message: "Appointment doctor updated successfully",
      appointment: result,
    });
  } catch (error) {
    console.error("Update appointment doctor error:", error.message);

    return res.status(500).json({
      message: "Appointment doctor update nahi hui",
    });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID",
      });
    }

    const allowedStatuses = [
      "waiting",
      "in_consultation",
      "completed",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid appointment status",
      });
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment nahi mili",
      });
    }

    if (req.user.role === "doctor") {
      if (!["in_consultation", "completed"].includes(status)) {
        return res.status(403).json({
          message: "Doctor sirf consultation status update kar sakta hai",
        });
      }

      if (
        appointment.doctor &&
        appointment.doctor.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Yeh appointment doosre doctor ko assigned hai",
        });
      }

      if (!appointment.doctor) {
        appointment.doctor = req.user._id;
      }
    }

    if (
      req.user.role === "receptionist" &&
      ["in_consultation", "completed"].includes(status)
    ) {
      return res.status(403).json({
        message: "Receptionist yeh status set nahi kar sakta",
      });
    }

    appointment.status = status;
    await appointment.save();

    const result = await Appointment.findById(appointment._id)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name username");

    return res.json({
      message: "Appointment status updated successfully",
      appointment: result,
    });
  } catch (error) {
    console.error("Update appointment error:", error.message);

    return res.status(500).json({
      message: "Appointment update nahi hui",
    });
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  updateAppointmentDoctor,
  updateAppointmentStatus,
};