import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
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
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { notesApi, studentsApi } from "../api/entities";
import type { AttendanceStatus, StudentHistoryRow } from "../api/types";
import { nameById, useGroups, useTeachers } from "../hooks/useReferenceData";

// Same status-palette roles as AttendanceBar: present=good, late=warning, absent=critical,
// excused=categorical blue (informational, not "bad").
const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "#0ca30c",
  LATE: "#fab219",
  EXCUSED: "#2a78d6",
  ABSENT: "#d03b3b",
};

interface SubjectGroup {
  subject_id: number;
  subject_name: string;
  rows: StudentHistoryRow[];
  held: number;
  missed: number;
  examCount: number;
  examAverage: number | null;
}

function groupBySubject(history: StudentHistoryRow[]): SubjectGroup[] {
  const bySubject = new Map<number, SubjectGroup>();
  for (const row of history) {
    let group = bySubject.get(row.subject_id);
    if (!group) {
      group = {
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        rows: [],
        held: 0,
        missed: 0,
        examCount: 0,
        examAverage: null,
      };
      bySubject.set(row.subject_id, group);
    }
    group.rows.push(row);
    if (row.attendance_status === "ABSENT") {
      group.missed += 1;
    } else if (row.attendance_status !== null) {
      group.held += 1;
    }
  }
  for (const group of bySubject.values()) {
    const examScores = group.rows.filter((r) => r.is_exam && r.score !== null).map((r) => r.score as number);
    group.examCount = examScores.length;
    group.examAverage = examScores.length
      ? Math.round((examScores.reduce((sum, s) => sum + s, 0) / examScores.length) * 10) / 10
      : null;
  }
  return [...bySubject.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));
}

export default function StudentProfileDialog({
  studentId,
  onClose,
}: {
  studentId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: groups } = useGroups();
  const { data: teachers } = useTeachers();

  const { data: student } = useQuery({
    queryKey: ["students", studentId],
    queryFn: () => studentsApi.get(studentId),
  });
  const { data: history } = useQuery({
    queryKey: ["students", studentId, "history"],
    queryFn: () => studentsApi.history(studentId),
  });
  const { data: notes } = useQuery({
    queryKey: ["students", studentId, "notes"],
    queryFn: () => notesApi.list(studentId),
  });

  const subjectGroups = useMemo(() => groupBySubject(history ?? []), [history]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{student?.full_name ?? "…"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {student && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={student.photo ?? undefined} sx={{ width: 72, height: 72, fontSize: 28 }}>
              {student.full_name.charAt(0)}
            </Avatar>
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
          </Box>
        )}

        {student?.bio && (
          <Box>
            <Typography variant="subtitle1">{t("students.bio")}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {student.bio}
            </Typography>
          </Box>
        )}

        <Typography variant="subtitle1">{t("students.history_title")}</Typography>

        {history && history.length === 0 && <Alert severity="info">{t("students.history_empty")}</Alert>}

        {subjectGroups.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {subjectGroups.map((group) => (
              <Accordion key={group.subject_id} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                    <Typography variant="body1">{group.subject_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("students.subject_held")}: {group.held} · {t("students.subject_missed")}: {group.missed}
                      {group.examCount > 0 &&
                        ` · ${t("students.subject_exam_count")}: ${group.examCount} · ${t("journal.col_average")}: ${group.examAverage}`}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer component={Paper} sx={{ overflowX: "auto" }} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_date")}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_teacher")}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{t("students.col_type")}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                            {t("students.col_grade")}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_attendance")}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_lesson_comment")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow key={row.session_id} hover>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{row.date}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{row.teacher_name}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>
                              {t(`hour_type.${row.hour_type}`)}
                              {row.is_exam && (
                                <Chip size="small" label={t("students.exam_label")} sx={{ ml: 0.75, height: 18, fontSize: 11 }} />
                              )}
                            </TableCell>
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
                            <TableCell>{row.attendance_comment ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        <Typography variant="subtitle1">{t("students.notes_title")}</Typography>

        {notes && notes.length === 0 && <Alert severity="info">{t("journal.note_empty")}</Alert>}

        {notes && notes.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {notes.map((n) => (
              <Box key={n.id} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
                <Typography variant="body2">{n.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {nameById(teachers, n.author_teacher_id, (t2) => t2.full_name)} ·{" "}
                  {n.visibility === "SHARED" ? t("journal.note_shared") : t("journal.note_private")} ·{" "}
                  {new Date(n.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}
