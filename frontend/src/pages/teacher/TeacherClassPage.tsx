import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, journalApi, notesApi, scheduleApi } from "../../api/entities";
import type { AttendanceStatus, NoteVisibility, RosterStudent } from "../../api/types";
import { apiErrorMessage } from "../../lib/errors";
import { nameById, useGroups, useSubjects, useTimeSlots } from "../../hooks/useReferenceData";

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherClassPage() {
  const { t } = useTranslation();

  const { data: assignments } = useQuery({ queryKey: ["assignments", "mine"], queryFn: () => assignmentsApi.list() });
  const { data: entries } = useQuery({ queryKey: ["schedule", "mine"], queryFn: () => scheduleApi.list() });
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: timeSlots } = useTimeSlots();

  const sortedSlots = useMemo(() => [...(timeSlots ?? [])].sort((a, b) => a.order - b.order), [timeSlots]);

  const classOptions = useMemo(() => {
    return (entries ?? []).map((entry) => {
      const assignment = assignments?.find((a) => a.id === entry.assignment_id);
      const subjectName = assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : "";
      const groupName = nameById(groups, entry.group_id, (g) => g.name);
      const slot = sortedSlots.find((s) => s.id === entry.time_slot_id);
      const dayLabel = t(`days.${entry.day_of_week}`);
      return {
        entryId: entry.id,
        assignmentId: entry.assignment_id,
        label: `${dayLabel} ${slot?.start_time.slice(0, 5) ?? ""} — ${subjectName} — ${groupName}`,
      };
    });
  }, [entries, assignments, subjects, groups, sortedSlots, t]);

  const [selectedEntryId, setSelectedEntryId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [noteStudent, setNoteStudent] = useState<{ id: number; name: string } | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);

  const selectedAssignmentId = classOptions.find((c) => c.entryId === selectedEntryId)?.assignmentId;

  const openSessionMutation = useMutation({
    mutationFn: () => journalApi.getOrCreateSession(Number(selectedEntryId), selectedDate),
    onSuccess: (detail) => {
      setSessionId(detail.session.id);
      setRoster(detail.roster);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: () =>
      journalApi.putAttendance(
        sessionId!,
        roster
          .filter((r) => r.attendance_status !== null)
          .map((r) => ({ student_id: r.student_id, status: r.attendance_status as AttendanceStatus })),
      ),
    onSuccess: (detail) => {
      setRoster(detail.roster);
      setSnackbar(t("journal.saved"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  const saveGradesMutation = useMutation({
    mutationFn: () =>
      journalApi.putGrades(
        sessionId!,
        roster
          .filter((r) => r.score !== null && r.score !== undefined)
          .map((r) => ({ student_id: r.student_id, score: r.score as number })),
      ),
    onSuccess: (detail) => {
      setRoster(detail.roster);
      setSnackbar(t("journal.saved"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  function setAttendance(studentId: number, status: AttendanceStatus) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, attendance_status: status } : r)));
  }

  function setScore(studentId: number, score: number | null) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, score } : r)));
  }

  const { data: performance } = useQuery({
    queryKey: ["journal-performance", selectedAssignmentId],
    queryFn: () => journalApi.performance(Number(selectedAssignmentId)),
    enabled: showPerformance && Boolean(selectedAssignmentId),
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
        {t("journal.title")}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("journal.select_class")}
          value={selectedEntryId}
          onChange={(e) => {
            setSelectedEntryId(e.target.value ? Number(e.target.value) : "");
            setSessionId(null);
            setRoster([]);
          }}
          sx={{ minWidth: 280 }}
        >
          {classOptions.map((opt) => (
            <MenuItem key={opt.entryId} value={opt.entryId}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label={t("journal.select_date")}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant="contained"
          disabled={!selectedEntryId || openSessionMutation.isPending}
          onClick={() => openSessionMutation.mutate()}
        >
          {t("journal.load_session")}
        </Button>
        {selectedAssignmentId && (
          <Button variant="outlined" onClick={() => setShowPerformance(true)}>
            {t("journal.performance_title")}
          </Button>
        )}
      </Box>

      {classOptions.length === 0 && <Alert severity="info">{t("journal.no_classes")}</Alert>}

      {sessionId && roster.length > 0 && (
        <>
          <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_student")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_attendance")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_grade")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {t("journal.col_note")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roster.map((r) => (
                  <TableRow key={r.student_id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{r.full_name}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={r.attendance_status ?? ""}
                        onChange={(e) => setAttendance(r.student_id, e.target.value as AttendanceStatus)}
                        sx={{ minWidth: 150 }}
                      >
                        {ATTENDANCE_OPTIONS.map((status) => (
                          <MenuItem key={status} value={status}>
                            {t(`journal.attendance_${status.toLowerCase()}`)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={r.score ?? ""}
                        onChange={(e) => setScore(r.student_id, e.target.value === "" ? null : Number(e.target.value))}
                        slotProps={{ htmlInput: { min: 0, max: 100 } }}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setNoteStudent({ id: r.student_id, name: r.full_name })}>
                        <CommentIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button variant="contained" onClick={() => saveAttendanceMutation.mutate()} disabled={saveAttendanceMutation.isPending}>
              {t("journal.save_attendance")}
            </Button>
            <Button variant="contained" onClick={() => saveGradesMutation.mutate()} disabled={saveGradesMutation.isPending}>
              {t("journal.save_grades")}
            </Button>
          </Box>
        </>
      )}

      {noteStudent && (
        <NotesDialog student={noteStudent} onClose={() => setNoteStudent(null)} onError={(msg) => setSnackbar(msg)} />
      )}

      <Dialog open={showPerformance} onClose={() => setShowPerformance(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t("journal.performance_title")}</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("journal.col_student")}</TableCell>
                  <TableCell align="right">{t("journal.col_average")}</TableCell>
                  <TableCell align="right">{t("journal.col_sessions")}</TableCell>
                  <TableCell align="right">{t("journal.attendance_present")}</TableCell>
                  <TableCell align="right">{t("journal.attendance_absent")}</TableCell>
                  <TableCell align="right">{t("journal.attendance_late")}</TableCell>
                  <TableCell align="right">{t("journal.attendance_excused")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(performance ?? []).map((row) => (
                  <TableRow key={row.student_id} hover>
                    <TableCell>{row.full_name}</TableCell>
                    <TableCell align="right">{row.average_score ?? "—"}</TableCell>
                    <TableCell align="right">{row.sessions_count}</TableCell>
                    <TableCell align="right">{row.present_count}</TableCell>
                    <TableCell align="right">{row.absent_count}</TableCell>
                    <TableCell align="right">{row.late_count}</TableCell>
                    <TableCell align="right">{row.excused_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPerformance(false)}>{t("journal.close")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

function NotesDialog({
  student,
  onClose,
  onError,
}: {
  student: { id: number; name: string };
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("PRIVATE");

  const { data: notes } = useQuery({
    queryKey: ["notes", student.id],
    queryFn: () => notesApi.list(student.id),
  });

  const createMutation = useMutation({
    mutationFn: () => notesApi.create(student.id, { body, visibility }),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["notes", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("journal.notes_for", { name: student.name })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(notes ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("journal.note_empty")}
          </Typography>
        )}
        {(notes ?? []).map((n) => (
          <Box key={n.id} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
            <Typography variant="body2">{n.body}</Typography>
            <Typography variant="caption" color="text.secondary">
              {n.visibility === "SHARED" ? t("journal.note_shared") : t("journal.note_private")} ·{" "}
              {new Date(n.created_at).toLocaleDateString()}
            </Typography>
          </Box>
        ))}

        <TextField
          label={t("journal.note_body")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
        <RadioGroup
          row
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as NoteVisibility)}
        >
          <FormControlLabel value="PRIVATE" control={<Radio />} label={t("journal.note_private")} />
          <FormControlLabel value="SHARED" control={<Radio />} label={t("journal.note_shared")} />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("journal.close")}</Button>
        <Button variant="contained" disabled={!body.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {t("journal.note_add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
