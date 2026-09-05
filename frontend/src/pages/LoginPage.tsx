import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(username, password);
      if (me.role === "TEACHER") navigate("/teacher");
      else if (me.role === "DEAN") navigate("/dean/teachers");
      else navigate("/rector");
    } catch {
      setError(t("login.error"));
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
      <div className="field" style={{ marginTop: 38 }}>
        <label className="field-label" htmlFor="username">
          {t("login.username")}
        </label>
        <input
          id="username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label className="field-label" htmlFor="password">
          <span>{t("login.password")}</span>
          <button
            type="button"
            className="text-btn"
            style={{ fontSize: 12.5 }}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? t("login.hide") : t("login.show")}
          </button>
        </label>
        <input
          id="password"
          className="input"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="field-error" style={{ marginTop: 10 }}>{error}</p>}
      <Button type="submit" variant="primary" block style={{ marginTop: 30 }} disabled={submitting}>
        {t("login.submit")}
      </Button>
    </form>
  );

  return (
    <div style={{ minHeight: "100svh", display: "flex" }}>
      {/* Left brand panel — desktop only */}
      <div
        className="login-brand-panel"
        style={{
          flex: 1.15,
          padding: 64,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 32 }}>{t("app_title")}</div>
        <h1
          style={{
            fontSize: "clamp(38px, 5vw, 64px)",
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            maxWidth: "9em",
            margin: 0,
          }}
        >
          {t("login.headline")}
        </h1>
        <p style={{ fontSize: 16, color: "var(--color-neutral-700)", maxWidth: "30em", marginTop: 20 }}>
          {t("login.desktop_subhead")}
        </p>
      </div>

      {/* Right form panel */}
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          background: "var(--color-neutral-100)",
          padding: "60px 28px 40px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="kicker">{t("login.kicker")}</div>
        <h1 style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.015em", margin: "8px 0 0" }}>
          {t("login.title")}
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--color-neutral-700)", maxWidth: 270, marginTop: 8 }}>
          {t("login.subhead")}
        </p>

        {form}

        <button
          type="button"
          className="text-btn"
          style={{ textAlign: "center", marginTop: 18, alignSelf: "center" }}
        >
          {t("login.forgot")}
        </button>

        <p
          style={{
            fontSize: 12.5,
            fontStyle: "italic",
            color: "var(--color-neutral-500)",
            marginTop: "auto",
            paddingTop: 40,
          }}
        >
          {t("login.footnote")}
        </p>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .login-brand-panel { display: none; }
        }
      `}</style>
    </div>
  );
}
