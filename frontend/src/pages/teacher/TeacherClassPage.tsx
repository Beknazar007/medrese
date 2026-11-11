import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  Typography,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { assignmentsApi, hifzApi, journalApi, notesApi, scheduleApi } from "../../api/entities";
import AttendanceBar from "../../components/AttendanceBar";
import AttendanceLegend from "../../components/AttendanceLegend";
import AttendanceToggle from "../../components/AttendanceToggle";
import { ATTENDANCE_ROW_TINT, countAttendance } from "../../lib/attendance";
import { STATUS_FILL } from "../../lib/palette";
import StudentProfileDialog from "../../components/StudentProfileDialog";
import type { AttendanceStatus, NoteVisibility, RosterStudent } from "../../api/types";
import { useConfirm } from "../../context/ConfirmContext";
import { apiErrorMessage } from "../../lib/errors";
import { nameById, useGroups, useSubjects, useTimeSlots } from "../../hooks/useReferenceData";

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
  const isMobile = useIsMobile();
  const confirm = useConfirm();

  const { data: assignments } = useQuery({ queryKey: ["assignments", "mine"], queryFn: () => assignmentsApi.list() });
  const { data: entries } = useQuery({ queryKey: ["schedule", "mine"], queryFn: () => scheduleApi.list() });
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: timeSlots } = useTimeSlots();

  const { data: hifzGroups } = useQuery({ queryKey: ["hifz-groups"], queryFn: () => hifzApi.groups() });

  const sortedSlots = useMemo(() => [...(timeSlots ?? [])].sort((a, b) => a.order - b.order), [timeSlots]);
  const hifzGroupIdSet = useMemo(() => new Set((hifzGroups ?? []).map((g) => g.id)), [hifzGroups]);

  const classOptions = useMemo(() => {
    // Hafiz classes are run from the hifz journal, never from here.
    if (!hifzGroups) return [];
    return [...(entries ?? [])]
      .filter((entry) => !hifzGroupIdSet.has(entry.group_id))
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
          groupName,
          timeRange: slot ? `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}` : "",
          dayOfWeek: entry.day_of_week,
          isToday: entry.day_of_week === todayDayOfWeek(),
          label: `${dayLabel} ${slot?.start_time.slice(0, 5) ?? ""} — ${subjectName} — ${groupName}`,
        };
      });
  }, [entries, hifzGroups, hifzGroupIdSet, assignments, subjects, groups, sortedSlots, t]);

  const [selectedEntryId, setSelectedEntryId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionTimes, setSessionTimes] = useState<{ checkedInAt: string | null; checkedOutAt: string | null } | null>(
    null,
  );
  const [isExam, setIsExam] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [noteStudent, setNoteStudent] = useState<{ id: number; name: string } | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  // Why the chosen lesson couldn't be opened (e.g. its time is over) — shown persistently,
  // otherwise the teacher is left looking at an empty page.
  const [openError, setOpenError] = useState<string | null>(null);
  const savedSnapshot = useRef<string>("[]");
  const autoLoadedOnce = useRef(false);

  const isDirty = JSON.stringify(roster) !== savedSnapshot.current;
  const [saveFailed, setSaveFailed] = useState(false);
  // Latest values for the autosave timer and the flush on leave, which run outside a render.
  const latest = useRef({ sessionId, roster, isExam, isDirty });
  latest.current = { sessionId, roster, isExam, isDirty };

  // While a save is still pending (the short pause after typing), closing the tab asks first.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
      setOpenError(null);
      setSessionId(detail.session.id);
      setSessionTimes({
        checkedInAt: detail.session.teacher_checked_in_at,
        checkedOutAt: detail.session.teacher_checked_out_at,
      });
      setIsExam(detail.session.is_exam);
      setRoster(detail.roster);
      savedSnapshot.current = JSON.stringify(detail.roster);
    },
    onError: (err) => setOpenError(apiErrorMessage(err, t("journal.save_failed"), t)),
  });

  function openSessionFor(entryId: number, date: string) {
    openSessionMutation.mutate({ entryId, date });
  }

  const setExamFlagMutation = useMutation({
    mutationFn: (nextIsExam: boolean) => journalApi.setExamFlag(sessionId!, nextIsExam),
    onSuccess: (session) => setIsExam(session.is_exam),
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"), t)),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => journalApi.checkOut(sessionId!),
    onSuccess: (session) => {
      setSessionTimes({ checkedInAt: session.teacher_checked_in_at, checkedOutAt: session.teacher_checked_out_at });
      setSnackbar(t("journal.checked_out"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("journal.save_failed"), t)),
  });

  // Switching lesson or date saves what's pending first instead of dropping it.
  function flushPendingSave() {
    const cur = latest.current;
    if (cur.isDirty && cur.sessionId) saveMutation.mutate({ sessionId: cur.sessionId, roster: cur.roster, isExam: cur.isExam });
  }

  function handleSelectClass(entryId: number | "") {
    flushPendingSave();
    setSelectedEntryId(entryId);
    setOpenError(null);
    setSessionId(null);
    setSessionTimes(null);
    setIsExam(false);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  function handleSelectDate(date: string) {
    flushPendingSave();
    setSelectedDate(date);
    setOpenError(null);
    setSessionId(null);
    setSessionTimes(null);
    setIsExam(false);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  // Marks save themselves shortly after each change, like the hifz gradebook: no button to forget.
  const saveMutation = useMutation({
    mutationFn: async (v: { sessionId: number; roster: RosterStudent[]; isExam: boolean }) => {
      await journalApi.putAttendance(
        v.sessionId,
        v.roster
          .filter((r) => r.attendance_status !== null)
          .map((r) => ({
            student_id: r.student_id,
            status: r.attendance_status as AttendanceStatus,
            comment: r.attendance_comment,
          })),
      );
      return journalApi.putGrades(
        v.sessionId,
        v.isExam
          ? v.roster
              .filter((r) => r.score !== null && r.score !== undefined && !Number.isNaN(r.score))
              .map((r) => ({ student_id: r.student_id, score: r.score as number }))
          : [],
      );
    },
    onSuccess: (detail, v) => {
      setSaveFailed(false);
      // A save for a lesson the teacher has already left must not overwrite the new one.
      if (latest.current.sessionId !== v.sessionId) return;
      const sent = JSON.stringify(v.roster);
      if (JSON.stringify(latest.current.roster) === sent) {
        // Nothing changed meanwhile: take the server's view (e.g. excuses it applied).
        setRoster(detail.roster);
        savedSnapshot.current = JSON.stringify(detail.roster);
      } else {
        // The teacher kept marking while this was in flight: keep their marks, save them next.
        savedSnapshot.current = sent;
      }
    },
    onError: (err) => {
      setSaveFailed(true);
      setSnackbar(apiErrorMessage(err, t("journal.save_failed"), t));
    },
  });

  function saveNow() {
    const cur = latest.current;
    if (!cur.sessionId || !cur.isDirty || saveMutation.isPending) return;
    saveMutation.mutate({ sessionId: cur.sessionId, roster: cur.roster, isExam: cur.isExam });
  }

  // Save ~0.8 s after the last change; re-runs after a save so edits made meanwhile go too.
  // Not retried automatically after a failure, so a rejected mark doesn't loop: the retry button does it.
  useEffect(() => {
    if (!isDirty || !sessionId || saveMutation.isPending || saveFailed) return;
    const timer = window.setTimeout(saveNow, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, isDirty, sessionId, saveMutation.isPending, saveFailed]);

  // Leaving the page (menu, another tab of the app) saves what's pending right away.
  useEffect(() => {
    const onHide = () => saveNow();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckOut() {
    const ok = await confirm({ message: t("journal.checked_out_confirm"), confirmLabel: t("journal.check_out") });
    if (!ok) return;
    checkOutMutation.mutate();
  }

  function setAttendance(studentId: number, status: AttendanceStatus | null) {
    setSaveFailed(false);
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, attendance_status: status } : r)));
  }

  function setScore(studentId: number, score: number | null) {
    setSaveFailed(false);
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, score } : r)));
  }

  function markAllPresent() {
    setSaveFailed(false);
    setRoster((prev) => prev.map((r) => (r.excuse_reason ? r : { ...r, attendance_status: "PRESENT" as AttendanceStatus })));
  }

  const attendanceCounts = useMemo(() => countAttendance(roster.map((r) => r.attendance_status)), [roster]);

  const { data: performance } = useQuery({
    queryKey: ["journal-performance", selectedAssignmentId],
    queryFn: () => journalApi.performance(Number(selectedAssignmentId)),
    enabled: showPerformance && Boolean(selectedAssignmentId),
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t("journal.title")}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("journal.select_class")}
          value={selectedEntryId}
          onChange={(e) => handleSelectClass(e.target.value ? Number(e.target.value) : "")}
          sx={{ minWidth: { sm: 280 }, width: { xs: "100%", sm: "auto" } }}
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

      {(() => {
        const opt = classOptions.find((c) => c.entryId === selectedEntryId);
        if (!openError || !opt || sessionId) return null;
        return (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <b>{openError}</b>
            <br />
            {t("journal.lesson_time_hint", { day: t(`days.${opt.dayOfWeek}`), time: opt.timeRange, group: opt.groupName })}
          </Alert>
        );
      })()}

      {sessionId && (
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
              <Button size="small" variant="outlined" disabled={checkOutMutation.isPending} onClick={() => handleCheckOut()}>
                {t("journal.check_out")}
              </Button>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={isExam}
                  disabled={setExamFlagMutation.isPending}
                  onChange={(e) => setExamFlagMutation.mutate(e.target.checked)}
                />
              }
              label={t("journal.exam_toggle")}
            />
          </Box>

          {roster.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>{t("journal.no_students_hint")}</Alert>}

          {roster.length > 0 && (
            <>
          <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllPresent}>
              {t("journal.mark_all_present")}
            </Button>
            <AttendanceLegend counts={attendanceCounts} />
          </Box>

          {/* Phones: one card per student, name above full-width buttons. A table row could not
              fit the name, four 44 px buttons and the note icon in 390 px without scrolling. */}
          {isMobile ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
              {roster.map((r) => (
                <Paper
                  key={r.student_id}
                  variant="outlined"
                  data-testid="attendance-card"
                  sx={{ p: 1.5, bgcolor: r.attendance_status ? ATTENDANCE_ROW_TINT[r.attendance_status] : undefined }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                    <Typography
                      onClick={() => setProfileStudentId(r.student_id)}
                      sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: "anywhere", cursor: "pointer" }}
                    >
                      {r.full_name}
                    </Typography>
                    <IconButton aria-label={t("students.notes_title")} title={t("students.notes_title")} size="small" onClick={() => setNoteStudent({ id: r.student_id, name: r.full_name })}>
                      <CommentIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <AttendanceToggle fullWidth value={r.attendance_status} excuseReason={r.excuse_reason} onChange={(value) => setAttendance(r.student_id, value)} />
                  {isExam && (
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      label={t("journal.col_grade")}
                      value={r.score ?? ""}
                      onChange={(e) => setScore(r.student_id, e.target.value === "" ? null : Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 0, max: 100, inputMode: "numeric" }, inputLabel: { shrink: true } }}
                      sx={{ mt: 1.25 }}
                    />
                  )}
                </Paper>
              ))}
            </Box>
          ) : (
          <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_student")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_attendance")}</TableCell>
                  {isExam && <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_grade")}</TableCell>}
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {t("journal.col_note")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roster.map((r) => (
                  <TableRow key={r.student_id} hover sx={{ bgcolor: r.attendance_status ? ATTENDANCE_ROW_TINT[r.attendance_status] : undefined }}>
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
                      <AttendanceToggle value={r.attendance_status} excuseReason={r.excuse_reason} onChange={(value) => setAttendance(r.student_id, value)} />
                    </TableCell>
                    {isExam && (
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
                    )}
                    <TableCell align="right">
                      <IconButton aria-label={t("students.notes_title")} title={t("students.notes_title")} size="small" onClick={() => setNoteStudent({ id: r.student_id, name: r.full_name })}>
                        <CommentIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, minHeight: 40 }}>
            {saveFailed ? (
              <>
                <Typography variant="body2" sx={{ color: "error.main" }}>
                  {t("hifz.autosave_failed")}
                </Typography>
                <Button variant="contained" onClick={() => { setSaveFailed(false); }}>
                  {t("hifz.autosave_retry")}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {isDirty || saveMutation.isPending ? t("hifz.autosave_saving") : t("hifz.autosave_hint")}
              </Typography>
            )}
          </Box>
            </>
          )}
        </>
      )}

      {noteStudent && (
        <NotesDialog student={noteStudent} onClose={() => setNoteStudent(null)} onError={(msg) => setSnackbar(msg)} />
      )}

      {profileStudentId !== null && (
        <StudentProfileDialog studentId={profileStudentId} onClose={() => setProfileStudentId(null)} />
      )}

      <Dialog open={showPerformance} onClose={() => setShowPerformance(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
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
                    bgcolor: STATUS_FILL[key],
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
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const runOnce = useSingleFlight();
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
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  // A note is easy to fix, so it's added without a question; runOnce stops a double tap from
  // adding it twice. Errors are reported by the mutation's onError.
  async function handleAddNote() {
    await runOnce(() => createMutation.mutateAsync().catch(() => {}));
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
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
        <Button variant="contained" disabled={!body.trim() || createMutation.isPending} onClick={() => handleAddNote()}>
          {t("journal.note_add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
