
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import api from "./api";
import AppLayout from "./components/AppLayout";
import Pharmacy from "./pages/Pharmacy";
import Billing from "./pages/Billing";
import { getDoctorOptions, normalizeDoctorSelection } from "./doctorOptions";

const todayKey = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const getRows = (response, key) => {
  const data = response.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data?.[key])) return data.data[key];

  return [];
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

function ProtectedRoute({ children }) {
  return localStorage.getItem("token")
    ? children
    : <Navigate to="/login" replace />;
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        username,
        password,
      });

      const data = response.data;
      const token = data.token || data.accessToken || data.data?.token;
      const user = data.user || data.data?.user || {};

      if (!token) {
        throw new Error(
          "Login response mein token nahi mila. Backend login response check karein."
        );
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  if (localStorage.getItem("token")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">CP</div>
        <h1>Clinic & Pharmacy</h1>
        <p className="muted">Sign in to your management system</p>

        {error && <div className="alert">{error}</div>}

        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />
        </label>

        <button className="primary-btn" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <p className="muted small-text">
          Setting up the clinic? <Link to="/signup">Create the first admin account</Link>
        </p>
      </form>
    </div>
  );
}

function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/register-admin", {
        name,
        username,
        email,
        password,
      });
      setSuccess(
        response.data.message ||
        "Admin account created successfully. You can now sign in."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Account registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (localStorage.getItem("token")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">CP</div>
        <h1>Create admin account</h1>
        <p className="muted">
          Sign up to set up your clinic management system.
        </p>

        {error && <div className="alert" role="alert">{error}</div>}
        {success && (
          <div className="success-alert" role="status">
            {success} <Link to="/login">Go to login</Link>
          </div>
        )}

        <label>
          Full name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />
        </label>

        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <button className="primary-btn" disabled={loading || Boolean(success)}>
          {loading ? "Creating account..." : "Create account"}
        </button>
        <p className="muted small-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

function Dashboard() {
  const [patientCount, setPatientCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
    async function loadDashboard() {
      const [patientsResult, appointmentsResult] =
        await Promise.allSettled([
          api.get("/patients"),
          api.get("/appointments", { params: { date: todayKey() } }),
        ]);

      if (patientsResult.status === "fulfilled") {
        setPatientCount(
          getRows(patientsResult.value, "patients").length
        );
      }

      if (appointmentsResult.status === "fulfilled") {
        const appointments = getRows(
          appointmentsResult.value,
          "appointments"
        );

        setAppointmentCount(appointments.length);
        setWaitingCount(
          appointments.filter((item) => item.status === "waiting").length
        );
      }

      if (
        patientsResult.status === "rejected" &&
        appointmentsResult.status === "rejected"
      ) {
        setError(
          "Dashboard data load nahi hui. Login, backend aur API permissions check karein."
        );
      }
    }

    loadDashboard();
  }, []);

  return (
    <AppLayout>
      <header className="page-header">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Welcome {user.name || user.username || "User"}
          </p>
        </div>
        <span className="date-chip">{todayKey()}</span>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Patients</span>
          <strong>{patientCount}</strong>
          <small>Registered records</small>
        </div>

        <div className="stat-card">
          <span>Today's Appointments</span>
          <strong>{appointmentCount}</strong>
          <small>Appointments for today</small>
        </div>

        <div className="stat-card">
          <span>Waiting Patients</span>
          <strong>{waitingCount}</strong>
          <small>Awaiting consultation</small>
        </div>
      </div>

      <section className="panel">
        <h2>Quick Actions</h2>
        <p className="muted">
          Patient registration aur daily queue yahan se manage karein.
        </p>

        <div className="action-row">
          {["admin", "doctor", "receptionist"].includes(user.role) && (
            <>
              <Link className="primary-btn" to="/patients">
                Register / Search Patient
              </Link>

              <Link className="secondary-link" to="/appointments">
                Open Appointment Queue
              </Link>
            </>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    patientId: "",
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    address: "",
  });

  async function loadPatients(searchValue = search) {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/patients", {
        params: searchValue ? { search: searchValue } : {},
      });

      setPatients(getRows(response, "patients"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Patients load nahi huay. API aur permissions check karein."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients("");
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeField(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const payload = {
        ...form,
        patientId: form.patientId.trim(),
        name: form.name.trim(),
        age: Number(form.age),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };

      await api.post("/patients", payload);

      setNotice("Patient successfully registered.");
      setForm({
        patientId: "",
        name: "",
        age: "",
        gender: "Male",
        phone: "",
        address: "",
      });

      await loadPatients("");
      setSearch("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Patient register nahi hua. Required fields check karein."
      );
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    await loadPatients(search);
  }

  return (
    <AppLayout>
      <header className="page-header">
        <div>
          <p className="eyebrow">CLINIC</p>
          <h1>Patients</h1>
          <p className="muted">Register new patients and search existing records.</p>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="success-alert">{notice}</div>}

      <section className="panel">
        <h2>Register Patient</h2>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Patient ID
            <input
              name="patientId"
              value={form.patientId}
              onChange={changeField}
              placeholder="e.g. PT-1001"
              required
            />
          </label>

          <label>
            Full Name
            <input
              name="name"
              value={form.name}
              onChange={changeField}
              placeholder="Patient name"
              required
            />
          </label>

          <label>
            Age
            <input
              name="age"
              type="number"
              min="0"
              max="125"
              value={form.age}
              onChange={changeField}
              required
            />
          </label>

          <label>
            Gender
            <select
              name="gender"
              value={form.gender}
              onChange={changeField}
              required
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label>
            Phone
            <input
              name="phone"
              value={form.phone}
              onChange={changeField}
              placeholder="03XXXXXXXXX"
            />
          </label>

          <label>
            Address
            <input
              name="address"
              value={form.address}
              onChange={changeField}
              placeholder="Patient address"
            />
          </label>

          <div className="form-actions">
            <button className="primary-btn" type="submit">
              Save Patient
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Patient Records</h2>

        <form className="search-row" onSubmit={handleSearch}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient ID, name or phone"
          />
          <button className="primary-btn" type="submit">
            Search
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => {
              setSearch("");
              loadPatients("");
            }}
          >
            Reset
          </button>
        </form>

        {loading ? (
          <p className="muted">Loading patients...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient._id}>
                    <td>{patient.patientId}</td>
                    <td>{patient.name}</td>
                    <td>{patient.age}</td>
                    <td>{patient.gender}</td>
                    <td>{patient.phone || "—"}</td>
                  </tr>
                ))}

                {patients.length === 0 && (
                  <tr>
                    <td colSpan="5">No patient records found.</td>
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

function Appointments() {
  const user = getUser();
  const [date, setDate] = useState(todayKey());
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState("all");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPatients() {
    try {
      const response = await api.get("/patients");
      setPatients(getRows(response, "patients"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Patient list load nahi hui."
      );
    }
  }

  async function loadDoctors() {
    try {
      const response = await api.get("/staff");
      const doctorList = getRows(response, "staff").filter(
        (doctor) => doctor.role === "doctor" && doctor.isActive !== false
      );

      setDoctors(doctorList);

      if (user.role === "doctor") {
        const currentDoctorId = normalizeDoctorSelection(
          doctorList,
          user.id || user._id
        );
        if (currentDoctorId) {
          setDoctorId(currentDoctorId);
          setSelectedDoctorFilter(currentDoctorId);
        }
      } else {
        setSelectedDoctorFilter("all");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Doctor list load nahi hui."
      );
    }
  }

  async function loadAppointments(day = date) {
    setError("");

    try {
      const response = await api.get("/appointments", {
        params: { date: day },
      });

      setAppointments(getRows(response, "appointments"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Appointment queue load nahi hui."
      );
    }
  }

  useEffect(() => {
    loadPatients();
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAppointments(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const payload = {
        patientId: selectedPatient,
        date,
        reason,
      };

      if (doctorId.trim()) {
        payload.doctorId = doctorId.trim();
      }

      await api.post("/appointments", payload);

      setNotice("Appointment created successfully.");
      setSelectedPatient("");
      setDoctorId("");
      setReason("");

      await loadAppointments(date);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Appointment create nahi hui."
      );
    }
  }

  async function changeStatus(id, status) {
    setError("");
    setNotice("");

    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setNotice(`Appointment status changed to ${status}.`);
      await loadAppointments(date);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Status update nahi hua."
      );
    }
  }

  async function assignDoctorToAppointment(id, nextDoctorId) {
    setError("");
    setNotice("");

    try {
      await api.patch(`/appointments/${id}/doctor`, {
        doctorId: nextDoctorId || null,
      });

      setNotice(
        nextDoctorId
          ? "Doctor assigned successfully."
          : "Doctor unassigned successfully."
      );

      await loadAppointments(date);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Doctor assignment update nahi hua."
      );
    }
  }

  function actionsFor(status) {
    let allowed = [];

    if (user.role === "admin") {
      allowed = [
        "waiting",
        "in_consultation",
        "completed",
        "cancelled",
      ];
    } else if (user.role === "doctor") {
      allowed = ["in_consultation", "completed"];
    } else if (user.role === "receptionist") {
      allowed = ["waiting", "cancelled"];
    }

    return allowed.filter((item) => item !== status);
  }

  const visibleAppointments = appointments.filter((item) => {
    if (selectedDoctorFilter === "all") {
      return true;
    }

    if (selectedDoctorFilter === "unassigned") {
      return !item.doctor;
    }

    return (
      item.doctor?._id === selectedDoctorFilter ||
      item.doctor === selectedDoctorFilter
    );
  });

  return (
    <AppLayout>
      <header className="page-header">
        <div>
          <p className="eyebrow">CLINIC</p>
          <h1>Appointment Queue</h1>
          <p className="muted">
            Manage appointments and daily patient tokens.
          </p>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="success-alert">{notice}</div>}

      <section className="panel">
        <h2>New Appointment</h2>

        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Appointment Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <label>
            Select Patient
            {patients.length === 0 ? (
              <div className="muted small-text" style={{ marginTop: "0.5rem" }}>
                No registered patients found. Please create a patient first from the
                Patients section before creating an appointment.
              </div>
            ) : (
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                required
              >
                <option value="">Select a registered patient</option>
                {patients.map((patient) => (
                  <option key={patient._id} value={patient._id}>
                    {patient.patientId} — {patient.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label>
            Select Doctor (optional)
            <select
              value={doctorId}
              onChange={(e) =>
                setDoctorId(normalizeDoctorSelection(doctors, e.target.value))
              }
            >
              <option value="">Unassigned</option>
              {getDoctorOptions(doctors).map((doctor) => (
                <option key={doctor.value} value={doctor.value}>
                  {doctor.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reason for Visit
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="General checkup"
              maxLength={500}
            />
          </label>

          <div className="form-actions">
            <button
              className="primary-btn"
              type="submit"
              disabled={patients.length === 0}
            >
              Create Appointment
            </button>
            {patients.length === 0 && (
              <Link className="secondary-link" to="/patients">
                Go to Patients
              </Link>
            )}
          </div>
        </form>

        <p className="muted small-text">
          Doctor ID khali chhorne par appointment unassigned queue mein rahegi.
          Doctor baad mein consultation start kar sakta hai.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Daily Queue</h2>
            <p className="muted">
              {visibleAppointments.length} appointment(s)
            </p>
          </div>

          <button
            className="secondary-btn"
            onClick={() => loadAppointments(date)}
          >
            Refresh
          </button>
        </div>

        {doctors.length > 0 && (
          <div className="queue-filter-row" style={{ marginBottom: "1rem" }}>
            <label style={{ display: "grid", gap: "0.5rem", maxWidth: "320px" }}>
              <span>Doctor Queue Filter</span>
              <select
                value={selectedDoctorFilter}
                onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              >
                <option value="all">All doctors</option>
                <option value="unassigned">Unassigned only</option>
                {getDoctorOptions(doctors).map((doctor) => (
                  <option key={doctor.value} value={doctor.value}>
                    {doctor.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleAppointments.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>#{item.tokenNumber}</strong>
                  </td>
                  <td>
                    {item.patient?.name || "Patient"}
                    <small className="table-subtitle">
                      {item.patient?.patientId || ""}
                    </small>
                  </td>
                  <td>
                    <select
                      value={item.doctor?._id || item.doctor || ""}
                      onChange={(e) =>
                        assignDoctorToAppointment(item._id, e.target.value)
                      }
                      style={{ minWidth: "150px" }}
                    >
                      <option value="">Unassigned</option>
                      {getDoctorOptions(doctors).map((doctor) => (
                        <option key={doctor.value} value={doctor.value}>
                          {doctor.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{item.reason || "—"}</td>
                  <td>
                    <span className={`status status-${item.status}`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="status-actions">
                      {actionsFor(item.status).map((status) => (
                        <button
                          key={status}
                          className="tiny-btn"
                          onClick={() => changeStatus(item._id, status)}
                        >
                          {status.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {visibleAppointments.length === 0 && (
                <tr>
                  <td colSpan="6">
                    No appointments found for this date and filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}

function NotFound() {
  return (
    <AppLayout>
      <h1>Page not found</h1>
      <Link to="/">Back to Dashboard</Link>
    </AppLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    
    <Route
  path="/pharmacy"
  element={
    <ProtectedRoute>
      <Pharmacy />
    </ProtectedRoute>
  }
/>

<Route
  path="/billing"
  element={
    <ProtectedRoute>
      <Billing />
    </ProtectedRoute>
  }
/>

      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <Patients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <Appointments />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFound />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
