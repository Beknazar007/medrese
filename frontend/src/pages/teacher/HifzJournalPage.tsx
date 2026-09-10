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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hifzApi } from "../../api/entities";
import type { HifzExam, HifzKind, HifzRecordDetail, HifzRosterStudent, HifzTarget } from "../../api/types";
import { apiErrorMessage } from "../../lib/errors";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasAnyValue(d: HifzRecordDetail): boolean {
  return d.score !== null || d.juz !== null || d.page_from !== null || d.page_to !== null || Boolean(d.comment);
}

export default function HifzJournalPage() {
  const { t } = useTranslation();

  const { data: groups } = useQuery({ queryKey: ["hifz-groups"], queryFn: () => hifzApi.groups() });

  const [groupId, setGroupId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [roster, setRoster] = useState<HifzRosterStudent[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [targetsStudent, setTargetsStudent] = useState<{ id: number; name: string } | null>(null);
  const [examsStudent, setExamsStudent] = useState<{ id: number; name: string } | null>(null);
  const savedSnapshot = useRef<string>("[]");
  const autoLoadedOnce = useRef(false);

  const isDirty = JSON.stringify(roster) !== savedSnapshot.current;

  const rosterQuery = useQuery({
    queryKey: ["hifz-roster", groupId, selectedDate],
    queryFn: () => hifzApi.roster(Number(groupId), selectedDate),
    enabled: false,
  });

  // Comfort win: auto-select the teacher's only hafiz group (most teachers have exactly one).
  useEffect(() => {
    if (autoLoadedOnce.current || groupId !== "" || !groups || groups.length === 0) return;
    autoLoadedOnce.current = true;
    setGroupId(groups[0].id);
  }, [groups, groupId]);

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(t("hifz.unsaved_confirm"));
  }

  function handleSelectGroup(id: number | "") {
    if (!confirmDiscardIfDirty()) return;
    setGroupId(id);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  function handleSelectDate(date: string) {
    if (!confirmDiscardIfDirty()) return;
    setSelectedDate(date);
    setRoster([]);
    savedSnapshot.current = "[]";
  }

  async function loadRoster() {
    if (!groupId) return;
    const { data } = await rosterQuery.refetch();
    if (data) {
      setRoster(data);
      savedSnapshot.current = JSON.stringify(data);
    }
  }

  const saveAllMutation = useMutation({
    mutationFn: () => {
      // A (student, kind) pair is only worth omitting if it never had a value — once a
      // record exists server-side, it must keep being sent even when cleared back to empty,
      // or clearing it in the UI would silently fail to clear it in the database.
      const original: HifzRosterStudent[] = JSON.parse(savedSnapshot.current);
      const hadValue = (studentId: number, kind: "hifz" | "repeat") =>
        hasAnyValue(original.find((o) => o.student_id === studentId)?.[kind] ?? { score: null, juz: null, page_from: null, page_to: null, comment: null });

      const records = roster.flatMap((r) => {
        const rows: ({ student_id: number; kind: HifzKind } & HifzRecordDetail)[] = [];
        if (hasAnyValue(r.hifz) || hadValue(r.student_id, "hifz")) rows.push({ student_id: r.student_id, kind: "HIFZ", ...r.hifz });
        if (hasAnyValue(r.repeat) || hadValue(r.student_id, "repeat")) rows.push({ student_id: r.student_id, kind: "REPEAT", ...r.repeat });
        return rows;
      });
      return hifzApi.putRecords(Number(groupId), selectedDate, records);
    },
    onSuccess: (updated) => {
      setRoster(updated);
      savedSnapshot.current = JSON.stringify(updated);
      setSnackbar(t("hifz.saved"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("hifz.save_failed"))),
  });

  function updateRecord(studentId: number, kind: "hifz" | "repeat", patch: Partial<HifzRecordDetail>) {
    setRoster((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, [kind]: { ...r[kind], ...patch } } : r)),
    );
  }

  const numberOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
        {t("hifz.title")}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("hifz.select_group")}
          value={groupId}
          onChange={(e) => handleSelectGroup(e.target.value ? Number(e.target.value) : "")}
          sx={{ minWidth: 220 }}
        >
          {(groups ?? []).map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
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
        <Button variant="contained" disabled={!groupId || rosterQuery.isFetching} onClick={loadRoster}>
          {t("hifz.load")}
        </Button>
      </Box>

      {groups && groups.length === 0 && <Alert severity="info">{t("hifz.no_groups")}</Alert>}

      {roster.length > 0 && (
        <>
          <TableContainer component={Paper} sx={{ overflowX: "auto", mb: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("hifz.col_student")}</TableCell>
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
                {roster.map((r, idx) => (
                  <Fragment key={r.student_id}>
                    {(["hifz", "repeat"] as const).map((kind, kindIdx) => (
                      <TableRow key={`${r.student_id}-${kind}`} hover sx={{ bgcolor: idx % 2 === 1 ? "action.hover" : undefined }}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{kindIdx === 0 ? r.full_name : ""}</TableCell>
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

          <Button
            variant="contained"
            size="large"
            onClick={() => saveAllMutation.mutate()}
            disabled={saveAllMutation.isPending || !isDirty}
          >
            {isDirty ? t("hifz.save_all") : t("hifz.saved")}
          </Button>
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
  const queryClient = useQueryClient();
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
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  const updateMutation = useMutation({
    mutationFn: () => hifzApi.updateTarget(editingId!, payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-targets", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hifzApi.removeTarget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hifz-targets", student.id] }),
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
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
            <IconButton size="small" onClick={() => deleteMutation.mutate(target.id)}>
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
          onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
        >
          {editingId ? t("hifz.target_save") : t("hifz.target_add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HifzExamsDialog({
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [title, setTitle] = useState<string>("");
  const [juzFrom, setJuzFrom] = useState<string>("");
  const [juzTo, setJuzTo] = useState<string>("");
  const [score, setScore] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  const { data: exams } = useQuery({ queryKey: ["hifz-exams", student.id], queryFn: () => hifzApi.exams(student.id) });

  function resetForm() {
    setEditingId(null);
    setDate(todayIso());
    setTitle("");
    setJuzFrom("");
    setJuzTo("");
    setScore("");
    setComment("");
  }

  function startEdit(exam: HifzExam) {
    setEditingId(exam.id);
    setDate(exam.date);
    setTitle(exam.title);
    setJuzFrom(exam.juz_from?.toString() ?? "");
    setJuzTo(exam.juz_to?.toString() ?? "");
    setScore(exam.score?.toString() ?? "");
    setComment(exam.comment ?? "");
  }

  const payload = () => ({
    student_id: student.id,
    date,
    title,
    juz_from: juzFrom === "" ? null : Number(juzFrom),
    juz_to: juzTo === "" ? null : Number(juzTo),
    score: score === "" ? null : Number(score),
    comment: comment === "" ? null : comment,
  });

  const createMutation = useMutation({
    mutationFn: () => hifzApi.createExam(payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  const updateMutation = useMutation({
    mutationFn: () => hifzApi.updateExam(editingId!, payload()),
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] });
    },
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hifzApi.removeExam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hifz-exams", student.id] }),
    onError: (err) => onError(apiErrorMessage(err, "Error")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("hifz.exams_title", { name: student.name })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(exams ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("hifz.exams_empty")}
          </Typography>
        )}
        {(exams ?? []).map((exam) => (
          <Box key={exam.id} sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">
                {exam.date} — {exam.title} {exam.score !== null ? `(${exam.score})` : ""}
              </Typography>
              {exam.comment && (
                <Typography variant="caption" color="text.secondary">
                  {exam.comment}
                </Typography>
              )}
            </Box>
            <IconButton size="small" onClick={() => startEdit(exam)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => deleteMutation.mutate(exam.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        <Typography variant="subtitle2">{editingId ? t("hifz.exam_edit") : t("hifz.exam_add")}</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="date" label={t("hifz.exam_date")} value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.exam_score")} value={score} onChange={(e) => setScore(e.target.value)} slotProps={{ htmlInput: { min: 0, max: 100 } }} fullWidth />
        </Box>
        <TextField size="small" label={t("hifz.exam_title")} value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" label={t("hifz.exam_juz_from")} value={juzFrom} onChange={(e) => setJuzFrom(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.exam_juz_to")} value={juzTo} onChange={(e) => setJuzTo(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
        </Box>
        <TextField size="small" label={t("hifz.exam_comment")} value={comment} onChange={(e) => setComment(e.target.value)} multiline minRows={2} fullWidth />
      </DialogContent>
      <DialogActions>
        {editingId && <Button onClick={resetForm}>{t("hifz.exam_cancel")}</Button>}
        <Button onClick={onClose}>{t("common.close")}</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || createMutation.isPending || updateMutation.isPending}
          onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
        >
          {editingId ? t("hifz.exam_save") : t("hifz.exam_add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
