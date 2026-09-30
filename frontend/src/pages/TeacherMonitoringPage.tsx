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
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { monitoringApi } from "../api/entities";
import type { TeacherMonitoringRow } from "../api/types";
import DateRangePicker from "../components/DateRangePicker";
import { nameById, useDepartments, useSemesters } from "../hooks/useReferenceData";
import { computeRange, type DateRange } from "../lib/dateRanges";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const SCORE_GOOD = "#0ca30c";
const SCORE_WARNING = "#fab219";
const SCORE_CRITICAL = "#d03b3b";

function performanceScore(row: TeacherMonitoringRow): number | null {
  if (row.expected_lessons <= 0) return null;
  return Math.max(0, Math.round(((row.conducted_lessons - row.late_lessons) / row.expected_lessons) * 100));
}

function scoreColor(score: number): string {
  if (score >= 90) return SCORE_GOOD;
  if (score >= 70) return SCORE_WARNING;
  return SCORE_CRITICAL;
}

export default function TeacherMonitoringPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: semesters } = useSemesters();
  const { data: departments } = useDepartments();

  const [semesterId, setSemesterId] = useState<number | "">("");
  const [range, setRange] = useState<DateRange>(() => computeRange("week"));
  const [drillDownTeacher, setDrillDownTeacher] = useState<TeacherMonitoringRow | null>(null);

  const activeSemester = semesters?.find((s) => s.is_active);
  const effectiveSemesterId = semesterId || activeSemester?.id || "";

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
        <DateRangePicker value={range} onChange={setRange} />
      </Box>

      {!effectiveSemesterId && <Alert severity="info">{t("common.pick_semester")}</Alert>}

      {effectiveSemesterId && !isLoading && (rows ?? []).length === 0 && (
        <Alert severity="info">{t("monitoring.empty_hint")}</Alert>
      )}

      {/* Phones: a card per teacher with the numbers as small labelled tiles. */}
      {isMobile && effectiveSemesterId && (rows ?? []).length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(rows ?? []).map((row) => {
            const score = performanceScore(row);
            const stats: { label: string; value: number | string; color?: string }[] = [
              { label: t("monitoring.col_expected"), value: row.expected_lessons },
              { label: t("monitoring.col_conducted"), value: row.conducted_lessons },
              { label: t("monitoring.col_missed"), value: row.missed_lessons, color: row.missed_lessons > 0 ? "error.main" : undefined },
              { label: t("monitoring.col_late"), value: row.late_lessons, color: row.late_lessons > 0 ? "#d98e00" : undefined },
            ];
            return (
              <Paper key={row.teacher_id} variant="outlined" sx={{ p: 1.5, cursor: "pointer" }} onClick={() => setDrillDownTeacher(row)}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {nameById(departments, row.department_id, (d) => d.name)}
                    </Typography>
                  </Box>
                  {score !== null && <Chip size="small" sx={{ bgcolor: scoreColor(score), color: "#fff" }} label={`${score}%`} />}
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.75, mt: 1 }}>
                  {stats.map((st) => (
                    <Box key={st.label} sx={{ bgcolor: "action.hover", borderRadius: 1, px: 0.75, py: 0.5, minWidth: 0 }}>
                      <Box sx={{ fontSize: 10.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {st.label}
                      </Box>
                      <Box sx={{ fontWeight: 600, color: st.color }}>{st.value}</Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {!isMobile && effectiveSemesterId && (rows ?? []).length > 0 && (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("monitoring.col_teacher")}</TableCell>
                <TableCell align="right">{t("monitoring.col_expected")}</TableCell>
                <TableCell align="right">{t("monitoring.col_conducted")}</TableCell>
                <TableCell align="right">{t("monitoring.col_missed")}</TableCell>
                <TableCell align="right">{t("monitoring.col_late")}</TableCell>
                <TableCell align="right">{t("monitoring.col_score")}</TableCell>
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
                  <TableCell align="right">
                    {row.late_lessons > 0 ? (
                      <Chip size="small" sx={{ bgcolor: "#fab219", color: "#fff" }} label={row.late_lessons} />
                    ) : (
                      row.late_lessons
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {(() => {
                      const score = performanceScore(row);
                      return score === null ? (
                        "—"
                      ) : (
                        <Chip size="small" sx={{ bgcolor: scoreColor(score), color: "#fff" }} label={`${score}%`} />
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(drillDownTeacher)} onClose={() => setDrillDownTeacher(null)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{t("monitoring.log_title", { name: drillDownTeacher?.full_name })}</DialogTitle>
        <DialogContent>
          {isMobile && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {(sessionLog ?? []).map((row) => (
                <Paper key={`${row.date}-${row.subject_name}`} variant="outlined" sx={{ p: 1.25 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.date}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Chip
                        size="small"
                        color={row.conducted ? "success" : "error"}
                        label={row.conducted ? t("monitoring.status_conducted") : t("monitoring.status_missed")}
                      />
                      {row.late && <Chip size="small" sx={{ bgcolor: "#fab219", color: "#fff" }} label={t("monitoring.status_late")} />}
                    </Box>
                  </Box>
                  <Typography variant="body2">
                    {row.subject_name} · {row.group_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("monitoring.log_col_checkin")}: {formatDateTime(row.checked_in_at)} · {t("monitoring.log_col_checkout")}:{" "}
                    {formatDateTime(row.checked_out_at)}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
          {!isMobile && (
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
                    <TableCell sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        color={row.conducted ? "success" : "error"}
                        label={row.conducted ? t("monitoring.status_conducted") : t("monitoring.status_missed")}
                      />
                      {row.late && (
                        <Chip size="small" sx={{ bgcolor: "#fab219", color: "#fff" }} label={t("monitoring.status_late")} />
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_in_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_out_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDrillDownTeacher(null)}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
