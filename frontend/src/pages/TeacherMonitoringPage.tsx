import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { monitoringApi } from "../api/entities";
import type { TeacherMonitoringRow } from "../api/types";
import { nameById, useDepartments, useSemesters } from "../hooks/useReferenceData";

type RangePreset = "day" | "week" | "year";

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRange(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  if (preset === "day") return { from: toIso(today), to: toIso(today) };
  if (preset === "week") {
    const day = today.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    return { from: toIso(monday), to: toIso(today) };
  }
  const jan1 = new Date(today.getFullYear(), 0, 1);
  return { from: toIso(jan1), to: toIso(today) };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function TeacherMonitoringPage() {
  const { t } = useTranslation();
  const { data: semesters } = useSemesters();
  const { data: departments } = useDepartments();

  const [semesterId, setSemesterId] = useState<number | "">("");
  const [preset, setPreset] = useState<RangePreset>("week");
  const [drillDownTeacher, setDrillDownTeacher] = useState<TeacherMonitoringRow | null>(null);

  const activeSemester = semesters?.find((s) => s.is_active);
  const effectiveSemesterId = semesterId || activeSemester?.id || "";
  const range = useMemo(() => computeRange(preset), [preset]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["monitoring", "teachers", effectiveSemesterId, range.from, range.to],
    queryFn: () =>
      monitoringApi.teachers({ semester_id: Number(effectiveSemesterId), date_from: range.from, date_to: range.to }),
    enabled: Boolean(effectiveSemesterId),
  });

  const { data: sessionLog } = useQuery({
    queryKey: ["monitoring", "teacher-sessions", drillDownTeacher?.teacher_id, effectiveSemesterId, range.from, range.to],
    queryFn: () =>
      monitoringApi.teacherSessions(drillDownTeacher!.teacher_id, {
        semester_id: Number(effectiveSemesterId),
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: Boolean(drillDownTeacher) && Boolean(effectiveSemesterId),
  });

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ mr: 2, fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          {t("monitoring.title")}
        </Typography>
        <TextField
          select
          size="small"
          label={t("common.select_semester")}
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">
            {activeSemester ? `${t("common.active_prefix")} ${activeSemester.name}` : t("common.pick_semester")}
          </MenuItem>
          {(semesters ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={preset}
          onChange={(_e, value) => value && setPreset(value)}
        >
          <ToggleButton value="day">{t("monitoring.range_day")}</ToggleButton>
          <ToggleButton value="week">{t("monitoring.range_week")}</ToggleButton>
          <ToggleButton value="year">{t("monitoring.range_year")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {!effectiveSemesterId && <Alert severity="info">{t("common.pick_semester")}</Alert>}

      {effectiveSemesterId && !isLoading && (rows ?? []).length === 0 && (
        <Alert severity="info">{t("monitoring.empty_hint")}</Alert>
      )}

      {effectiveSemesterId && (rows ?? []).length > 0 && (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("monitoring.col_teacher")}</TableCell>
                <TableCell align="right">{t("monitoring.col_expected")}</TableCell>
                <TableCell align="right">{t("monitoring.col_conducted")}</TableCell>
                <TableCell align="right">{t("monitoring.col_missed")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows ?? []).map((row) => (
                <TableRow key={row.teacher_id} hover sx={{ cursor: "pointer" }} onClick={() => setDrillDownTeacher(row)}>
                  <TableCell>
                    <Typography variant="body2">{row.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {nameById(departments, row.department_id, (d) => d.name)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{row.expected_lessons}</TableCell>
                  <TableCell align="right">{row.conducted_lessons}</TableCell>
                  <TableCell align="right">
                    {row.missed_lessons > 0 ? (
                      <Chip size="small" color="error" label={row.missed_lessons} />
                    ) : (
                      row.missed_lessons
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(drillDownTeacher)} onClose={() => setDrillDownTeacher(null)} maxWidth="md" fullWidth>
        <DialogTitle>{t("monitoring.log_title", { name: drillDownTeacher?.full_name })}</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("monitoring.log_col_date")}</TableCell>
                  <TableCell>{t("monitoring.log_col_subject")}</TableCell>
                  <TableCell>{t("monitoring.log_col_group")}</TableCell>
                  <TableCell>{t("monitoring.log_col_status")}</TableCell>
                  <TableCell>{t("monitoring.log_col_checkin")}</TableCell>
                  <TableCell>{t("monitoring.log_col_checkout")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(sessionLog ?? []).map((row) => (
                  <TableRow key={`${row.date}-${row.subject_name}`} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell>
                    <TableCell>{row.subject_name}</TableCell>
                    <TableCell>{row.group_name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={row.conducted ? "success" : "error"}
                        label={row.conducted ? t("monitoring.status_conducted") : t("monitoring.status_missed")}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_in_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_out_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDrillDownTeacher(null)}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
