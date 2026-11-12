import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { monitoringApi } from "../api/entities";
import type { LessonMarkKind, TeacherSessionLogRow } from "../api/types";
import { useConfirm } from "../context/ConfirmContext";
import { apiErrorMessage } from "../lib/errors";
import { MARK_REASON_KEYS } from "../lib/monitoring";

const COMMENT_MAX = 500;

interface Props {
  row: TeacherSessionLogRow;
  onClose: () => void;
}

/** The rector's or dean's reason on a lesson that was never opened. Mount with a `key` per
 *  lesson so the form starts from that lesson's current mark. */
export default function LessonMarkDialog({ row, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<LessonMarkKind | "">(row.mark?.kind ?? "");
  const [comment, setComment] = useState(row.mark?.comment ?? "");

  // Both pages show these figures; refresh them so the new numbers appear without a reload.
  function refreshFigures() {
    queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-teacher-monitoring"] });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      monitoringApi.upsertMark({
        schedule_entry_id: row.schedule_entry_id,
        date: row.date,
        kind: kind as LessonMarkKind,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      refreshFigures();
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (markId: number) => monitoringApi.removeMark(markId),
    onSuccess: () => {
      refreshFigures();
      onClose();
    },
  });

  async function handleRemove() {
    if (!row.mark) return;
    const ok = await confirm({
      message: t("monitoring.remove_mark_confirm"),
      confirmLabel: t("monitoring.remove_mark"),
      destructive: true,
    });
    if (ok) removeMutation.mutate(row.mark.id);
  }

  const error = saveMutation.error ?? removeMutation.error;
  const busy = saveMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{t("monitoring.mark_reason")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {row.date} · {row.subject_name} · {row.group_name}
        </Typography>
        {error && <Alert severity="error">{apiErrorMessage(error, t("common.failed_to_save"), t)}</Alert>}
        <RadioGroup value={kind} onChange={(e) => setKind(e.target.value as LessonMarkKind)}>
          {(Object.keys(MARK_REASON_KEYS) as LessonMarkKind[]).map((key) => (
            <FormControlLabel
              key={key}
              value={key}
              control={<Radio />}
              label={t(MARK_REASON_KEYS[key])}
              sx={{ minHeight: 44 }}
            />
          ))}
        </RadioGroup>
        <TextField
          label={t("monitoring.mark_comment")}
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          multiline
          minRows={2}
          helperText={`${comment.length}/${COMMENT_MAX}`}
          fullWidth
        />
        {row.mark && (
          <Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={busy}
              onClick={handleRemove}
              fullWidth={isMobile}
              sx={{ minHeight: 44 }}
            >
              {t("monitoring.remove_mark")}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={!kind || busy}
          onClick={() => saveMutation.mutate()}
          sx={{ minHeight: 44 }}
        >
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
