
const Medicine = require("../models/Medicine");

const addMedicine = async (req, res) => {
  try {
    const {
      name,
      genericName,
      category,
      manufacturer,
      batchNumber,
      quantity,
      purchasePrice,
      salePrice,
      expiryDate,
      reorderLevel,
    } = req.body;

    if (
      !name ||
      !batchNumber ||
      quantity === undefined ||
      purchasePrice === undefined ||
      salePrice === undefined ||
      !expiryDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, batch, quantity, prices and expiry date are required",
      });
    }

    const numericValues = [
      quantity,
      purchasePrice,
      salePrice,
    ];

    if (
      numericValues.some(
        (value) => !Number.isFinite(value) || Number(value) < 0
      ) ||
      !Number.isInteger(Number(quantity))
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a non-negative integer and prices valid numbers",
      });
    }

    const parsedExpiry = new Date(expiryDate);

    if (Number.isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date",
      });
    }

    const medicine = await Medicine.create({
      name,
      genericName,
      category,
      manufacturer,
      reorderLevel: reorderLevel ?? 10,
      batches: [
        {
          batchNumber,
          quantity: Number(quantity),
          purchasePrice: Number(purchasePrice),
          salePrice: Number(salePrice),
          expiryDate: parsedExpiry,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Medicine added successfully",
      medicine,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Add medicine error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to add medicine",
    });
  }
};

const getMedicines = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    const filter = {
      isActive: true,
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { genericName: { $regex: search, $options: "i" } },
              { category: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const medicines = await Medicine.find(filter)
      .sort({ name: 1 })
      .lean();

    const result = medicines.map((medicine) => ({
      ...medicine,
      totalStock: medicine.batches.reduce(
        (total, batch) => total + batch.quantity,
        0
      ),
    }));

    res.json({
      success: true,
      count: result.length,
      medicines: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch medicines",
    });
  }
};

const getLowStock = async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: true }).lean();

    const lowStock = medicines
      .map((medicine) => {
        const totalStock = medicine.batches.reduce(
          (total, batch) => total + batch.quantity,
          0
        );

        return { ...medicine, totalStock };
      })
      .filter((medicine) => medicine.totalStock <= medicine.reorderLevel);

    res.json({
      success: true,
      count: lowStock.length,
      medicines: lowStock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch low-stock medicines",
    });
  }
};

module.exports = {
  addMedicine,
  getMedicines,
  getLowStock,
};
