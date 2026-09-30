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
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import RepeatIcon from "@mui/icons-material/Repeat";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { hifzApi } from "../../api/entities";
import type { HifzJournal, HifzKind, HifzTarget } from "../../api/types";
import { useConfirm } from "../../context/ConfirmContext";
import { apiErrorMessage } from "../../lib/errors";
import { LEVEL_CHIP, addDays, daysBetween, fmtDate, level, rangeText, targetStatus, todayIso, type TargetStatus } from "./hifzUtils";

type StatusFilter = TargetStatus | "all";
type Student = HifzJournal["students"][number];

const STATUS_COLOR: Record<TargetStatus, "success" | "primary" | "default"> = {
  active: "success",
  upcoming: "primary",
  done: "default",
};

export default function HifzAssignments({
  onOpenInJournal,
}: {
  onOpenInJournal: (target: HifzTarget, groupId: number | "") => void;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const today = todayIso();
  const units = { juz: t("hifz.unit_juz"), page: t("hifz.unit_page") };

  // Today's journal is the cheapest source of the visible students, groups and edit rights.
  const { data: base } = useQuery({ queryKey: ["hifz-journal", today, today], queryFn: () => hifzApi.journal(today, today) });
  const { data: targets } = useQuery({ queryKey: ["hifz-targets-all"], queryFn: () => hifzApi.allTargets() });

  const [studentFilter, setStudentFilter] = useState<number | "">("");
  const [kindFilter, setKindFilter] = useState<HifzKind | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<HifzTarget | "new" | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const students = useMemo(() => base?.students ?? [], [base]);
  const canEdit = Boolean(base?.can_edit);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const groupName = (id: number | undefined) => base?.groups.find((g) => g.id === id)?.name ?? "";

  const all = targets ?? [];
  const visible = all.filter(
    (a) =>
      (studentFilter === "" || a.student_id === studentFilter) &&
      (kindFilter === "" || a.kind === kindFilter) &&
      (statusFilter === "all" || targetStatus(a, today) === statusFilter),
  );
  const activeCount = all.filter((a) => targetStatus(a, today) === "active").length;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["hifz-targets-all"] });
    queryClient.invalidateQueries({ queryKey: ["hifz-journal"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hifzApi.removeTarget(id),
    onSuccess: () => {
      refresh();
      setSnackbar(t("hifz.assignment_deleted"));
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("common.error"), t)),
  });

  async function handleDelete(a: HifzTarget) {
    const ok = await confirm({ message: t("hifz.assignment_delete_confirm"), destructive: true, confirmLabel: t("common.remove") });
    if (ok) deleteMutation.mutate(a.id);
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 1, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("hifz.col_student")}
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200, flex: { xs: 1, sm: "none" } }}
        >
          <MenuItem value="">{t("hifz.all_students")}</MenuItem>
          {students.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.full_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("hifz.col_kind")}
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as HifzKind | "")}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">{t("hifz.both_kinds")}</MenuItem>
          <MenuItem value="HIFZ">{t("hifz.kind_hifz")}</MenuItem>
          <MenuItem value="REPEAT">{t("hifz.kind_repeat")}</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label={t("hifz.status")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="active">{t("hifz.status_active")}</MenuItem>
          <MenuItem value="upcoming">{t("hifz.status_upcoming")}</MenuItem>
          <MenuItem value="done">{t("hifz.status_done")}</MenuItem>
          <MenuItem value="all">{t("hifz.status_all")}</MenuItem>
        </TextField>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing("new")} sx={{ ml: { sm: "auto" } }}>
            {t("hifz.assignment_new")}
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("hifz.assignments_summary", { active: activeCount, total: all.length })}
      </Typography>

      {base && base.groups.length === 0 && <Alert severity="info">{t("hifz.no_groups")}</Alert>}
      {targets && visible.length === 0 && base && base.groups.length > 0 && (
        <Alert severity="info">{t("hifz.assignments_empty")}</Alert>
      )}

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        {visible.map((a) => {
          const student = studentById.get(a.student_id);
          const status = targetStatus(a, today);
          const total = daysBetween(a.start_date, a.end_date) + 1;
          const passed = Math.min(total, Math.max(0, daysBetween(a.start_date, today) + 1));
          const progress = status === "upcoming" ? 0 : Math.round((passed / total) * 100);
          return (
            <Paper key={a.id} variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip
                      size="small"
                      color={a.kind === "HIFZ" ? "primary" : "warning"}
                      label={a.kind === "HIFZ" ? t("hifz.kind_hifz") : t("hifz.kind_repeat")}
                    />
                    <Typography sx={{ fontWeight: 600 }}>{rangeText(a, units) || "—"}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    {student?.full_name ?? `#${a.student_id}`}
                    <Typography component="span" variant="body2" color="text.secondary">
                      {student ? ` · ${groupName(student.group_id)}` : ""}
                    </Typography>
                  </Typography>
                  {a.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {a.note}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mt: 1, fontSize: 13, color: "text.secondary" }}>
                    <Chip size="small" variant={status === "done" ? "outlined" : "filled"} color={STATUS_COLOR[status]} label={t(`hifz.card_status_${status}`)} />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <CalendarMonthIcon sx={{ fontSize: 16 }} />
                      {fmtDate(a.start_date)} — {fmtDate(a.end_date)}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: 16 }} />
                      {status === "done" ? t("hifz.days_done", { count: total }) : t("hifz.days_passed", { passed, total })}
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.25, height: 5, borderRadius: 99 }} />
                  <Box sx={{ display: "flex", gap: 2, mt: 1, fontSize: 13, color: "text.secondary", alignItems: "center" }}>
                    <span>
                      {t("hifz.graded_days")}: <b>{a.graded_days ?? 0}</b>
                    </span>
                    <span>
                      {t("hifz.col_average")}:{" "}
                      {a.avg_score != null ? (
                        <Chip size="small" color={LEVEL_CHIP[level(a.avg_score)]} label={`${Math.round(a.avg_score)}%`} sx={{ height: 20 }} />
                      ) : (
                        "—"
                      )}
                    </span>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "stretch" }}>
                  <Button size="small" startIcon={<TableChartIcon />} onClick={() => onOpenInJournal(a, student?.group_id ?? "")}>
                    {t("hifz.open_in_journal")}
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(a)}>
                        {t("hifz.edit")}
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(a)}>
                        {t("common.remove")}
                      </Button>
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {editing && base && (
        <AssignmentFormDialog
          target={editing === "new" ? null : editing}
          students={students}
          groups={base.groups}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            refresh();
            setEditing(null);
            setSnackbar(msg);
          }}
          onError={(err) => setSnackbar(apiErrorMessage(err, t("common.error"), t))}
        />
      )}
      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

function AssignmentFormDialog({
  target,
  students,
  groups,
  onClose,
  onSaved,
  onError,
}: {
  target: HifzTarget | null;
  students: Student[];
  groups: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (err: unknown) => void;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isNew = target === null;
  const today = todayIso();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [kind, setKind] = useState<HifzKind>(target?.kind ?? "HIFZ");
  const [juzFrom, setJuzFrom] = useState(target?.juz_from?.toString() ?? "");
  const [juzTo, setJuzTo] = useState(target?.juz_to?.toString() ?? "");
  const [pageFrom, setPageFrom] = useState(target?.page_from?.toString() ?? "");
  const [pageTo, setPageTo] = useState(target?.page_to?.toString() ?? "");
  const [startDate, setStartDate] = useState(target?.start_date ?? today);
  const [endDate, setEndDate] = useState(target?.end_date ?? addDays(today, 13)); // two weeks
  const [note, setNote] = useState(target?.note ?? "");

  const byGroup = useMemo(
    () =>
      groups
        .map((g) => ({ group: g, members: students.filter((s) => s.group_id === g.id) }))
        .filter((x) => x.members.length > 0),
    [groups, students],
  );
  const allSelected = students.length > 0 && selected.size === students.length;

  function toggle(ids: number[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const mutation = useMutation({
    mutationFn: async () => {
      const jf = num(juzFrom) as number;
      const range = {
        kind,
        juz_from: jf,
        juz_to: num(juzTo) ?? jf,
        page_from: num(pageFrom),
        page_to: num(pageTo) ?? num(pageFrom),
        start_date: startDate,
        end_date: endDate,
        note: note.trim() || null,
      };
      if (isNew) {
        await hifzApi.createTargetsBulk({ ...range, student_ids: [...selected] });
      } else {
        await hifzApi.updateTarget(target.id, range);
      }
    },
    onSuccess: () =>
      onSaved(
        !isNew ? t("hifz.saved") : selected.size > 1 ? t("hifz.assignment_issued_many", { count: selected.size }) : t("hifz.assignment_issued"),
      ),
    onError,
  });

  const periodInvalid = !startDate || !endDate || endDate < startDate || daysBetween(startDate, endDate) > 400;
  const invalid = juzFrom.trim() === "" || periodInvalid || (isNew && selected.size === 0);

  async function handleSave() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (ok) mutation.mutate();
  }

  const student = target ? students.find((s) => s.id === target.student_id) : undefined;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{isNew ? t("hifz.assignment_new") : t("hifz.assignment_edit")}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {isNew ? (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
              <Typography variant="subtitle2">{t("hifz.pick_students")}</Typography>
              <Button size="small" onClick={() => (allSelected ? setSelected(new Set()) : setSelected(new Set(students.map((s) => s.id))))}>
                {allSelected ? t("hifz.unselect_all") : t("hifz.select_all")}
              </Button>
            </Box>
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, maxHeight: 244, overflowY: "auto", overscrollBehavior: "contain" }}>
              {byGroup.map(({ group, members }) => (
                <Box key={group.id}>
                  <Box
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 0.75,
                      bgcolor: "background.default",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    <span>{group.name}</span>
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      sx={{ fontSize: 11 }}
                      onClick={() => toggle(members.map((m) => m.id), !members.every((m) => selected.has(m.id)))}
                    >
                      {t("hifz.all_in_group")}
                    </Link>
                  </Box>
                  {members.map((s) => (
                    <Box
                      key={s.id}
                      component="label"
                      sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.25, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <Checkbox size="small" checked={selected.has(s.id)} onChange={(e) => toggle([s.id], e.target.checked)} />
                      <Typography variant="body2">{s.full_name}</Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("hifz.selected_count", { count: selected.size })}
            </Typography>
          </Box>
        ) : (
          <TextField size="small" label={t("hifz.col_student")} value={student?.full_name ?? ""} disabled sx={{ mt: 1 }} />
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          {(["HIFZ", "REPEAT"] as const).map((k) => (
            <Paper
              key={k}
              variant="outlined"
              onClick={() => setKind(k)}
              sx={{
                p: 1.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderRadius: 2,
                borderWidth: kind === k ? 2 : 1,
                borderColor: kind === k ? "primary.main" : "divider",
              }}
            >
              {k === "HIFZ" ? <MenuBookIcon color="primary" /> : <RepeatIcon color="warning" />}
              <Typography sx={{ fontWeight: kind === k ? 600 : 400 }}>{k === "HIFZ" ? t("hifz.kind_hifz") : t("hifz.kind_repeat")}</Typography>
            </Paper>
          ))}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" required label={t("hifz.target_juz_from")} value={juzFrom} onChange={(e) => setJuzFrom(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.target_juz_to")} value={juzTo} onChange={(e) => setJuzTo(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 30 } }} fullWidth />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" label={t("hifz.target_page_from")} value={pageFrom} onChange={(e) => setPageFrom(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 604 } }} fullWidth />
          <TextField size="small" type="number" label={t("hifz.target_page_to")} value={pageTo} onChange={(e) => setPageTo(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 604 } }} fullWidth />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="date" required label={t("hifz.target_start_date")} value={startDate} onChange={(e) => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
          <TextField size="small" type="date" required label={t("hifz.target_end_date")} value={endDate} onChange={(e) => setEndDate(e.target.value)} error={periodInvalid} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        </Box>
        <TextField size="small" label={t("hifz.target_note")} placeholder={t("hifz.target_note_hint")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" disabled={invalid || mutation.isPending} onClick={handleSave}>
          {isNew ? t("hifz.assignment_issue") : t("hifz.target_save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
