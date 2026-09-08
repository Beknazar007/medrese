import {
  Alert,
  Box,
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
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { dashboardApi } from "../api/entities";
import StatTile from "../components/StatTile";
import WorkloadBars from "../components/WorkloadBars";
import { useDepartments, useSemesters } from "../hooks/useReferenceData";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: semesters } = useSemesters();
  const { data: departments } = useDepartments();
  const activeSemester = semesters?.find((s) => s.is_active);
  const [semesterId, setSemesterId] = useState<number | "">("");
  const effectiveSemesterId = semesterId || activeSemester?.id || "";

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
            <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
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
        </>
      )}
    </Box>
  );
}
