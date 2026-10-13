
const mongoose = require("mongoose");
const Medicine = require("../models/Medicine");

const addBatch = async (req, res) => {
  try {
    const {
      batchNumber,
      quantity,
      purchasePrice,
      salePrice,
      expiryDate,
    } = req.body;

    if (
      !batchNumber ||
      quantity === undefined ||
      purchasePrice === undefined ||
      salePrice === undefined ||
      !expiryDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Batch number, quantity, prices and expiry date are required",
      });
    }

    if (
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 0 ||
      !Number.isFinite(Number(purchasePrice)) ||
      Number(purchasePrice) < 0 ||
      !Number.isFinite(Number(salePrice)) ||
      Number(salePrice) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid quantity and prices",
      });
    }

    const parsedExpiry = new Date(expiryDate);

    if (Number.isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    const duplicateBatch = medicine.batches.some(
      (batch) =>
        batch.batchNumber.toLowerCase() === batchNumber.trim().toLowerCase()
    );

    if (duplicateBatch) {
      return res.status(409).json({
        success: false,
        message: "This batch number already exists for this medicine",
      });
    }

    medicine.batches.push({
      batchNumber: batchNumber.trim(),
      quantity: Number(quantity),
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      expiryDate: parsedExpiry,
    });

    await medicine.save();

    res.status(201).json({
      success: true,
      message: "New stock batch added successfully",
      medicine,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID",
      });
    }

    console.error("Add stock batch error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to add stock batch",
    });
  }
};

const getExpiringStock = async (req, res) => {
  try {
    const days = Number(req.query.days ?? 90);

    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        message: "Days must be an integer between 1 and 365",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const medicines = await Medicine.find({
      isActive: true,
      "batches.quantity": { $gt: 0 },
    }).lean();

    const expiringStock = [];

    for (const medicine of medicines) {
      for (const batch of medicine.batches) {
        if (
          batch.quantity > 0 &&
          new Date(batch.expiryDate) >= today &&
          new Date(batch.expiryDate) <= endDate
        ) {
          expiringStock.push({
            medicineId: medicine._id,
            medicineName: medicine.name,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            expiryDate: batch.expiryDate,
          });
        }
      }
    }

    res.json({
      success: true,
      count: expiringStock.length,
      batches: expiringStock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch expiring stock",
    });
  }
};

module.exports = {
  addBatch,
  getExpiringStock,
};