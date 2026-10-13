
const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },
    batches: [
      {
        batchNumber: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        purchasePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        salePrice: {
          type: Number,
          required: true,
          min: 0,
        },
        expiryDate: {
          type: Date,
          required: true,
        },
      },
    ],
    reorderLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

medicineSchema.index({ name: 1 });

module.exports = mongoose.model("Medicine", medicineSchema);