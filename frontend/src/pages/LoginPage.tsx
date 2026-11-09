import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SlowServerAlert } from "../components/SlowServerNotice";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The free backend sleeps when idle and needs ~25 s to start. Poke it as soon as the login form
  // opens, so it is usually awake by the time the password is typed. Fire-and-forget.
  useEffect(() => {
    try {
      fetch(new URL("/health", api.defaults.baseURL), { mode: "no-cors" }).catch(() => {});
    } catch {
      /* bad base URL — nothing to warm up */
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(username, password);
      navigate(me.role === "TEACHER" ? "/schedule" : "/dashboard");
    } catch {
      setError(t("login.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100svh",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 360 }}>
        <Box component="img" src="/pwa-icon-192.png" alt="" sx={{ width: 56, height: 56, borderRadius: 2, mb: 2, display: "block" }} />
        <Typography variant="h5" sx={{ mb: 3 }}>
          {t("app_title")}
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {t("login.title")}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label={t("login.username")}
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label={t("login.password")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <Alert severity="error">{error}</Alert>}
          <SlowServerAlert active={submitting} />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {t("login.submit")}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
