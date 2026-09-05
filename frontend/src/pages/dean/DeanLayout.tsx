import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";

export default function DeanLayout() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100svh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "18px 40px",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <strong style={{ fontSize: 18 }}>{t("app_title")}</strong>
        <nav style={{ display: "flex", gap: 20, fontSize: 14.5 }}>
          <NavLink to="/dean/teachers" style={navStyle}>
            {t("dean.teachers_title")}
          </NavLink>
          <NavLink to="/dean/assignments" style={navStyle}>
            {t("dean.assignments_title")}
          </NavLink>
          <NavLink to="/dean/schedule" style={navStyle}>
            {t("dean.schedule_title")}
          </NavLink>
          <NavLink to="/admin/subjects" style={navStyle}>
            {t("dean.select_subject")}
          </NavLink>
          <NavLink to="/admin/groups" style={navStyle}>
            {t("dean.select_group")}
          </NavLink>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            style={{ border: "none", background: "none", fontFamily: "inherit", fontSize: 13 }}
          >
            <option value="ky">KY</option>
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
          <button className="text-btn" onClick={handleLogout}>
            {t("nav.logout")}
          </button>
        </div>
      </header>
      <main style={{ padding: "32px 40px" }}>
        <Outlet />
      </main>
    </div>
  );
}

const navStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? "var(--color-text)" : "var(--color-neutral-600)",
  fontWeight: isActive ? 600 : 400,
  textDecoration: "none",
});
