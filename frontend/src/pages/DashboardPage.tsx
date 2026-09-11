import {
  Alert,
  Box,
  Button,
  Chip,
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
import DownloadIcon from "@mui/icons-material/Download";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { dashboardApi, reportsApi } from "../api/entities";
import AttendanceBar from "../components/AttendanceBar";
import MonitoringBar from "../components/MonitoringBar";
import StatTile from "../components/StatTile";
import WorkloadBars from "../components/WorkloadBars";
import { useDepartments, useGroups, useSemesters } from "../hooks/useReferenceData";
import { computeRange, type RangePreset } from "../lib/dateRanges";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const ATTENDANCE_LEGEND: { key: "present" | "late" | "excused" | "absent"; color: string }[] = [
  { key: "present", color: "#0ca30c" },
  { key: "late", color: "#fab219" },
  { key: "excused", color: "#2a78d6" },
  { key: "absent", color: "#d03b3b" },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: semesters } = useSemesters();
  const { data: departments } = useDepartments();
  const { data: groups } = useGroups();
  const activeSemester = semesters?.find((s) => s.is_active);
  const [semesterId, setSemesterId] = useState<number | "">("");
  const effectiveSemesterId = semesterId || activeSemester?.id || "";
  const [preset, setPreset] = useState<RangePreset>("week");
  const range = useMemo(() => computeRange(preset), [preset]);
  const [reportGroupId, setReportGroupId] = useState<number | "">("");

  const downloadReportMutation = useMutation({
    mutationFn: () =>
      reportsApi.weekly({
        semester_id: Number(effectiveSemesterId),
        date_from: range.from,
        date_to: range.to,
        ...(reportGroupId !== "" ? { group_id: reportGroupId } : {}),
      }),
    onSuccess: (blob) => downloadBlob(blob, `report_${range.from}_${range.to}.xlsx`),
  });

  const { data: workload } = useQuery({
    queryKey: ["dashboard-workload", effectiveSemesterId],
    queryFn: () => dashboardApi.workload(Number(effectiveSemesterId)),
    enabled: Boolean(effectiveSemesterId),
  });

  const { data: unassigned } = useQuery({
    queryKey: ["dashboard-unassigned", effectiveSemesterId],
    queryFn: () => dashboardApi.unassignedSubjects(Number(effectiveSemesterId)),
    enabled: Boolean(effectiveSemesterId),
  });

  const { data: teacherSummary } = useQuery({
    queryKey: ["dashboard-teacher-monitoring", effectiveSemesterId, range.from, range.to],
    queryFn: () =>
      dashboardApi.teacherMonitoringSummary({
        semester_id: Number(effectiveSemesterId),
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: Boolean(effectiveSemesterId),
  });

  const { data: studentSummary } = useQuery({
    queryKey: ["dashboard-student-attendance", effectiveSemesterId, range.from, range.to],
    queryFn: () =>
      dashboardApi.studentAttendanceSummary({
        semester_id: Number(effectiveSemesterId),
        date_from: range.from,
        date_to: range.to,
      }),
    enabled: Boolean(effectiveSemesterId),
  });

  const rowsWithDept = useMemo(
    () =>
      (workload ?? []).map((row) => ({
        ...row,
        departmentName: departments?.find((d) => d.id === row.department_id)?.name ?? `#${row.department_id}`,
      })),
    [workload, departments],
  );

  const totals = useMemo(() => {
    const assignments = (workload ?? []).reduce((sum, r) => sum + r.assignment_count, 0);
    const placed = (workload ?? []).reduce((sum, r) => sum + r.weekly_scheduled_periods, 0);
    const coverage = assignments > 0 ? Math.round((placed / assignments) * 100) : null;
    return { teachers: workload?.length ?? 0, assignments, placed, coverage };
  }, [workload]);

  const attendanceCounts = studentSummary
    ? {
        present_count: studentSummary.present,
        absent_count: studentSummary.absent,
        late_count: studentSummary.late,
        excused_count: studentSummary.excused,
      }
    : null;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          {t("dashboard.title")}
        </Typography>
        <TextField
          select
          size="small"
          label={t("common.select_semester")}
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 220 }}
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
      </Box>

      {!effectiveSemesterId && <Alert severity="info">{t("dashboard.pick_semester_hint")}</Alert>}

      {effectiveSemesterId && workload && (
        <>
          <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
            <StatTile label={t("dashboard.stat_teachers")} value={totals.teachers} />
            <StatTile label={t("dashboard.stat_assignments")} value={totals.assignments} />
            <StatTile label={t("dashboard.stat_placed")} value={totals.placed} />
            <StatTile
              label={t("dashboard.stat_coverage")}
              value={totals.coverage === null ? "—" : `${totals.coverage}%`}
              tone={totals.coverage === null ? "neutral" : totals.coverage >= 100 ? "good" : "warning"}
            />
            <StatTile
              label={t("dashboard.stat_unassigned")}
              value={unassigned?.length ?? "—"}
              tone={!unassigned ? "neutral" : unassigned.length === 0 ? "good" : "warning"}
            />
          </Box>

          <Typography variant="h6" sx={{ mb: 1 }}>
            {t("dashboard.teacher_workload")}
          </Typography>
          {workload.length === 0 && <Alert severity="info">{t("dashboard.no_teachers")}</Alert>}
          {workload.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 4, overflowX: "auto" }}>
              <WorkloadBars rows={rowsWithDept} />
            </Paper>
          )}

          <Typography variant="h6" sx={{ mb: 1 }}>
            {t("dashboard.unassigned_subjects")}
          </Typography>
          {unassigned && unassigned.length === 0 && <Alert severity="success">{t("dashboard.all_assigned")}</Alert>}
          {unassigned && unassigned.length > 0 && (
            <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t("dashboard.col_subject")}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t("dashboard.col_code")}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t("dashboard.col_department")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unassigned.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{s.name}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{s.code}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {departments?.find((d) => d.id === s.department_id)?.name ?? `#${s.department_id}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Typography variant="h6">{t("dashboard.monitoring_title")}</Typography>
            <ToggleButtonGroup size="small" exclusive value={preset} onChange={(_e, value) => value && setPreset(value)}>
              <ToggleButton value="day">{t("monitoring.range_day")}</ToggleButton>
              <ToggleButton value="week">{t("monitoring.range_week")}</ToggleButton>
              <ToggleButton value="month">{t("monitoring.range_month")}</ToggleButton>
              <ToggleButton value="year">{t("monitoring.range_year")}</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              size="small"
              label={t("common.group_filter")}
              value={reportGroupId}
              onChange={(e) => setReportGroupId(e.target.value === "" ? "" : Number(e.target.value))}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">{t("common.all_groups")}</MenuItem>
              {(groups ?? []).map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              disabled={downloadReportMutation.isPending}
              onClick={() => downloadReportMutation.mutate()}
            >
              {t("dashboard.download_report")}
            </Button>
          </Box>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 4 }}>
            <Box sx={{ flex: "1 1 380px", minWidth: 320 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {t("dashboard.teacher_monitoring_title")}
              </Typography>
              {teacherSummary && (
                <>
                  <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <StatTile label={t("monitoring.col_expected")} value={teacherSummary.expected_lessons} />
                    <StatTile label={t("monitoring.col_conducted")} value={teacherSummary.conducted_lessons} tone="good" />
                    <StatTile
                      label={t("monitoring.col_missed")}
                      value={teacherSummary.missed_lessons}
                      tone={teacherSummary.missed_lessons > 0 ? "warning" : "good"}
                    />
                    <StatTile
                      label={t("monitoring.col_late")}
                      value={teacherSummary.late_lessons}
                      tone={teacherSummary.late_lessons > 0 ? "warning" : "good"}
                    />
                  </Box>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <MonitoringBar
                      conducted={teacherSummary.conducted_lessons}
                      missed={teacherSummary.missed_lessons}
                    />
                    {teacherSummary.top_missed.length > 0 ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("dashboard.top_missed_title")}
                        </Typography>
                        {teacherSummary.top_missed.map((row) => (
                          <Box key={row.teacher_id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Typography variant="body2">{row.full_name}</Typography>
                            <Chip size="small" color="error" label={row.missed_lessons} />
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        {t("dashboard.no_missed_hint")}
                      </Alert>
                    )}
                  </Paper>
                </>
              )}
            </Box>

            <Box sx={{ flex: "1 1 380px", minWidth: 320 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {t("dashboard.student_stats_title")}
              </Typography>
              {studentSummary && attendanceCounts && (
                <>
                  <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <StatTile
                      label={t("journal.col_average")}
                      value={studentSummary.average_score ?? "—"}
                    />
                  </Box>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <AttendanceBar row={attendanceCounts} />
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2, fontSize: 12.5, color: "text.secondary" }}>
                      {ATTENDANCE_LEGEND.map((item) => (
                        <Box key={item.key} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                          <Box sx={{ width: 9, height: 9, borderRadius: "3px", bgcolor: item.color }} />
                          {t(`journal.attendance_${item.key}`)}
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                </>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
