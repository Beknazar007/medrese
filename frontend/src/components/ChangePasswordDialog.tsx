import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/entities";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ChangePasswordDialog({ open, onClose, onChanged }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: async () => {
      await refreshUser();
      reset();
      onClose();
      onChanged?.();
    },
    onError: (err) => setError(apiErrorMessage(err, t("password.change_failed"), t)),
  });

  function handleSubmit() {
    setError(null);
    if (newPassword.length < 6) {
      setError(t("password.too_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("password.mismatch"));
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("password.dialog_title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t("password.current")}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label={t("password.new_password")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("password.confirm")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            error={Boolean(error)}
            helperText={error ?? " "}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("password.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!currentPassword || !newPassword || !confirmPassword || mutation.isPending}
        >
          {t("password.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
