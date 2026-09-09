import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { studentsApi } from "../api/entities";
import type { AttendanceStatus } from "../api/types";
import { nameById, useGroups } from "../hooks/useReferenceData";

// Same status-palette roles as AttendanceBar: present=good, late=warning, absent=critical,
// excused=categorical blue (informational, not "bad").
const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "#0ca30c",
  LATE: "#fab219",
  EXCUSED: "#2a78d6",
  ABSENT: "#d03b3b",
};

export default function StudentProfileDialog({
  studentId,
  onClose,
}: {
  studentId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: groups } = useGroups();

  const { data: student } = useQuery({
    queryKey: ["students", studentId],
    queryFn: () => studentsApi.get(studentId),
  });
  const { data: history } = useQuery({
    queryKey: ["students", studentId, "history"],
    queryFn: () => studentsApi.history(studentId),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{student?.full_name ?? "…"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {student && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", color: "text.secondary", fontSize: 14 }}>
            <span>
              {t("students.group")}: {nameById(groups, student.group_id, (g) => g.name)}
            </span>
            {student.student_number && (
              <span>
                {t("students.student_number")}: {student.student_number}
              </span>
            )}
            {student.phone && (
              <span>
                {t("students.phone")}: {student.phone}
              </span>
            )}
            {student.guardian_name && (
              <span>
                {t("students.guardian_name")}: {student.guardian_name}
              </span>
            )}
            {student.guardian_phone && (
              <span>
                {t("students.guardian_phone")}: {student.guardian_phone}
              </span>
            )}
            <Chip
              size="small"
              label={student.is_active ? t("common.yes") : t("common.no")}
              sx={{ height: 20 }}
            />
          </Box>
        )}

        <Typography variant="subtitle1">{t("students.history_title")}</Typography>

        {history && history.length === 0 && <Alert severity="info">{t("students.history_empty")}</Alert>}

        {history && history.length > 0 && (
          <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_date")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_subject")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_teacher")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_type")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {t("students.col_grade")}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_attendance")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.session_id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.subject_name}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.teacher_name}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{t(`hour_type.${row.hour_type}`)}</TableCell>
                    <TableCell align="right">{row.score ?? "—"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {row.attendance_status ? (
                        <Chip
                          size="small"
                          label={t(`journal.attendance_${row.attendance_status.toLowerCase()}`)}
                          sx={{ bgcolor: ATTENDANCE_COLOR[row.attendance_status], color: "#fff" }}
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
