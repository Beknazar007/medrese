import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../hooks/useIsMobile";
import { assignmentsApi, hifzApi, scheduleApi } from "../../api/entities";
import type { AttendanceStatus, HifzKind, HifzRecordDetail, HifzRosterStudent, HifzTarget } from "../../api/types";
import AttendanceToggle, { ATTENDANCE_OPTIONS, ATTENDANCE_ROW_TINT, countAttendance } from "../../components/AttendanceToggle";
import { useConfirm } from "../../context/ConfirmContext";
import { apiErrorMessage } from "../../lib/errors";
import { nameById, useGroups, useSubjects, useTimeSlots } from "../../hooks/useReferenceData";
import { useAuth } from "../../context/AuthContext";
import HifzAssignments from "../../components/hifz/HifzAssignments";
import HifzExamsDialog from "../../components/hifz/HifzExamsDialog";
import HifzGradebook, { type GradebookView } from "../../components/hifz/HifzGradebook";
import { todayIso as localTodayIso, weekRange } from "../../components/hifz/hifzUtils";

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

type HifzTab = "lesson" | "journal" | "assignments";

export default function HifzJournalPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Rector/dean only read the journal and assignments; the lesson screen is the teacher's.
  const isTeacher = user?.role === "TEACHER";
  const [tab, setTab] = useState<HifzTab>(isTeacher ? "lesson" : "journal");
  const [view, setView] = useState<GradebookView>(() => ({
    preset: "today",
    from: localTodayIso(),
    to: localTodayIso(),
    groupId: "",
    focusStudentId: null,
  }));

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1, fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
        {t("hifz.title")}
      </Typography>
      <Tabs value={tab} onChange={(_e, next: HifzTab) => setTab(next)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
        {isTeacher && <Tab value="lesson" label={t("hifz.tab_lesson")} />}
        <Tab value="journal" label={t("hifz.tab_journal")} />
        <Tab value="assignments" label={t("hifz.tab_assignments")} />
      </Tabs>
      {tab === "lesson" && (
        <HifzLessonTab
          onOpenJournal={(groupId) => {
            setView({ preset: "week", ...weekRange(), groupId, focusStudentId: null });
            setTab("journal");
          }}
        />
      )}
      {tab === "journal" && <HifzGradebook view={view} onViewChange={setView} />}
      {tab === "assignments" && (
        <HifzAssignments
          onOpenInJournal={(target, groupId) => {
            setView({
              preset: "custom",
              from: target.start_date,
              to: target.end_date,
              groupId,
              focusStudentId: target.student_id,
            });
            setTab("journal");
          }}
        />
      )}
    </Box>
  );
}

function HifzLessonTab({ onOpenJournal }: { onOpenJournal: (groupId: number) => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();

  const { data: hifzGroups } = useQuery({ queryKey: ["hifz-groups"], queryFn: () => hifzApi.groups() });
  const { data: assignments } = useQuery({ queryKey: ["assignments", "mine"], queryFn: () => assignmentsApi.list() });
  const { data: entries } = useQuery({ queryKey: ["schedule", "mine"], queryFn: () => scheduleApi.list() });
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: timeSlots } = useTimeSlots();

  const hifzGroupIdSet = useMemo(() => new Set((hifzGroups ?? []).map((g) => g.id)), [hifzGroups]);
  const sortedSlots = useMemo(() => [...(timeSlots ?? [])].sort((a, b) => a.order - b.order), [timeSlots]);

  const classOptions = useMemo(() => {
    return [...(entries ?? [])]
      .filter((entry) => hifzGroupIdSet.has(entry.group_id))
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
          groupId: entry.group_id,
          groupName,
          timeRange: slot ? `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}` : "",
          dayOfWeek: entry.day_of_week,
          isToday: entry.day_of_week === todayDayOfWeek(),
          label: `${dayLabel} ${slot?.start_time.slice(0, 5) ?? ""} — ${subjectName} — ${groupName}`,
        };
      });
  }, [entries, hifzGroupIdSet, assignments, subjects, groups, sortedSlots, t]);

  const [selectedEntryId, setSelectedEntryId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionTimes, setSessionTimes] = useState<{ checkedInAt: string | null; checkedOutAt: string | null } | null>(
    null,
  );
  const [roster, setRoster] = useState<HifzRosterStudent[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [targetsStudent, setTargetsStudent] = useState<{ id: number; name: string } | null>(null);
  const [examsStudent, setExamsStudent] = useState<{ id: number; name: string } | null>(null);
  // Why the chosen lesson couldn't be opened (e.g. its time is over) — shown persistently,
  // otherwise the teacher just sees an empty page and thinks the group is gone.
  const [openError, setOpenError] = useState<string | null>(null);
  const autoLoadedOnce = useRef(false);

  // Autosave: every cell is saved on its own shortly after the teacher stops typing (and at
  // once on blur), so nothing is lost on a page reload and a save never overwrites the whole
  // roster. rosterRef/sessionDateRef let the delayed save read the latest values.
  const rosterRef = useRef<HifzRosterStudent[]>([]);
  rosterRef.current = roster;
  const sessionDateRef = useRef<string | null>(null);
  const pendingSaves = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Saves of the same cell run one after another, so an older value can never land last.
  const saveChains = useRef(new Map<string, Promise<unknown>>());
  const [inFlight, setInFlight] = useState(0);
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());

  // Comfort win: open today's hafiz class automatically, same as the regular journal.
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

  const openSessionMutation = useMutation({
    mutationFn: ({ entryId, date }: { entryId: number; date: string }) => hifzApi.getOrCreateSession(entryId, date),
    onSuccess: (detail) => {
      setOpenError(null);
      setSessionId(detail.session.id);
      setSessionTimes({
        checkedInAt: detail.session.teacher_checked_in_at,
        checkedOutAt: detail.session.teacher_checked_out_at,
      });
      setRoster(detail.roster);
      sessionDateRef.current = detail.session.date;
      setFailedKeys(new Set());
    },
    onError: (err) => setOpenError(apiErrorMessage(err, t("hifz.save_failed"), t)),
  });

  const selectedOption = classOptions.find((c) => c.entryId === selectedEntryId);

  function openSessionFor(entryId: number, date: string) {
    openSessionMutation.mutate({ entryId, date });
  }

  const checkOutMutation = useMutation({
    mutationFn: () => hifzApi.checkOut(sessionId!),
    onSuccess: (session) => {
      setSessionTimes({ checkedInAt: session.teacher_checked_in_at, checkedOutAt: session.teacher_checked_out_at });
      setSnackbar(t("journal.checked_out"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("common.error"), t)),
  });

  async function handleCheckOut() {
    const ok = await confirm({ message: t("journal.checked_out_confirm"), confirmLabel: t("journal.check_out") });
    if (!ok) return;
    checkOutMutation.mutate();
  }

  async function track<R>(key: string, work: () => Promise<R>): Promise<R | undefined> {
    setInFlight((n) => n + 1);
    try {
      const result = await work();
      setFailedKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return result;
    } catch (err) {
      setFailedKeys((prev) => new Set(prev).add(key));
      setSnackbar(apiErrorMessage(err, t("hifz.save_failed"), t));
      return undefined;
    } finally {
      setInFlight((n) => n - 1);
    }
  }

  function saveCell(studentId: number, kind: "hifz" | "repeat") {
    const date = sessionDateRef.current;
    const row = rosterRef.current.find((r) => r.student_id === studentId);
    if (!date || !row) return;
    const cell = row[kind];
    const key = `${studentId}:${kind}`;
    const previous = saveChains.current.get(key) ?? Promise.resolve();
    const next = previous.then(() => track(key, () =>
      hifzApi.putRecord({
        student_id: studentId,
        date,
        kind: kind === "hifz" ? "HIFZ" : "REPEAT",
        score: cell.score,
        juz: cell.juz,
        page_from: cell.page_from,
        page_to: cell.page_to,
        comment: cell.comment,
      }),
    ));
    saveChains.current.set(key, next);
  }

  function scheduleSave(studentId: number, kind: "hifz" | "repeat", delayMs = 700) {
    const key = `${studentId}:${kind}`;
    clearTimeout(pendingSaves.current.get(key));
    pendingSaves.current.set(
      key,
      setTimeout(() => {
        pendingSaves.current.delete(key);
        saveCell(studentId, kind);
      }, delayMs),
    );
  }

  function flushSave(studentId: number, kind: "hifz" | "repeat") {
    const key = `${studentId}:${kind}`;
    if (!pendingSaves.current.has(key)) return;
    clearTimeout(pendingSaves.current.get(key));
    pendingSaves.current.delete(key);
    saveCell(studentId, kind);
  }

  function flushAllSaves() {
    for (const key of [...pendingSaves.current.keys()]) {
      const [id, kind] = key.split(":");
      flushSave(Number(id), kind as "hifz" | "repeat");
    }
  }

  // Leaving or reloading the page sends whatever is still waiting for its delay.
  useEffect(() => {
    const onHide = () => flushAllSaves();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushAllSaves();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAllSaves();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveAttendance(records: { student_id: number; status: AttendanceStatus; comment: string | null }[]) {
    if (!sessionId || records.length === 0) return;
    void track("attendance", () => hifzApi.putAttendance(sessionId, records));
  }

  function resetSession() {
    flushAllSaves();
    setOpenError(null);
    setSessionId(null);
    setSessionTimes(null);
    setRoster([]);
    sessionDateRef.current = null;
    setFailedKeys(new Set());
  }

  function handleSelectClass(entryId: number | "") {
    setSelectedEntryId(entryId);
    resetSession();
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    resetSession();
  }

  function retryFailed() {
    for (const key of failedKeys) {
      const [id, kind] = key.split(":");
      if (kind === "hifz" || kind === "repeat") saveCell(Number(id), kind);
    }
    if (failedKeys.has("attendance")) {
      saveAttendance(
        rosterRef.current
          .filter((r) => r.attendance_status !== null)
          .map((r) => ({ student_id: r.student_id, status: r.attendance_status as AttendanceStatus, comment: r.attendance_comment })),
      );
    }
  }

  function updateRecord(studentId: number, kind: "hifz" | "repeat", patch: Partial<HifzRecordDetail>) {
    const next = rosterRef.current.map((r) =>
      r.student_id === studentId ? { ...r, [kind]: { ...r[kind], ...patch } } : r,
    );
    rosterRef.current = next;
    setRoster(next);
    scheduleSave(studentId, kind);
  }

  function setAttendance(studentId: number, status: AttendanceStatus | null) {
    setRoster((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, attendance_status: status } : r)));
    const row = rosterRef.current.find((r) => r.student_id === studentId);
    if (status && row) saveAttendance([{ student_id: studentId, status, comment: row.attendance_comment }]);
  }

  function markAllPresent() {
    setRoster((prev) => prev.map((r) => ({ ...r, attendance_status: "PRESENT" as AttendanceStatus })));
    saveAttendance(
      rosterRef.current.map((r) => ({ student_id: r.student_id, status: "PRESENT" as AttendanceStatus, comment: r.attendance_comment })),
    );
  }

  const attendanceCounts = useMemo(() => countAttendance(roster.map((r) => r.attendance_status)), [roster]);

  const numberOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("hifz.select_class")}
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
          label={t("hifz.select_date")}
          value={selectedDate}
          onChange={(e) => handleSelectDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant="contained"
          disabled={!selectedEntryId || openSessionMutation.isPending}
          onClick={() => selectedEntryId && openSessionFor(Number(selectedEntryId), selectedDate)}
        >
          {t("hifz.load")}
        </Button>
      </Box>

      {hifzGroups && hifzGroups.length === 0 && <Alert severity="info">{t("hifz.no_groups")}</Alert>}
      {hifzGroups && hifzGroups.length > 0 && classOptions.length === 0 && (
        <Alert severity="info">{t("hifz.no_classes")}</Alert>
      )}

      {openError && selectedOption && !sessionId && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>{openError}</b>
          <br />
          {t("hifz.lesson_time_hint", {
            day: t(`days.${selectedOption.dayOfWeek}`),
            time: selectedOption.timeRange,
            group: selectedOption.groupName,
          })}
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" color="inherit" size="small" onClick={() => onOpenJournal(selectedOption.groupId)}>
              {t("hifz.open_group_journal")}
            </Button>
          </Box>
        </Alert>
      )}

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
          </Box>

          {roster.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>{t("journal.no_students_hint")}</Alert>}

          {roster.length > 0 && (
            <>
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
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_student")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("journal.col_attendance")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_kind")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_score")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_juz")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_page_from")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_page_to")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_comment")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {t("hifz.col_actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roster.map((r) => (
                  <Fragment key={r.student_id}>
                    {(["hifz", "repeat"] as const).map((kind, kindIdx) => (
                      <TableRow
                        key={`${r.student_id}-${kind}`}
                        hover
                        sx={{
                          bgcolor: r.attendance_status ? ATTENDANCE_ROW_TINT[r.attendance_status] : undefined,
                          "& > td": kindIdx === 1 ? { borderBottomWidth: 2 } : undefined,
                        }}
                      >
                        {kindIdx === 0 && (
                          <>
                            <TableCell rowSpan={2} sx={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
                              {r.full_name}
                            </TableCell>
                            <TableCell rowSpan={2} sx={{ verticalAlign: "top" }}>
                              <AttendanceToggle value={r.attendance_status} onChange={(value) => setAttendance(r.student_id, value)} />
                            </TableCell>
                          </>
                        )}
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Chip
                            size="small"
                            label={kind === "hifz" ? t("hifz.kind_hifz") : t("hifz.kind_repeat")}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={r[kind].score ?? ""}
                            onChange={(e) => updateRecord(r.student_id, kind, { score: numberOrNull(e.target.value) })}
                            onBlur={() => flushSave(r.student_id, kind)}
                            slotProps={{ htmlInput: { min: 0, max: 100 } }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={r[kind].juz ?? ""}
                            onChange={(e) => updateRecord(r.student_id, kind, { juz: numberOrNull(e.target.value) })}
                            onBlur={() => flushSave(r.student_id, kind)}
                            slotProps={{ htmlInput: { min: 1, max: 30 } }}
                            sx={{ width: 70 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={r[kind].page_from ?? ""}
                            onChange={(e) =>
                              updateRecord(r.student_id, kind, { page_from: numberOrNull(e.target.value) })
                            }
                            onBlur={() => flushSave(r.student_id, kind)}
                            slotProps={{ htmlInput: { min: 1, max: 604 } }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={r[kind].page_to ?? ""}
                            onChange={(e) =>
                              updateRecord(r.student_id, kind, { page_to: numberOrNull(e.target.value) })
                            }
                            onBlur={() => flushSave(r.student_id, kind)}
                            slotProps={{ htmlInput: { min: 1, max: 604 } }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={r[kind].comment ?? ""}
                            onChange={(e) =>
                              updateRecord(r.student_id, kind, { comment: e.target.value === "" ? null : e.target.value })
                            }
                            onBlur={() => flushSave(r.student_id, kind)}
                            sx={{ minWidth: 160 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {kindIdx === 0 && (
                            <>
                              <IconButton
                                size="small"
                                title={t("hifz.targets_button")}
                                onClick={() => setTargetsStudent({ id: r.student_id, name: r.full_name })}
                              >
                                <AssignmentIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                title={t("hifz.exams_button")}
                                onClick={() => setExamsStudent({ id: r.student_id, name: r.full_name })}
                              >
                                <SchoolIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            {failedKeys.size > 0 ? (
              <>
                <Typography variant="body2" color="error">
                  {t("hifz.autosave_failed")}
                </Typography>
                <Button size="small" variant="outlined" color="error" onClick={retryFailed}>
                  {t("hifz.autosave_retry")}
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {inFlight > 0 ? t("hifz.autosave_saving") : t("hifz.autosave_hint")}
              </Typography>
            )}
          </Box>
            </>
          )}
        </>
      )}

      {targetsStudent && <HifzTargetsDialog student={targetsStudent} onClose={() => setTargetsStudent(null)} onError={setSnackbar} />}
      {examsStudent && <HifzExamsDialog student={examsStudent} onClose={() => setExamsStudent(null)} onError={setSnackbar} />}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

function HifzTargetsDialog({
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
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kind, setKind] = useState<HifzKind>("HIFZ");
  const [juzFrom, setJuzFrom] = useState<string>("");
  const [juzTo, setJuzTo] = useState<string>("");
  const [pageFrom, setPageFrom] = useState<string>("");
  const [pageTo, setPageTo] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [endDate, setEndDate] = useState<string>(todayIso());
  const [note, setNote] = useState<string>("");

  const { data: targets } = useQuery({ queryKey: ["hifz-targets", student.id], queryFn: () => hifzApi.targets(student.id) });

  function resetForm() {
    setEditingId(null);
    setKind("HIFZ");
    setJuzFrom("");
    setJuzTo("");
    setPageFrom("");
    setPageTo("");
    setStartDate(todayIso());
    setEndDate(todayIso());
    setNote("");
  }

  function startEdit(target: HifzTarget) {
    setEditingId(target.id);
    setKind(target.kind);
    setJuzFrom(target.juz_from?.toString() ?? "");
    setJuzTo(target.juz_to?.toString() ?? "");
    setPageFrom(target.page_from?.toString() ?? "");
    setPageTo(target.page_to?.toString() ?? "");
    setStartDate(target.start_date);
    setEndDate(target.end_date);
    setNote(target.note ?? "");
  }

  const payload = () => ({
    student_id: student.id,
    kind,
    juz_from: juzFrom === "" ? null : Number(juzFrom),
    juz_to: juzTo === "" ? null : Number(juzTo),
    page_from: pageFrom === "" ? null : Number(pageFrom),
    page_to: pageTo === "" ? null : Number(pageTo),
    start_date: startDate,
    end_date: endDate,
    note: note === "" ? null : note,
  });

  const createMutation = useMutation({
    mutationFn: () => hifzApi.createTarget(payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-targets", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  const updateMutation = useMutation({
    mutationFn: () => hifzApi.updateTarget(editingId!, payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-targets", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hifzApi.removeTarget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hifz-targets", student.id] }),
    onError: (err) => onError(apiErrorMessage(err, t("common.error"), t)),
  });

  async function handleSaveTarget() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (!ok) return;
    if (editingId) updateMutation.mutate();
    else createMutation.mutate();
  }

  async function handleDeleteTarget(id: number) {
    const ok = await confirm({ message: t("common.confirm_delete"), destructive: true, confirmLabel: t("common.remove") });
    if (!ok) return;
    deleteMutation.mutate(id);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{t("hifz.targets_title", { name: student.name })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(targets ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("hifz.targets_empty")}
          </Typography>
        )}
        {(targets ?? []).map((target) => (
          <Box key={target.id} sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">
                {target.kind === "HIFZ" ? t("hifz.kind_hifz") : t("hifz.kind_repeat")} — {target.start_date} → {target.end_date}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("hifz.col_juz")}: {target.juz_from ?? "—"}-{target.juz_to ?? "—"} · {t("hifz.col_page_from")}/{t("hifz.col_page_to")}:{" "}
                {target.page_from ?? "—"}-{target.page_to ?? "—"}
                {target.note ? ` · ${target.note}` : ""}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => startEdit(target)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDeleteTarget(target.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        <Typography variant="subtitle2">{editingId ? t("hifz.target_edit") : t("hifz.target_add")}</Typography>
        <TextField select size="small" label={t("hifz.col_kind")} value={kind} onChange={(e) => setKind(e.target.value as HifzKind)}>
          <MenuItem value="HIFZ">{t("hifz.kind_hifz")}</MenuItem>
          <MenuItem value="REPEAT">{t("hifz.kind_repeat")}</MenuItem>
        </TextField>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" label={t("hifz.target_juz_from")} value={juzFrom} onChange={(e) => setJuzFrom(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.target_juz_to")} value={juzTo} onChange={(e) => setJuzTo(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" label={t("hifz.target_page_from")} value={pageFrom} onChange={(e) => setPageFrom(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 604 } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.target_page_to")} value={pageTo} onChange={(e) => setPageTo(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 604 } }} fullWidth />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="date" label={t("hifz.target_start_date")} value={startDate} onChange={(e) => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          <TextField size="small" type="date" label={t("hifz.target_end_date")} value={endDate} onChange={(e) => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        </Box>
        <TextField size="small" label={t("hifz.target_note")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} fullWidth />
      </DialogContent>
      <DialogActions>
        {editingId && <Button onClick={resetForm}>{t("hifz.target_cancel")}</Button>}
        <Button onClick={onClose}>{t("common.close")}</Button>
        <Button
          variant="contained"
          disabled={createMutation.isPending || updateMutation.isPending}
          onClick={() => handleSaveTarget()}
        >
          {editingId ? t("hifz.target_save") : t("hifz.target_add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
