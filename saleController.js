
const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const Patient = require("../models/Patient");

const createSale = async (req, res) => {
  const stockChanges = [];
  try {
    const {
      patientId,
      items,
      discount = 0,
      amountPaid,
      paymentMethod = "cash",
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    if (
      !Number.isFinite(Number(discount)) ||
      Number(discount) < 0 ||
      !Number.isFinite(Number(amountPaid)) ||
      Number(amountPaid) < 0
    ) {
      return res.status(400).json({ message: "Invalid discount or payment amount" });
    }

    if (!["cash", "card", "bank_transfer", "other"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    if (
      items.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          !mongoose.Types.ObjectId.isValid(item.medicineId) ||
          typeof item.batchNumber !== "string" ||
          !item.batchNumber.trim() ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0
      )
    ) {
      return res.status(400).json({
        message: "Invalid medicine, batch or quantity",
      });
    }

    const keys = items.map(
      (item) => `${item.medicineId}:${item.batchNumber}`
    );

    if (new Set(keys).size !== keys.length) {
      return res.status(400).json({
        message: "Same medicine batch ko ek hi item mein add karein",
      });
    }

    if (patientId && !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patient ID" });
    }

    let patient = null;
    if (patientId) {
      patient = await Patient.findById(patientId);

      if (!patient) {
        const error = new Error("Patient not found");
        error.statusCode = 404;
        throw error;
      }
    }

    const saleItems = [];
    let subtotal = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const item of items) {
      const quantity = Number(item.quantity);

      const medicine = await Medicine.findOne({
        _id: item.medicineId,
        isActive: true,
      });

      if (!medicine) {
        const error = new Error("Medicine not found or inactive");
        error.statusCode = 404;
        throw error;
      }

      const batch = medicine.batches.find(
        (b) => b.batchNumber === item.batchNumber
      );

      if (!batch) {
        const error = new Error(
          `Batch ${item.batchNumber} not found for ${medicine.name}`
        );
        error.statusCode = 404;
        throw error;
      }

      if (new Date(batch.expiryDate) < today) {
        const error = new Error(`${medicine.name} batch has expired`);
        error.statusCode = 400;
        throw error;
      }

      if (batch.quantity < quantity) {
        const error = new Error(
          `Insufficient stock for ${medicine.name}. Available: ${batch.quantity}`
        );
        error.statusCode = 400;
        throw error;
      }

      const unitPrice = Number(batch.salePrice);
      const lineTotal = unitPrice * quantity;

      saleItems.push({
        medicine: medicine._id,
        medicineName: medicine.name,
        batchNumber: batch.batchNumber,
        quantity,
        unitPrice,
        lineTotal,
      });

      subtotal += lineTotal;
    }

    const discountValue = Number(discount);
    const grandTotal = subtotal - discountValue;

    if (discountValue > subtotal) {
      const error = new Error("Discount cannot exceed subtotal");
      error.statusCode = 400;
      throw error;
    }

    if (Number(amountPaid) < grandTotal) {
      const error = new Error("Payment is less than the total bill");
      error.statusCode = 400;
      throw error;
    }

    for (const item of saleItems) {
      const result = await Medicine.updateOne(
        {
          _id: item.medicine,
          isActive: true,
          batches: {
            $elemMatch: {
              batchNumber: item.batchNumber,
              quantity: { $gte: item.quantity },
              expiryDate: { $gte: today },
            },
          },
        },
        { $inc: { "batches.$.quantity": -item.quantity } }
      );

      if (result.modifiedCount !== 1) {
        const error = new Error(
          "Stock changed while creating the sale. Please try again."
        );
        error.statusCode = 409;
        throw error;
      }

      stockChanges.push({
        medicineId: item.medicine,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    const sale = await Sale.create({
      invoiceNumber,
      patient: patient ? patient._id : null,
      items: saleItems,
      subtotal,
      discount: discountValue,
      grandTotal,
      amountPaid: Number(amountPaid),
      change: Number(amountPaid) - grandTotal,
      paymentMethod,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    for (const stockChange of stockChanges.reverse()) {
      try {
        const result = await Medicine.updateOne(
          {
            _id: stockChange.medicineId,
            "batches.batchNumber": stockChange.batchNumber,
          },
          { $inc: { "batches.$.quantity": stockChange.quantity } }
        );

        if (result.modifiedCount !== 1) {
          console.error(
            `Could not restore stock for medicine ${stockChange.medicineId}, batch ${stockChange.batchNumber}`
          );
        }
      } catch (rollbackError) {
        console.error("Sale stock rollback failed:", rollbackError.message);
      }
    }

    if (!error.statusCode) {
      console.error("Create sale error:", error.message);
    }

    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Sale create nahi hui. Database error; server logs mein details dekhein.",
    });
  }
};

const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("patient", "patientId name phone")
      .populate("createdBy", "name username")
      .sort({ createdAt: -1 });

    res.json({ count: sales.length, sales });
  } catch (error) {
    res.status(500).json({ message: "Sales fetch nahi ho sakin" });
  }
};

const getSaleById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await Sale.findById(req.params.id)
      .populate("patient", "patientId name phone")
      .populate("createdBy", "name username");

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.json({ sale });
  } catch (error) {
    res.status(500).json({ message: "Sale fetch nahi ho saki" });
  }
};

const getDailyReport = async (req, res) => {
  try {
    const date = req.query.date;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Date format YYYY-MM-DD hona chahiye",
      });
    }

    const start = date
      ? new Date(`${date}T00:00:00`)
      : new Date();

    if (!date) start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const report = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" },
          totalDiscount: { $sum: "$discount" },
          totalCollected: { $sum: "$amountPaid" },
          totalChange: { $sum: "$change" },
        },
      },
    ]);

    res.json({
      date: start.toLocaleDateString("en-CA"),
      report: report[0] || {
        totalBills: 0,
        totalSales: 0,
        totalDiscount: 0,
        totalCollected: 0,
        totalChange: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Daily report fetch nahi ho saki" });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  getDailyReport,
};