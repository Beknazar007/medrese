import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        bgcolor: "grey.100",
        px: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 360 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          {t("app_title")}
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {t("login.title")}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label={t("login.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label={t("login.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={submitting}>
            {t("login.submit")}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
