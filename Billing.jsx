
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

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function todayKey() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function Billing() {
  const [medicines, setMedicines] = useState([]);
  const [patients, setPatients] = useState([]);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState(null);
  const [recentSale, setRecentSale] = useState(null);

  const [medicineId, setMedicineId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [patientId, setPatientId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [reportDate, setReportDate] = useState(todayKey());

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const selectedMedicine = medicines.find(
    (medicine) => medicine._id === medicineId
  );

  const selectedBatch = selectedMedicine?.batches?.find(
    (batch) => batch.batchNumber === batchNumber
  );

  const subtotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const discountValue = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountValue);
  const paymentValue = Number(amountPaid) || 0;
  const change = Math.max(0, paymentValue - grandTotal);

  async function loadData() {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.get("/medicines"),
      api.get("/patients"),
      api.get("/sales"),
    ]);

    if (results[0].status === "fulfilled") {
      setMedicines(getRows(results[0].value, ["medicines", "items"]));
    } else {
      setError(
        results[0].reason?.response?.data?.message ||
        "Medicine inventory load nahi hui."
      );
    }

    if (results[1].status === "fulfilled") {
      setPatients(getRows(results[1].value, ["patients", "items"]));
    }

    if (results[2].status === "fulfilled") {
      setSales(getRows(results[2].value, ["sales", "items"]));
    }

    if (user.role === "admin") {
      try {
        const reportResponse = await api.get("/sales/daily-report", {
          params: { date: reportDate },
        });

        setReport(reportResponse.data.report || null);
      } catch {
        setReport(null);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // Initial page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshReport(date = reportDate) {
    if (user.role !== "admin") return;

    try {
      const response = await api.get("/sales/daily-report", {
        params: { date },
      });

      setReport(response.data.report || null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Daily report load nahi hui."
      );
    }
  }

  function addToCart(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!selectedMedicine || !selectedBatch) {
      setError("Medicine aur batch select karein.");
      return;
    }

    const quantityNumber = Number(quantity);

    if (!Number.isInteger(quantityNumber) || quantityNumber < 1) {
      setError("Quantity kam az kam 1 honi chahiye.");
      return;
    }

    const expiryDay = selectedBatch.expiryDate
      ? String(selectedBatch.expiryDate).slice(0, 10)
      : "";

    if (expiryDay && expiryDay < todayKey()) {
      setError("Expired batch sale nahi kar sakte.");
      return;
    }

    const existing = cart.find(
      (item) =>
        item.medicineId === medicineId &&
        item.batchNumber === batchNumber
    );

    const existingQuantity = existing?.quantity || 0;
    const available = Number(selectedBatch.quantity || 0);

    if (existingQuantity + quantityNumber > available) {
      setError(`Stock available ${available} hai.`);
      return;
    }

    const nextItem = {
      medicineId: selectedMedicine._id,
      medicineName: selectedMedicine.name,
      batchNumber: selectedBatch.batchNumber,
      quantity: quantityNumber,
      unitPrice: Number(selectedBatch.salePrice),
      available,
    };

    if (existing) {
      setCart(
        cart.map((item) =>
          item.medicineId === medicineId &&
          item.batchNumber === batchNumber
            ? { ...item, quantity: item.quantity + quantityNumber }
            : item
        )
      );
    } else {
      setCart([...cart, nextItem]);
    }

    setQuantity("1");
    setNotice("Medicine added to bill.");
  }

  function removeFromCart(medicineIdToRemove, batchToRemove) {
    setCart(
      cart.filter(
        (item) =>
          !(
            item.medicineId === medicineIdToRemove &&
            item.batchNumber === batchToRemove
          )
      )
    );
  }

  async function handleCreateSale(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setRecentSale(null);

    if (!cart.length) {
      setError("Bill mein kam az kam ek medicine add karein.");
      return;
    }

    if (!Number.isFinite(Number(discount)) || discountValue < 0) {
      setError("Valid discount enter karein.");
      return;
    }

    if (discountValue > subtotal) {
      setError("Discount subtotal se zyada nahi ho sakta.");
      return;
    }

    if (
      amountPaid === "" ||
      !Number.isFinite(Number(amountPaid)) ||
      paymentValue < grandTotal
    ) {
      setError("Amount paid bill ke total ke barabar ya zyada hona chahiye.");
      return;
    }

    const payload = {
      items: cart.map((item) => ({
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
      })),
      discount: discountValue,
      amountPaid: paymentValue,
      paymentMethod,
    };

    // Patient optional hai; blank select karne par walk-in sale banegi.
    if (patientId) payload.patientId = patientId;

    try {
      const response = await api.post("/sales", payload);
      const sale = response.data.sale || response.data.data?.sale;

      if (!sale) {
        throw new Error("Sale create hui, lekin response mein sale details nahi milin.");
      }

      setRecentSale(sale);
      setNotice("Sale successfully created. Stock update ho gaya hai.");
      setCart([]);
      setDiscount("0");
      setAmountPaid("");
      setPatientId("");

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Sale create nahi hui."
      );
    }
  }

  return (
    <AppLayout>
      <header className="page-header no-print">
        <div>
          <p className="eyebrow">PHARMACY</p>
          <h1>Billing & Sales</h1>
          <p className="muted">
            Create sales, manage the bill and print receipts.
          </p>
        </div>

        <button className="secondary-btn" onClick={loadData}>
          Refresh
        </button>
      </header>

      {error && <div className="alert no-print">{error}</div>}
      {notice && <div className="success-alert no-print">{notice}</div>}

      {user.role === "admin" && (
        <section className="panel no-print">
          <div className="section-heading">
            <div>
              <h2>Daily Collection Report</h2>
              <p className="muted">Select the date for the sales report.</p>
            </div>
          </div>

          <div className="search-row">
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
            />

            <button
              className="primary-btn"
              onClick={() => refreshReport(reportDate)}
            >
              Load Report
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Total Bills</span>
              <strong>{report?.totalBills ?? 0}</strong>
            </div>

            <div className="stat-card">
              <span>Total Sales</span>
              <strong>{money(report?.totalSales)}</strong>
            </div>

            <div className="stat-card">
              <span>Total Discount</span>
              <strong>{money(report?.totalDiscount)}</strong>
            </div>
          </div>

          <p>
            Total Collected: <strong>{money(report?.totalCollected)}</strong>
          </p>
          <p>
            Change Returned: <strong>{money(report?.totalChange)}</strong>
          </p>
        </section>
      )}

      <section className="panel no-print">
        <h2>Create Bill</h2>

        <label className="field-label">
          Patient (optional)
          <select
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
          >
            <option value="">Walk-in sale — no patient linked</option>
            {patients.map((patient) => (
              <option key={patient._id} value={patient._id}>
                {patient.patientId} — {patient.name}
              </option>
            ))}
          </select>
        </label>

        <form className="form-grid" onSubmit={addToCart}>
          <label>
            Medicine
            <select
              value={medicineId}
              onChange={(event) => {
                setMedicineId(event.target.value);
                setBatchNumber("");
              }}
              required
            >
              <option value="">Select medicine</option>
              {medicines.map((medicine) => (
                <option key={medicine._id} value={medicine._id}>
                  {medicine.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batch
            <select
              value={batchNumber}
              onChange={(event) => setBatchNumber(event.target.value)}
              required
              disabled={!selectedMedicine}
            >
              <option value="">Select batch</option>
              {(selectedMedicine?.batches || []).map((batch, index) => {
                const expiryDay = batch.expiryDate
                  ? String(batch.expiryDate).slice(0, 10)
                  : "";

                const expired = expiryDay && expiryDay < todayKey();
                const unavailable =
                  Number(batch.quantity || 0) < 1 || expired;

                return (
                  <option
                    key={`${batch.batchNumber}-${index}`}
                    value={batch.batchNumber}
                    disabled={unavailable}
                  >
                    {batch.batchNumber} — Stock: {batch.quantity} — Price:{" "}
                    {money(batch.salePrice)}
                    {expired ? " — EXPIRED" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="1"
              max={selectedBatch?.quantity || undefined}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>

          <div className="form-actions">
            <button className="primary-btn" type="submit">
              Add to Bill
            </button>
          </div>
        </form>

        {selectedBatch && (
          <p className="muted">
            Available stock: {selectedBatch.quantity} | Unit price:{" "}
            {money(selectedBatch.salePrice)}
          </p>
        )}
      </section>

      <section className="panel no-print">
        <h2>Current Bill</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {cart.map((item) => (
                <tr key={`${item.medicineId}-${item.batchNumber}`}>
                  <td>{item.medicineName}</td>
                  <td>{item.batchNumber}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unitPrice)}</td>
                  <td>{money(item.unitPrice * item.quantity)}</td>
                  <td>
                    <button
                      className="tiny-btn"
                      type="button"
                      onClick={() =>
                        removeFromCart(item.medicineId, item.batchNumber)
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {!cart.length && (
                <tr>
                  <td colSpan="6">No items in the bill yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bill-summary">
          <p>Subtotal: <strong>{money(subtotal)}</strong></p>

          <label className="field-label">
            Discount (Rs.)
            <input
              type="number"
              min="0"
              max={subtotal}
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </label>

          <p className="bill-total">Grand Total: {money(grandTotal)}</p>

          <form onSubmit={handleCreateSale} className="payment-form">
            <label className="field-label">
              Payment Method
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="field-label">
              Amount Paid (Rs.)
              <input
                type="number"
                min={grandTotal}
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                required
              />
            </label>

            <p>Change to return: <strong>{money(change)}</strong></p>

            <button
              className="primary-btn"
              type="submit"
              disabled={!cart.length || loading}
            >
              {loading ? "Please wait..." : "Complete Sale"}
            </button>
          </form>
        </div>
      </section>

      {recentSale && (
        <section className="panel receipt">
          <div className="receipt-heading">
            <h2>Clinic & Pharmacy</h2>
            <p>Sales Receipt</p>
            <strong>{recentSale.invoiceNumber}</strong>
            <small>{dateText(recentSale.createdAt)}</small>
          </div>

          <div className="receipt-meta">
            <p>
              Patient:{" "}
              {recentSale.patient?.name || "Walk-in customer"}
            </p>
            <p>Payment: {recentSale.paymentMethod}</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {(recentSale.items || []).map((item, index) => (
                  <tr key={`${item.medicine}-${item.batchNumber}-${index}`}>
                    <td>
                      {item.medicineName}
                      <small className="table-subtitle">
                        Batch: {item.batchNumber}
                      </small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPrice)}</td>
                    <td>{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="receipt-totals">
            <p>Subtotal: {money(recentSale.subtotal)}</p>
            <p>Discount: {money(recentSale.discount)}</p>
            <p><strong>Total: {money(recentSale.grandTotal)}</strong></p>
            <p>Paid: {money(recentSale.amountPaid)}</p>
            <p>Change: {money(recentSale.change)}</p>
          </div>

          <div className="no-print receipt-actions">
            <button className="primary-btn" onClick={() => window.print()}>
              Print Receipt
            </button>
          </div>

          <p className="receipt-footer">Thank you.</p>
        </section>
      )}

      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Recent Sales</h2>
            <p className="muted">Latest saved invoices.</p>
          </div>

          <button className="secondary-btn" onClick={loadData}>
            Refresh Sales
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading sales...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {sales.slice(0, 20).map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.invoiceNumber}</td>
                    <td>{dateText(sale.createdAt)}</td>
                    <td>{sale.patient?.name || "Walk-in"}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>{money(sale.grandTotal)}</td>
                  </tr>
                ))}

                {!sales.length && (
                  <tr>
                    <td colSpan="5">No sales found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
