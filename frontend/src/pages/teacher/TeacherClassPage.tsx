import {
  Alert,
  Box,
  Button,
  Chip,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, journalApi, notesApi, scheduleApi } from "../../api/entities";
import AttendanceBar from "../../components/AttendanceBar";
import StudentProfileDialog from "../../components/StudentProfileDialog";
import type { AttendanceStatus, NoteVisibility, RosterStudent } from "../../api/types";
import { apiErrorMessage } from "../../lib/errors";
import { nameById, useGroups, useSubjects, useTimeSlots } from "../../hooks/useReferenceData";

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "К",
  ABSENT: "Ж",
  LATE: "О",
  EXCUSED: "С",
};

const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "#2e7d32",
  ABSENT: "#c62828",
  LATE: "#e08600",
  EXCUSED: "#1565c0",
};

const ROW_TINT: Partial<Record<AttendanceStatus, string>> = {
  ABSENT: "rgba(198,40,40,.06)",
  LATE: "rgba(224,134,0,.08)",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayDayOfWeek(): number {
  const js = new Date().getDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    return [...(entries ?? [])]
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        const sa = sortedSlots.find((s) => s.id === a.time_slot_id)?.order ?? 0;
        const sb = sortedSlots.find((s) => s.id === b.time_slot_id)?.order ?? 0;
        return sa - sb;
      })
      .map((entry) => {
        const assignment = assignments?.find((a) => a.id === entry.assignment_id);
        const subjectName = assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : "";
        const groupName = nameById(groups, entry.group_id, (g) => g.name);
        const slot = sortedSlots.find((s) => s.id === entry.time_slot_id);
        const dayLabel = t(`days.${entry.day_of_week}`);
        return {
          entryId: entry.id,
          assignmentId: entry.assignment_id,
          dayOfWeek: entry.day_of_week,
          isToday: entry.day_of_week === todayDayOfWeek(),
          label: `${dayLabel} ${slot?.start_time.slice(0, 5) ?? ""} — ${subjectName} — ${groupName}`,
        };
      });
  }, [entries, assignments, subjects, groups, sortedSlots, t]);

  const [selectedEntryId, setSelectedEntryId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionTimes, setSessionTimes] = useState<{ checkedInAt: string | null; checkedOutAt: string | null } | null>(
    null,
  );
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [noteStudent, setNoteStudent] = useState<{ id: number; name: string } | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const savedSnapshot = useRef<string>("[]");
  const autoLoadedOnce = useRef(false);

  const isDirty = JSON.stringify(roster) !== savedSnapshot.current;

  // Comfort win: open today's class automatically, so a teacher who just wants to take
  // attendance for the lesson happening right now doesn't have to pick anything.
  useEffect(() => {
    if (autoLoadedOnce.current || selectedEntryId !== "" || classOptions.length === 0) return;
    const todaysClass = classOptions.find((c) => c.isToday);
    if (todaysClass) {
      autoLoadedOnce.current = true;
      setSelectedEntryId(todaysClass.entryId);
      openSessionFor(todaysClass.entryId, todayIso());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classOptions]);

  const selectedAssignmentId = classOptions.find((c) => c.entryId === selectedEntryId)?.assignmentId;

  const openSessionMutation = useMutation({
    mutationFn: ({ entryId, date }: { entryId: number; date: string }) => journalApi.getOrCreateSession(entryId, date),
    onSuccess: (detail) => {
      setSessionId(detail.session.id);
      setSessionTimes({
        checkedInAt: detail.session.teacher_checked_in_at,
        checkedOutAt: detail.session.teacher_checked_out_at,
      });
      setRoster(detail.roster);
      savedSnapshot.current = JSON.stringify(detail.roster);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  function openSessionFor(entryId: number, date: string) {
    openSessionMutation.mutate({ entryId, date });
  }

  const checkOutMutation = useMutation({
    mutationFn: () => journalApi.checkOut(sessionId!),
    onSuccess: (session) => {
      setSessionTimes({ checkedInAt: session.teacher_checked_in_at, checkedOutAt: session.teacher_checked_out_at });
      setSnackbar(t("journal.checked_out"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(t("journal.unsaved_confirm"));
  }

  function handleSelectClass(entryId: number | "") {
    if (!confirmDiscardIfDirty()) return;
    setSelectedEntryId(entryId);
    setSessionId(null);
    setSessionTimes(null);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  function handleSelectDate(date: string) {
    if (!confirmDiscardIfDirty()) return;
    setSelectedDate(date);
    setSessionId(null);
    setSessionTimes(null);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      await journalApi.putAttendance(
        sessionId!,
        roster
          .filter((r) => r.attendance_status !== null)
          .map((r) => ({ student_id: r.student_id, status: r.attendance_status as AttendanceStatus })),
      );
      return journalApi.putGrades(
        sessionId!,
        roster
          .filter((r) => r.score !== null && r.score !== undefined)
          .map((r) => ({ student_id: r.student_id, score: r.score as number })),
      );
    },
    onSuccess: (detail) => {
      setRoster(detail.roster);
      savedSnapshot.current = JSON.stringify(detail.roster);
      setSnackbar(t("journal.saved"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"))),
  });

  function setAttendance(studentId: number, status: AttendanceStatus | null) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, attendance_status: status } : r)));
  }

  function setScore(studentId: number, score: number | null) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, score } : r)));
  }

  function markAllPresent() {
    setRoster((prev) => prev.map((r) => ({ ...r, attendance_status: "PRESENT" as AttendanceStatus })));
  }

  const attendanceCounts = useMemo(() => {
    const counts: Record<AttendanceStatus | "UNSET", number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNSET: 0 };
    for (const r of roster) {
      if (r.attendance_status) counts[r.attendance_status] += 1;
      else counts.UNSET += 1;
    }
    return counts;
  }, [roster]);

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

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("journal.select_class")}
          value={selectedEntryId}
          onChange={(e) => handleSelectClass(e.target.value ? Number(e.target.value) : "")}
          sx={{ minWidth: 280 }}
        >
          {classOptions.map((opt) => (
            <MenuItem key={opt.entryId} value={opt.entryId}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                <span>{opt.label}</span>
                {opt.isToday && <Chip label={t("journal.today")} size="small" color="primary" sx={{ height: 18, fontSize: 11 }} />}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label={t("journal.select_date")}
          value={selectedDate}
          onChange={(e) => handleSelectDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant="contained"
          disabled={!selectedEntryId || openSessionMutation.isPending}
          onClick={() => selectedEntryId && openSessionFor(Number(selectedEntryId), selectedDate)}
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
          <Box sx={{ display: "flex", gap: 2, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("journal.checked_in_at")}:{" "}
              <strong>{sessionTimes?.checkedInAt ? formatTime(sessionTimes.checkedInAt) : "—"}</strong>
            </Typography>
            {sessionTimes?.checkedOutAt ? (
              <Typography variant="body2" color="text.secondary">
                {t("journal.checked_out_at")}: <strong>{formatTime(sessionTimes.checkedOutAt)}</strong>
              </Typography>
            ) : (
              <Button size="small" variant="outlined" disabled={checkOutMutation.isPending} onClick={() => checkOutMutation.mutate()}>
                {t("journal.check_out")}
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllPresent}>
              {t("journal.mark_all_present")}
            </Button>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", fontSize: 13, color: "text.secondary" }}>
              {ATTENDANCE_OPTIONS.map((status) => (
                <span key={status}>
                  {t(`journal.attendance_${status.toLowerCase()}`)}: <strong>{attendanceCounts[status]}</strong>
                </span>
              ))}
              {attendanceCounts.UNSET > 0 && (
                <span style={{ color: "#e08600" }}>
                  {t("journal.unset")}: <strong>{attendanceCounts.UNSET}</strong>
                </span>
              )}
            </Box>
          </Box>

          <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 2 }}>
            <Table size="small" stickyHeader>
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
                  <TableRow key={r.student_id} hover sx={{ bgcolor: r.attendance_status ? ROW_TINT[r.attendance_status] : undefined }}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Box
                        component="span"
                        onClick={() => setProfileStudentId(r.student_id)}
                        sx={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "transparent", "&:hover": { textDecorationColor: "currentColor" } }}
                      >
                        {r.full_name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={r.attendance_status}
                        onChange={(_e, value) => setAttendance(r.student_id, value)}
                      >
                        {ATTENDANCE_OPTIONS.map((status) => (
                          <ToggleButton
                            key={status}
                            value={status}
                            sx={{
                              px: 1.1,
                              py: 0.3,
                              fontSize: 12,
                              fontWeight: 600,
                              "&.Mui-selected": {
                                bgcolor: ATTENDANCE_COLOR[status],
                                color: "#fff",
                                "&:hover": { bgcolor: ATTENDANCE_COLOR[status], opacity: 0.9 },
                              },
                            }}
                          >
                            <Tooltip title={t(`journal.attendance_${status.toLowerCase()}`)}>
                              <span>{ATTENDANCE_SHORT[status]}</span>
                            </Tooltip>
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
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

          <Button
            variant="contained"
            size="large"
            onClick={() => saveAllMutation.mutate()}
            disabled={saveAllMutation.isPending || !isDirty}
          >
            {isDirty ? t("journal.save_all") : t("journal.saved")}
          </Button>
        </>
      )}

      {noteStudent && (
        <NotesDialog student={noteStudent} onClose={() => setNoteStudent(null)} onError={(msg) => setSnackbar(msg)} />
      )}

      {profileStudentId !== null && (
        <StudentProfileDialog studentId={profileStudentId} onClose={() => setProfileStudentId(null)} />
      )}

      <Dialog open={showPerformance} onClose={() => setShowPerformance(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t("journal.performance_title")}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2.5, mb: 1.5, flexWrap: "wrap", fontSize: 12.5, color: "text.secondary" }}>
            {(["present", "late", "excused", "absent"] as const).map((key) => (
              <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: "3px",
                    bgcolor: { present: "#0ca30c", late: "#fab219", excused: "#2a78d6", absent: "#d03b3b" }[key],
                  }}
                />
                {t(`journal.attendance_${key}`)}
              </Box>
            ))}
          </Box>
          <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("journal.col_student")}</TableCell>
                  <TableCell align="right">{t("journal.col_average")}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>{t("journal.col_attendance")}</TableCell>
                  <TableCell align="right">{t("journal.col_sessions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(performance ?? []).map((row) => (
                  <TableRow key={row.student_id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.full_name}</TableCell>
                    <TableCell align="right">{row.average_score ?? "—"}</TableCell>
                    <TableCell>
                      <AttendanceBar row={row} />
                    </TableCell>
                    <TableCell align="right">{row.sessions_count}</TableCell>
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
