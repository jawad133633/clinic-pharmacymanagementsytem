
import { NavLink, useNavigate } from "react-router-dom";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const canUseClinic = ["admin", "doctor", "receptionist"].includes(user.role);
  const canUsePharmacy = ["admin", "pharmacist"].includes(user.role);
  const canUseBilling = ["admin", "receptionist", "pharmacist"].includes(
    user.role
  );

  const navClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">CP</div>
          <div>
            <strong>ClinicCare</strong>
            <small>Management System</small>
          </div>
        </div>

        <nav className="navigation">
          <NavLink to="/" end className={navClass}>Dashboard</NavLink>

          {canUseClinic && (
            <>
              <NavLink to="/patients" className={navClass}>Patients</NavLink>
              <NavLink to="/appointments" className={navClass}>
                Appointment Queue
              </NavLink>
            </>
          )}

          {canUsePharmacy && (
            <NavLink to="/pharmacy" className={navClass}>
              Pharmacy Inventory
            </NavLink>
          )}

          {canUseBilling && (
            <NavLink to="/billing" className={navClass}>
              Billing & Sales
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          <span>{user.name || user.username || "Logged-in user"}</span>
          <small>{user.role || "User"}</small>
          <button className="secondary-btn" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
