import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, roomsApi, scheduleApi } from "../api/entities";
import type { DayOfWeek, HourType, ScheduleEntry } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { apiErrorMessage } from "../lib/errors";
import { nameById, useDepartments, useGroups, useSemesters, useSubjects, useTeachers, useTimeSlots } from "../hooks/useReferenceData";

// Validated categorical palette (fixed order) from the dataviz skill's reference palette.
const GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export default function ScheduleGridPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const DAYS: { value: DayOfWeek; label: string }[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    value: d as DayOfWeek,
    label: t(`days.${d}`),
  }));

  const { data: semesters } = useSemesters();
  const { data: timeSlots } = useTimeSlots();
  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: departments } = useDepartments();
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: () => roomsApi.list() });

  const [semesterId, setSemesterId] = useState<number | "">("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const activeSemester = semesters?.find((s) => s.is_active);
  const effectiveSemesterId = semesterId || activeSemester?.id || "";

  const { data: entries } = useQuery({
    queryKey: ["schedule", effectiveSemesterId, groupId],
    queryFn: () =>
      scheduleApi.list({
        ...(effectiveSemesterId ? { semester_id: effectiveSemesterId } : {}),
        ...(groupId ? { group_id: groupId } : {}),
      }),
    enabled: Boolean(effectiveSemesterId) || user?.role === "TEACHER",
  });

  const { data: assignments } = useQuery({
    queryKey: ["assignments", effectiveSemesterId],
    queryFn: () => assignmentsApi.list(effectiveSemesterId ? { semester_id: effectiveSemesterId } : undefined),
    enabled: canWrite && Boolean(effectiveSemesterId),
  });

  const entriesByCell = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of entries ?? []) {
      const key = `${e.day_of_week}-${e.time_slot_id}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [entries]);

  // Stable color per group (by ascending group id) so a group keeps its color across filters/renders.
  const groupColorById = useMemo(() => {
    const sortedIds = [...(groups ?? [])].sort((a, b) => a.id - b.id).map((g) => g.id);
    const map = new Map<number, string>();
    sortedIds.forEach((id, i) => map.set(id, GROUP_COLORS[i % GROUP_COLORS.length]));
    return map;
  }, [groups]);
  const showAllGroups = !groupId;

  const [dialog, setDialog] = useState<{ day: DayOfWeek; timeSlotId: number; entry: ScheduleEntry | null } | null>(
    null,
  );
  const [assignmentId, setAssignmentId] = useState<number | "">("");
  const [roomId, setRoomId] = useState<number | "">("");
  const [createMode, setCreateMode] = useState<"existing" | "new">("existing");
  const [newTeacherId, setNewTeacherId] = useState<number | "">("");
  const [newSubjectId, setNewSubjectId] = useState<number | "">("");
  const [newGroupId, setNewGroupId] = useState<number | "">("");
  const [newHourType, setNewHourType] = useState<HourType | "">("");
  const [moveMode, setMoveMode] = useState(false);
  const [moveDay, setMoveDay] = useState<DayOfWeek | "">("");
  const [moveTimeSlotId, setMoveTimeSlotId] = useState<number | "">("");
  const [moveRoomId, setMoveRoomId] = useState<number | "">("");

  const inScope = (departmentId: number) => user?.role === "RECTOR" || departmentId === user?.headed_department_id;
  const newTeacherOptions = (teachers ?? []).filter((t2) => inScope(t2.department_id)).map((t2) => ({ value: t2.id, label: t2.full_name }));
  const newSubjectOptions = (subjects ?? [])
    .filter((s) => inScope(s.department_id))
    .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const newGroupOptions = (groups ?? []).filter((g) => inScope(g.department_id)).map((g) => ({ value: g.id, label: g.name }));
  const HOUR_TYPES: { value: HourType; label: string }[] = [
    { value: "LECTURE", label: t("hour_type.LECTURE") },
    { value: "PRACTICE", label: t("hour_type.PRACTICE") },
    { value: "LAB", label: t("hour_type.LAB") },
  ];

  const createMutation = useMutation({
    mutationFn: () =>
      scheduleApi.create({
        assignment_id: Number(assignmentId),
        room_id: Number(roomId),
        time_slot_id: dialog!.timeSlotId,
        day_of_week: dialog!.day,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar(t("schedule.added"));
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.add_failed"), t)),
  });

  const createAssignmentAndScheduleMutation = useMutation({
    mutationFn: async () => {
      const assignment = await assignmentsApi.create({
        teacher_id: Number(newTeacherId),
        subject_id: Number(newSubjectId),
        group_id: Number(newGroupId),
        semester_id: Number(effectiveSemesterId),
        hour_type: newHourType as HourType,
      });
      return scheduleApi.create({
        assignment_id: assignment.id,
        room_id: Number(roomId),
        time_slot_id: dialog!.timeSlotId,
        day_of_week: dialog!.day,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setSnackbar(t("schedule.added"));
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.add_failed"), t)),
  });

  const forceDeleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar(t("schedule.removed"));
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.remove_failed"), t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar(t("schedule.removed"));
      setDialog(null);
    },
    onError: async (err, entryId) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const ok = await confirm({
          message: t("schedule.force_remove_confirm"),
          destructive: true,
          confirmLabel: t("schedule.force_remove_confirm_label"),
        });
        if (ok) forceDeleteMutation.mutate(entryId);
        return;
      }
      setSnackbar(apiErrorMessage(err, t("schedule.remove_failed"), t));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      scheduleApi.update(dialog!.entry!.id, {
        day_of_week: Number(moveDay),
        time_slot_id: Number(moveTimeSlotId),
        room_id: Number(moveRoomId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar(t("schedule.moved"));
      setDialog(null);
      setMoveMode(false);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.move_failed"), t)),
  });

  async function handleAddExisting() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (!ok) return;
    createMutation.mutate();
  }

  async function handleAddNew() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (!ok) return;
    createAssignmentAndScheduleMutation.mutate();
  }

  async function handleRemoveEntry(entryId: number) {
    const ok = await confirm({ message: t("common.confirm_delete"), destructive: true, confirmLabel: t("common.remove") });
    if (!ok) return;
    deleteMutation.mutate(entryId);
  }

  function startMove(entry: ScheduleEntry) {
    setMoveDay(entry.day_of_week);
    setMoveTimeSlotId(entry.time_slot_id);
    setMoveRoomId(entry.room_id);
    setMoveMode(true);
  }

  async function handleSaveMove() {
    const ok = await confirm({ message: t("common.confirm_save") });
    if (!ok) return;
    updateMutation.mutate();
  }

  function openCell(day: DayOfWeek, timeSlotId: number, entry: ScheduleEntry | null) {
    setDialog({ day, timeSlotId, entry });
    setAssignmentId("");
    setRoomId("");
    setCreateMode("existing");
    setNewTeacherId("");
    setNewSubjectId("");
    setNewGroupId("");
    setNewHourType("");
    setMoveMode(false);
  }

  function describeEntry(entry: ScheduleEntry) {
    const assignment = assignments?.find((a) => a.id === entry.assignment_id);
    const subjectName = assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : "";
    const teacherName = nameById(teachers, entry.teacher_id, (t2) => t2.full_name);
    const groupName = nameById(groups, entry.group_id, (g) => g.name);
    const roomName = nameById(rooms, entry.room_id, (r) => r.name);
    return { subjectName, teacherName, groupName, roomName };
  }

  const sortedSlots = [...(timeSlots ?? [])].sort((a, b) => a.order - b.order);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ mr: 2, fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          {t("schedule.title")}
        </Typography>
        <TextField
          select
          size="small"
          label={t("common.select_semester")}
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
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
        {user?.role !== "TEACHER" && (
          <TextField
            select
            size="small"
            label={t("common.group_filter")}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">{t("common.all_groups")}</MenuItem>
            {(groups ?? [])
              .filter((g) => user?.role === "RECTOR" || g.department_id === user?.headed_department_id)
              .map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
          </TextField>
        )}
      </Box>

      {!effectiveSemesterId && user?.role !== "TEACHER" && <Alert severity="info">{t("common.pick_semester")}</Alert>}

      {(effectiveSemesterId || user?.role === "TEACHER") && sortedSlots.length === 0 && (
        <Alert severity="warning">{t("schedule.no_timeslots")}</Alert>
      )}

      {(effectiveSemesterId || user?.role === "TEACHER") && sortedSlots.length > 0 && (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{t("schedule.period")}</TableCell>
                {DAYS.map((d) => (
                  <TableCell key={d.value} align="center" sx={{ whiteSpace: "nowrap" }}>
                    {d.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSlots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <strong>{slot.order}</strong>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                    </Typography>
                  </TableCell>
                  {DAYS.map((d) => {
                    const cellEntries = entriesByCell.get(`${d.value}-${slot.id}`) ?? [];
                    return (
                      <TableCell
                        key={d.value}
                        align="center"
                        sx={{
                          cursor: canWrite ? "pointer" : "default",
                          minWidth: 130,
                          verticalAlign: "top",
                          bgcolor: cellEntries.length && !showAllGroups ? "action.hover" : undefined,
                          "&:hover": canWrite ? { bgcolor: "action.selected" } : undefined,
                        }}
                        onClick={() => {
                          if (!canWrite) return; // viewers only ever open an entry, handled per-block below
                          openCell(d.value, slot.id, null);
                        }}
                      >
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "stretch" }}>
                          {cellEntries.map((entry) => {
                            const info = describeEntry(entry);
                            const color = showAllGroups ? groupColorById.get(entry.group_id) : undefined;
                            return (
                              <Box
                                key={entry.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCell(d.value, slot.id, entry);
                                }}
                                sx={{
                                  textAlign: "left",
                                  cursor: "pointer",
                                  borderRadius: 1,
                                  px: 0.75,
                                  py: 0.5,
                                  borderLeft: color ? `3px solid ${color}` : undefined,
                                  bgcolor: color ? alpha(color, 0.1) : undefined,
                                  "&:hover": { bgcolor: color ? alpha(color, 0.18) : "action.selected" },
                                }}
                              >
                                <Typography variant="body2">{info.subjectName}</Typography>
                                {user?.role !== "TEACHER" && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                    {info.teacherName}
                                  </Typography>
                                )}
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                                  {showAllGroups && (
                                    <Chip
                                      size="small"
                                      label={info.groupName}
                                      sx={color ? { bgcolor: color, color: "#fff" } : undefined}
                                    />
                                  )}
                                  <Chip size="small" variant="outlined" label={info.roomName} />
                                </Box>
                              </Box>
                            );
                          })}
                          {canWrite && (
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              sx={{ textAlign: "center", py: cellEntries.length ? 0 : undefined }}
                            >
                              {t("schedule.add_hint")}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          {dialog?.entry ? t("schedule.entry_title") : t("schedule.add_title")} —{" "}
          {DAYS.find((d) => d.value === dialog?.day)?.label}, {sortedSlots.find((s) => s.id === dialog?.timeSlotId)?.order}
          {t("schedule.period_label")}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {dialog?.entry && moveMode ? (
            <>
              <TextField
                select
                size="small"
                label={t("schedule.move_day")}
                value={moveDay}
                onChange={(e) => setMoveDay(Number(e.target.value) as DayOfWeek)}
              >
                {DAYS.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t("schedule.move_timeslot")}
                value={moveTimeSlotId}
                onChange={(e) => setMoveTimeSlotId(Number(e.target.value))}
              >
                {sortedSlots.map((slot) => (
                  <MenuItem key={slot.id} value={slot.id}>
                    {slot.order} — {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                  </MenuItem>
                ))}
              </TextField>
              {(() => {
                const roomOptions = (rooms ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.building})` }));
                const selectedRoom = roomOptions.find((opt) => opt.value === moveRoomId) ?? null;
                return (
                  <Autocomplete
                    options={roomOptions}
                    value={selectedRoom}
                    isOptionEqualToValue={(opt, val) => opt.value === val.value}
                    getOptionLabel={(opt) => opt.label}
                    onChange={(_e, newValue) => setMoveRoomId(newValue ? newValue.value : "")}
                    renderInput={(params) => <TextField {...params} label={t("schedule.pick_room")} required />}
                  />
                );
              })()}
            </>
          ) : dialog?.entry ? (
            (() => {
              const info = describeEntry(dialog.entry);
              const dept = teachers?.find((t2) => t2.id === dialog.entry!.teacher_id)?.department_id;
              return (
                <Box>
                  <Typography>
                    {t("schedule.field_subject")} {info.subjectName}
                  </Typography>
                  <Typography>
                    {t("schedule.field_teacher")} {info.teacherName}
                  </Typography>
                  <Typography>
                    {t("schedule.field_group")} {info.groupName}
                  </Typography>
                  <Typography>
                    {t("schedule.field_room")} {info.roomName}
                  </Typography>
                  {dept !== undefined && (
                    <Typography color="text.secondary">
                      {t("schedule.field_department")} {nameById(departments, dept, (d) => d.name)}
                    </Typography>
                  )}
                </Box>
              );
            })()
          ) : (
            <>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={createMode}
                onChange={(_e, value) => value && setCreateMode(value)}
                sx={{ alignSelf: "flex-start" }}
              >
                <ToggleButton value="existing">{t("schedule.mode_existing")}</ToggleButton>
                <ToggleButton value="new">{t("schedule.mode_new")}</ToggleButton>
              </ToggleButtonGroup>

              {createMode === "existing" ? (
                (() => {
                  const assignmentOptions = (assignments ?? []).map((a) => ({
                    value: a.id,
                    label: `${nameById(teachers, a.teacher_id, (t2) => t2.full_name)} — ${nameById(subjects, a.subject_id, (s) => s.name)} — ${nameById(groups, a.group_id, (g) => g.name)} (${t(`hour_type.${a.hour_type}`)})`,
                  }));
                  const selectedAssignment = assignmentOptions.find((opt) => opt.value === assignmentId) ?? null;
                  return (
                    <Autocomplete
                      options={assignmentOptions}
                      value={selectedAssignment}
                      isOptionEqualToValue={(opt, val) => opt.value === val.value}
                      getOptionLabel={(opt) => opt.label}
                      onChange={(_e, newValue) => setAssignmentId(newValue ? newValue.value : "")}
                      renderInput={(params) => (
                        <TextField {...params} label={t("schedule.pick_assignment")} required helperText={t("schedule.pick_assignment_hint")} />
                      )}
                    />
                  );
                })()
              ) : (
                <>
                  <TextField
                    select
                    label={t("assignments.field_teacher")}
                    value={newTeacherId}
                    onChange={(e) => setNewTeacherId(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                  >
                    {newTeacherOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={t("assignments.field_subject")}
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                  >
                    {newSubjectOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={t("assignments.field_group")}
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                  >
                    {newGroupOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={t("assignments.field_type")}
                    value={newHourType}
                    onChange={(e) => setNewHourType(e.target.value as HourType)}
                    required
                  >
                    {HOUR_TYPES.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}

              {(() => {
                const roomOptions = (rooms ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.building})` }));
                const selectedRoom = roomOptions.find((opt) => opt.value === roomId) ?? null;
                return (
                  <Autocomplete
                    options={roomOptions}
                    value={selectedRoom}
                    isOptionEqualToValue={(opt, val) => opt.value === val.value}
                    getOptionLabel={(opt) => opt.label}
                    onChange={(_e, newValue) => setRoomId(newValue ? newValue.value : "")}
                    renderInput={(params) => <TextField {...params} label={t("schedule.pick_room")} required />}
                  />
                );
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {dialog?.entry && moveMode ? (
            <>
              <Button onClick={() => setMoveMode(false)}>{t("common.cancel")}</Button>
              <Button
                variant="contained"
                disabled={!moveDay || !moveTimeSlotId || !moveRoomId || updateMutation.isPending}
                onClick={() => handleSaveMove()}
              >
                {t("schedule.move_save")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setDialog(null)}>{t("common.close")}</Button>
              {dialog?.entry && canWrite && (
                <>
                  <Button onClick={() => startMove(dialog.entry!)}>{t("schedule.move")}</Button>
                  <Button
                    color="error"
                    disabled={deleteMutation.isPending || forceDeleteMutation.isPending}
                    onClick={() => handleRemoveEntry(dialog.entry!.id)}
                  >
                    {t("common.remove")}
                  </Button>
                </>
              )}
            </>
          )}
          {!dialog?.entry && canWrite && createMode === "existing" && (
            <Button
              variant="contained"
              disabled={!assignmentId || !roomId || createMutation.isPending}
              onClick={() => handleAddExisting()}
            >
              {t("common.add")}
            </Button>
          )}
          {!dialog?.entry && canWrite && createMode === "new" && (
            <Button
              variant="contained"
              disabled={
                !newTeacherId ||
                !newSubjectId ||
                !newGroupId ||
                !newHourType ||
                !roomId ||
                createAssignmentAndScheduleMutation.isPending
              }
              onClick={() => handleAddNew()}
            >
              {t("common.add")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
