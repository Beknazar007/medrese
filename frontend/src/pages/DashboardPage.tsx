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
import { dashboardApi } from "../api/entities";
import { useDepartments, useSemesters } from "../hooks/useReferenceData";

export default function DashboardPage() {
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h5">Dashboard</Typography>
        <TextField
          select
          size="small"
          label="Semester"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">{activeSemester ? `Active: ${activeSemester.name}` : "Select a semester"}</MenuItem>
          {(semesters ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {!effectiveSemesterId && <Alert severity="info">Pick a semester to see workload and coverage.</Alert>}

      {effectiveSemesterId && (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Teacher workload
          </Typography>
          {workload && workload.length === 0 && <Alert severity="info">No teachers found for this scope.</Alert>}
          {workload && workload.length > 0 && (
            <TableContainer component={Paper} sx={{ mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Teacher</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Assignments</TableCell>
                    <TableCell align="right">Placed on timetable</TableCell>
                    <TableCell align="right">Gap</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workload.map((row) => (
                    <TableRow key={row.teacher_id} hover>
                      <TableCell>{row.full_name}</TableCell>
                      <TableCell>
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
            Subjects with no teacher assigned
          </Typography>
          {unassigned && unassigned.length === 0 && (
            <Alert severity="success">Every subject has a teacher assigned this semester.</Alert>
          )}
          {unassigned && unassigned.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Department</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unassigned.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.code}</TableCell>
                      <TableCell>
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
