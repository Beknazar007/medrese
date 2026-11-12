import EditNoteIcon from "@mui/icons-material/EditNote";
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { monitoringApi } from "../api/entities";
import type { SessionStatus, TeacherMonitoringRow, TeacherSessionLogRow } from "../api/types";
import DateRangePicker from "../components/DateRangePicker";
import LessonMarkDialog from "../components/LessonMarkDialog";
import { nameById, useDepartments, useSemesters } from "../hooks/useReferenceData";
import { computeRange, type DateRange } from "../lib/dateRanges";
import { filledSx, STATUS_FILL, STATUS_INK } from "../lib/palette";
import { MARK_REASON_KEYS, percentColor, periodOutsideSemester } from "../lib/monitoring";
import SemesterSelect from "../components/SemesterSelect";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL_KEYS: Record<SessionStatus, string> = {
  CONDUCTED: "monitoring.status_conducted",
  CONDUCTED_BY_MARK: "monitoring.status_conducted_by_mark",
  MISSED: "monitoring.status_missed",
  EXCUSED: "monitoring.reason_excused",
  CANCELLED: "monitoring.reason_cancelled",
};

function rowStatus(row: TeacherSessionLogRow): SessionStatus {
  // An older backend has no `status` yet — fall back to the conducted flag.
  return row.status ?? (row.conducted ? "CONDUCTED" : "MISSED");
}

function LogChips({ row }: { row: TeacherSessionLogRow }) {
  const { t } = useTranslation();
  const status = rowStatus(row);
  const color = status === "CONDUCTED" || status === "CONDUCTED_BY_MARK" ? "success" : status === "MISSED" ? "error" : "default";
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      <Chip
        size="small"
        color={color}
        variant={status === "CONDUCTED_BY_MARK" ? "outlined" : "filled"}
        label={t(STATUS_LABEL_KEYS[status])}
      />
      {row.late && <Chip size="small" sx={filledSx(STATUS_FILL.late)} label={t("monitoring.status_late")} />}
      {row.no_student_marks && (
        <Chip size="small" variant="outlined" sx={{ borderColor: STATUS_INK.late, color: STATUS_INK.late }} label={t("monitoring.flag_no_marks")} />
      )}
      {row.early_finish && (
        <Chip size="small" variant="outlined" sx={{ borderColor: STATUS_INK.late, color: STATUS_INK.late }} label={t("monitoring.flag_early_finish")} />
      )}
    </Box>
  );
}

function MarkDetails({ row }: { row: TeacherSessionLogRow }) {
  const { t } = useTranslation();
  if (!row.mark) return null;
  return (
    <Box sx={{ mt: 0.5, fontSize: 12.5, color: "text.secondary" }}>
      <Box sx={{ color: "text.primary" }}>{t(MARK_REASON_KEYS[row.mark.kind])}</Box>
      {row.mark.comment && <Box sx={{ overflowWrap: "anywhere" }}>{row.mark.comment}</Box>}
      <Box>{t("monitoring.mark_by", { name: row.mark.marked_by ?? "—", date: formatDateTime(row.mark.marked_at) })}</Box>
    </Box>
  );
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
  const [markingRow, setMarkingRow] = useState<TeacherSessionLogRow | null>(null);

  const activeSemester = semesters?.find((s) => s.is_active);
  const effectiveSemesterId = semesterId || activeSemester?.id || "";
  const selectedSemester = semesters?.find((s) => s.id === effectiveSemesterId);
  const outsideSemester = periodOutsideSemester(range, selectedSemester);

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

  const markButton = (row: TeacherSessionLogRow, fullWidth: boolean) =>
    row.can_mark ? (
      <Button
        variant="outlined"
        size={fullWidth ? "medium" : "small"}
        startIcon={<EditNoteIcon />}
        fullWidth={fullWidth}
        sx={{ minHeight: fullWidth ? 44 : 36, whiteSpace: "nowrap" }}
        onClick={() => setMarkingRow(row)}
      >
        {t("monitoring.mark_reason")}
      </Button>
    ) : null;

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ mr: 2 }}>
          {t("monitoring.title")}
        </Typography>
        <SemesterSelect value={semesterId} onChange={setSemesterId} sx={{ minWidth: 200 }} />
        <DateRangePicker value={range} onChange={setRange} />
      </Box>

      {!effectiveSemesterId && <Alert severity="info">{t("common.pick_semester")}</Alert>}

      {effectiveSemesterId && !isLoading && (rows ?? []).length === 0 && (
        <Alert severity="info">{t(outsideSemester ? "monitoring.out_of_semester" : "monitoring.empty_hint")}</Alert>
      )}

      {/* Phones: a card per teacher with the numbers as small labelled tiles. */}
      {isMobile && effectiveSemesterId && (rows ?? []).length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(rows ?? []).map((row) => {
            const percent = row.conducted_percent;
            const attention = row.attention_lessons ?? 0;
            const stats: { label: string; value: number | string; color?: string }[] = [
              { label: t("monitoring.col_expected"), value: row.expected_lessons },
              { label: t("monitoring.col_conducted"), value: row.conducted_lessons },
              { label: t("monitoring.col_missed"), value: row.missed_lessons, color: row.missed_lessons > 0 ? "error.main" : undefined },
              { label: t("monitoring.col_late"), value: row.late_lessons, color: row.late_lessons > 0 ? STATUS_INK.late : undefined },
              { label: t("monitoring.col_attention"), value: attention, color: attention > 0 ? STATUS_INK.late : undefined },
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
                  {percent !== null && <Chip size="small" sx={filledSx(percentColor(percent))} label={`${percent}%`} />}
                </Box>
                {/* auto-fit: the tiles wrap to a second row instead of scrolling the page sideways. */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))", gap: 0.75, mt: 1 }}>
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
                <TableCell align="right">{t("monitoring.col_attention")}</TableCell>
                <TableCell align="right">{t("monitoring.col_percent")}</TableCell>
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
                      <Chip size="small" sx={filledSx(STATUS_FILL.late)} label={row.late_lessons} />
                    ) : (
                      row.late_lessons
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {(row.attention_lessons ?? 0) > 0 ? (
                      <Chip size="small" sx={filledSx(STATUS_FILL.late)} label={row.attention_lessons} />
                    ) : (
                      row.attention_lessons ?? "—"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {row.conducted_percent === null ? (
                      "—"
                    ) : (
                      <Chip
                        size="small"
                        sx={filledSx(percentColor(row.conducted_percent))}
                        label={`${row.conducted_percent}%`}
                      />
                    )}
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
                <Paper key={`${row.date}-${row.schedule_entry_id}`} variant="outlined" sx={{ p: 1.25 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.date}
                    </Typography>
                    <LogChips row={row} />
                  </Box>
                  <Typography variant="body2">
                    {row.subject_name} · {row.group_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("monitoring.log_col_checkin")}: {formatDateTime(row.checked_in_at)} · {t("monitoring.log_col_checkout")}:{" "}
                    {formatDateTime(row.checked_out_at)}
                  </Typography>
                  <MarkDetails row={row} />
                  {row.can_mark && <Box sx={{ mt: 1 }}>{markButton(row, true)}</Box>}
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
                  <TableCell>{t("monitoring.log_col_actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(sessionLog ?? []).map((row) => (
                  <TableRow key={`${row.date}-${row.schedule_entry_id}`} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell>
                    <TableCell>{row.subject_name}</TableCell>
                    <TableCell>{row.group_name}</TableCell>
                    <TableCell>
                      <LogChips row={row} />
                      <MarkDetails row={row} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_in_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.checked_out_at)}</TableCell>
                    <TableCell>{markButton(row, false)}</TableCell>
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

      {markingRow && (
        <LessonMarkDialog
          key={`${markingRow.schedule_entry_id}-${markingRow.date}`}
          row={markingRow}
          onClose={() => setMarkingRow(null)}
        />
      )}
    </Box>
  );
}
