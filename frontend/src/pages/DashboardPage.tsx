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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { dashboardApi } from "../api/entities";
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

      {effectiveSemesterId && (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t("dashboard.teacher_workload")}
          </Typography>
          {workload && workload.length === 0 && <Alert severity="info">{t("dashboard.no_teachers")}</Alert>}
          {workload && workload.length > 0 && (
            <TableContainer component={Paper} sx={{ mb: 4, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t("dashboard.col_teacher")}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t("dashboard.col_department")}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {t("dashboard.col_assignments")}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {t("dashboard.col_placed")}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {t("dashboard.col_gap")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workload.map((row) => (
                    <TableRow key={row.teacher_id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{row.full_name}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {departments?.find((d) => d.id === row.department_id)?.name ?? `#${row.department_id}`}
                      </TableCell>
                      <TableCell align="right">{row.assignment_count}</TableCell>
                      <TableCell align="right">{row.weekly_scheduled_periods}</TableCell>
                      <TableCell align="right">
                        {row.assignment_count - row.weekly_scheduled_periods > 0 ? (
                          <Typography color="warning.main" component="span">
                            {row.assignment_count - row.weekly_scheduled_periods}
                          </Typography>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
