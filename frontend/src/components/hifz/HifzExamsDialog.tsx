import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hifzApi } from "../../api/entities";
import type { HifzExam } from "../../api/types";
import { useConfirm } from "../../context/ConfirmContext";
import { apiErrorMessage } from "../../lib/errors";
import { todayIso } from "./hifzUtils";

export default function HifzExamsDialog({
  student,
  onClose,
  onError,
  onChanged,
  readOnly = false,
  period,
}: {
  student: { id: number; name: string };
  onClose: () => void;
  onError: (msg: string) => void;
  onChanged?: () => void;
  readOnly?: boolean;
  /** Only list exams inside this period (the gradebook's current one). */
  period?: { from: string; to: string };
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<number | null>(null);
  // Default a new exam to the period's last day when that's in the past, else today.
  const defaultDate = () =>
    period && period.to < todayIso() ? period.to : todayIso();
  const [date, setDate] = useState<string>(defaultDate());
  const [title, setTitle] = useState<string>("");
  const [juzFrom, setJuzFrom] = useState<string>("");
  const [juzTo, setJuzTo] = useState<string>("");
  const [score, setScore] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  const { data: allExams } = useQuery({
    queryKey: ["hifz-exams", student.id],
    queryFn: () => hifzApi.exams(student.id),
  });
  const exams = period
    ? allExams?.filter((e) => e.date >= period.from && e.date <= period.to)
    : allExams;

  function resetForm() {
    setEditingId(null);
    setDate(defaultDate());
    setTitle("");
    setJuzFrom("");
    setJuzTo("");
    setScore("");
    setComment("");
  }

  function startEdit(exam: HifzExam) {
    setEditingId(exam.id);
    setDate(exam.date);
    setTitle(exam.title);
    setJuzFrom(exam.juz_from?.toString() ?? "");
    setJuzTo(exam.juz_to?.toString() ?? "");
    setScore(exam.score?.toString() ?? "");
    setComment(exam.comment ?? "");
  }

  const payload = () => ({
    student_id: student.id,
    date,
    title,
    juz_from: juzFrom === "" ? null : Number(juzFrom),
    juz_to: juzTo === "" ? null : Number(juzTo),
    score: score === "" ? null : Number(score),
    comment: comment === "" ? null : comment,
  });

  const createMutation = useMutation({
    mutationFn: () => hifzApi.createExam(payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] });
      onChanged?.();
    },
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  const updateMutation = useMutation({
    mutationFn: () => hifzApi.updateExam(editingId!, payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] });
      onChanged?.();
    },
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hifzApi.removeExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] });
      onChanged?.();
    },
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  async function handleSaveExam() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (!ok) return;
    if (editingId) updateMutation.mutate();
    else createMutation.mutate();
  }

  async function handleDeleteExam(id: number) {
    const ok = await confirm({
      message: t("common.confirm_delete"),
      destructive: true,
      confirmLabel: t("common.remove"),
    });
    if (!ok) return;
    deleteMutation.mutate(id);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("hifz.exams_title", { name: student.name })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(exams ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("hifz.exams_empty")}
          </Typography>
        )}
        {(exams ?? []).map((exam) => (
          <Box
            key={exam.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              pb: 1,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">
                {exam.date} — {exam.title}{" "}
                {exam.score !== null ? `(${exam.score})` : ""}
              </Typography>
              {exam.comment && (
                <Typography variant="caption" color="text.secondary">
                  {exam.comment}
                </Typography>
              )}
            </Box>
            {!readOnly && (
              <>
                <IconButton size="small" onClick={() => startEdit(exam)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteExam(exam.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        ))}

        {!readOnly && (
          <>
            <Typography variant="subtitle2">
              {editingId ? t("hifz.exam_edit") : t("hifz.exam_add")}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="date"
                label={t("hifz.exam_date")}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                size="small"
                type="number"
                label={t("hifz.exam_score")}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                slotProps={{ htmlInput: { min: 0, max: 100 } }}
                fullWidth
              />
            </Box>
            <TextField
              size="small"
              label={t("hifz.exam_title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="number"
                label={t("hifz.exam_juz_from")}
                value={juzFrom}
                onChange={(e) => setJuzFrom(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 30 } }}
                fullWidth
              />
              <TextField
                size="small"
                type="number"
                label={t("hifz.exam_juz_to")}
                value={juzTo}
                onChange={(e) => setJuzTo(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 30 } }}
                fullWidth
              />
            </Box>
            <TextField
              size="small"
              label={t("hifz.exam_comment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {editingId && (
          <Button onClick={resetForm}>{t("hifz.exam_cancel")}</Button>
        )}
        <Button onClick={onClose}>{t("common.close")}</Button>
        {!readOnly && (
          <Button
            variant="contained"
            disabled={
              !title.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            onClick={() => handleSaveExam()}
          >
            {editingId ? t("hifz.exam_save") : t("hifz.exam_add")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
