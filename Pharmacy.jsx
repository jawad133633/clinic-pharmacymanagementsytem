
import { useEffect, useState } from "react";
import api from "../api";
import AppLayout from "../components/AppLayout";

function getRows(response, keys = []) {
  const data = response.data;

  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  return [];
}

function totalStock(medicine) {
  if (Number.isFinite(medicine.totalStock)) return medicine.totalStock;

  return (medicine.batches || []).reduce(
    (sum, batch) => sum + Number(batch.quantity || 0),
    0
  );
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;
}

export default function Pharmacy() {
  const [medicines, setMedicines] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [medicineForm, setMedicineForm] = useState({
    name: "",
    genericName: "",
    category: "",
    manufacturer: "",
    batchNumber: "",
    quantity: "",
    purchasePrice: "",
    salePrice: "",
    expiryDate: "",
    reorderLevel: "10",
  });

  const [batchForm, setBatchForm] = useState({
    medicineId: "",
    batchNumber: "",
    quantity: "",
    purchasePrice: "",
    salePrice: "",
    expiryDate: "",
  });

  async function loadInventory() {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.get("/medicines"),
      api.get("/medicines/low-stock"),
      api.get("/stock/expiring", { params: { days: 90 } }),
    ]);

    if (results[0].status === "fulfilled") {
      setMedicines(getRows(results[0].value, ["medicines", "items"]));
    } else {
      setError(
        results[0].reason?.response?.data?.message ||
        "Medicine list load nahi hui."
      );
    }

    if (results[1].status === "fulfilled") {
      setLowStock(
        getRows(results[1].value, ["medicines", "items"])
      );
    }

    if (results[2].status === "fulfilled") {
      setExpiring(
        getRows(results[2].value, ["batches", "items", "medicines"])
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  function changeMedicineField(event) {
    setMedicineForm({
      ...medicineForm,
      [event.target.name]: event.target.value,
    });
  }

  function changeBatchField(event) {
    setBatchForm({
      ...batchForm,
      [event.target.name]: event.target.value,
    });
  }

  async function handleAddMedicine(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const payload = {
        ...medicineForm,
        name: medicineForm.name.trim(),
        genericName: medicineForm.genericName.trim(),
        quantity: Number(medicineForm.quantity),
        purchasePrice: Number(medicineForm.purchasePrice),
        salePrice: Number(medicineForm.salePrice),
        reorderLevel: Number(medicineForm.reorderLevel || 10),
      };

      await api.post("/medicines", payload);

      setNotice("Medicine successfully added.");
      setMedicineForm({
        name: "",
        genericName: "",
        category: "",
        manufacturer: "",
        batchNumber: "",
        quantity: "",
        purchasePrice: "",
        salePrice: "",
        expiryDate: "",
        reorderLevel: "10",
      });

      await loadInventory();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Medicine add nahi hui. Required fields check karein."
      );
    }
  }

  async function handleAddBatch(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const { medicineId, ...fields } = batchForm;

      await api.post(`/stock/${medicineId}/batches`, {
        ...fields,
        quantity: Number(fields.quantity),
        purchasePrice: Number(fields.purchasePrice),
        salePrice: Number(fields.salePrice),
      });

      setNotice("New batch successfully added.");
      setBatchForm({
        medicineId: "",
        batchNumber: "",
        quantity: "",
        purchasePrice: "",
        salePrice: "",
        expiryDate: "",
      });

      await loadInventory();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Batch add nahi hua. Medicine aur batch details check karein."
      );
    }
  }

  return (
    <AppLayout>
      <header className="page-header">
        <div>
          <p className="eyebrow">PHARMACY</p>
          <h1>Inventory Management</h1>
          <p className="muted">
            Medicines, batch quantities, low stock and expiry tracking.
          </p>
        </div>

        <button className="secondary-btn" onClick={loadInventory}>
          Refresh
        </button>
      </header>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="success-alert">{notice}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Medicine Types</span>
          <strong>{medicines.length}</strong>
          <small>Medicine records</small>
        </div>

        <div className="stat-card">
          <span>Low Stock Records</span>
          <strong>{lowStock.length}</strong>
          <small>Reorder may be needed</small>
        </div>

        <div className="stat-card">
          <span>Expiring Batches</span>
          <strong>{expiring.length}</strong>
          <small>Expiring within 90 days</small>
        </div>
      </div>

      <section className="panel">
        <h2>Add New Medicine</h2>

        <form className="form-grid" onSubmit={handleAddMedicine}>
          <label>
            Medicine Name
            <input name="name" value={medicineForm.name}
              onChange={changeMedicineField} required />
          </label>

          <label>
            Generic Name
            <input name="genericName" value={medicineForm.genericName}
              onChange={changeMedicineField} />
          </label>

          <label>
            Category
            <input name="category" value={medicineForm.category}
              onChange={changeMedicineField} placeholder="Tablet, syrup, etc." />
          </label>

          <label>
            Manufacturer
            <input name="manufacturer" value={medicineForm.manufacturer}
              onChange={changeMedicineField} />
          </label>

          <label>
            Batch Number
            <input name="batchNumber" value={medicineForm.batchNumber}
              onChange={changeMedicineField} required />
          </label>

          <label>
            Initial Quantity
            <input type="number" min="0" name="quantity"
              value={medicineForm.quantity} onChange={changeMedicineField}
              required />
          </label>

          <label>
            Purchase Price
            <input type="number" min="0" step="0.01" name="purchasePrice"
              value={medicineForm.purchasePrice} onChange={changeMedicineField}
              required />
          </label>

          <label>
            Sale Price
            <input type="number" min="0" step="0.01" name="salePrice"
              value={medicineForm.salePrice} onChange={changeMedicineField}
              required />
          </label>

          <label>
            Expiry Date
            <input type="date" name="expiryDate"
              value={medicineForm.expiryDate} onChange={changeMedicineField}
              required />
          </label>

          <label>
            Reorder Level
            <input type="number" min="0" name="reorderLevel"
              value={medicineForm.reorderLevel} onChange={changeMedicineField}
              required />
          </label>

          <div className="form-actions">
            <button className="primary-btn" type="submit">
              Save Medicine
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Add Another Batch</h2>

        <form className="form-grid" onSubmit={handleAddBatch}>
          <label>
            Select Medicine
            <select name="medicineId" value={batchForm.medicineId}
              onChange={changeBatchField} required>
              <option value="">Select medicine</option>
              {medicines.map((medicine) => (
                <option key={medicine._id} value={medicine._id}>
                  {medicine.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batch Number
            <input name="batchNumber" value={batchForm.batchNumber}
              onChange={changeBatchField} required />
          </label>

          <label>
            Quantity
            <input type="number" min="0" name="quantity"
              value={batchForm.quantity} onChange={changeBatchField} required />
          </label>

          <label>
            Purchase Price
            <input type="number" min="0" step="0.01" name="purchasePrice"
              value={batchForm.purchasePrice} onChange={changeBatchField}
              required />
          </label>

          <label>
            Sale Price
            <input type="number" min="0" step="0.01" name="salePrice"
              value={batchForm.salePrice} onChange={changeBatchField}
              required />
          </label>

          <label>
            Expiry Date
            <input type="date" name="expiryDate"
              value={batchForm.expiryDate} onChange={changeBatchField}
              required />
          </label>

          <div className="form-actions">
            <button className="primary-btn" type="submit">
              Add Batch
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Medicine Stock</h2>

        {loading ? (
          <p className="muted">Loading inventory...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Generic Name</th>
                  <th>Total Stock</th>
                  <th>Batch Details</th>
                </tr>
              </thead>

              <tbody>
                {medicines.map((medicine) => (
                  <tr key={medicine._id}>
                    <td>
                      <strong>{medicine.name}</strong>
                      <small className="table-subtitle">
                        {medicine.category || ""}
                      </small>
                    </td>
                    <td>{medicine.genericName || "—"}</td>
                    <td>{totalStock(medicine)}</td>
                    <td>
                      {(medicine.batches || []).map((batch, index) => (
                        <div key={`${batch.batchNumber}-${index}`}>
                          <strong>{batch.batchNumber}</strong>
                          {" — Qty: "}{batch.quantity}
                          {" — Sale: "}{money(batch.salePrice)}
                          {" — Expiry: "}
                          {batch.expiryDate
                            ? new Date(batch.expiryDate).toLocaleDateString()
                            : "—"}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}

                {!medicines.length && (
                  <tr>
                    <td colSpan="4">No medicines found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Low Stock Medicines</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
              </tr>
            </thead>

            <tbody>
              {lowStock.map((medicine) => (
                <tr key={medicine._id}>
                  <td>{medicine.name || medicine.medicineName || "—"}</td>
                  <td>{medicine.totalStock ?? totalStock(medicine)}</td>
                  <td>{medicine.reorderLevel ?? "—"}</td>
                </tr>
              ))}

              {!lowStock.length && (
                <tr><td colSpan="3">No low-stock records returned.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Expiring Stock — Next 90 Days</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Quantity</th>
                <th>Expiry Date</th>
              </tr>
            </thead>

            <tbody>
              {expiring.map((item, index) => {
                const batch = item.batch || item;
                const medicineName =
                  item.medicineName || item.medicine?.name || item.name || "—";

                return (
                  <tr key={`${item._id || medicineName}-${index}`}>
                    <td>{medicineName}</td>
                    <td>{batch.batchNumber || "—"}</td>
                    <td>{batch.quantity ?? "—"}</td>
                    <td>
                      {batch.expiryDate
                        ? new Date(batch.expiryDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}

              {!expiring.length && (
                <tr><td colSpan="4">No expiring batches returned.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
