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
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, roomsApi, scheduleApi } from "../api/entities";
import type { DayOfWeek, ScheduleEntry } from "../api/types";
import { useAuth } from "../context/AuthContext";
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
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.add_failed"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar(t("schedule.removed"));
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, t("schedule.remove_failed"))),
  });

  function openCell(day: DayOfWeek, timeSlotId: number, entry: ScheduleEntry | null) {
    setDialog({ day, timeSlotId, entry });
    setAssignmentId("");
    setRoomId("");
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
          {dialog?.entry ? (
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
              {(() => {
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
              })()}
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
          <Button onClick={() => setDialog(null)}>{t("common.close")}</Button>
          {dialog?.entry && canWrite && (
            <Button color="error" onClick={() => deleteMutation.mutate(dialog.entry!.id)}>
              {t("common.remove")}
            </Button>
          )}
          {!dialog?.entry && canWrite && (
            <Button
              variant="contained"
              disabled={!assignmentId || !roomId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
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
