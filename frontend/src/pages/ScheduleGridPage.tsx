import {
  Alert,
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
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { assignmentsApi, roomsApi, scheduleApi } from "../api/entities";
import type { DayOfWeek, ScheduleEntry } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../lib/errors";
import { nameById, useDepartments, useGroups, useSemesters, useSubjects, useTeachers, useTimeSlots } from "../hooks/useReferenceData";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export default function ScheduleGridPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const queryClient = useQueryClient();

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
    const map = new Map<string, ScheduleEntry>();
    for (const e of entries ?? []) map.set(`${e.day_of_week}-${e.time_slot_id}`, e);
    return map;
  }, [entries]);

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
      setSnackbar("Added to timetable");
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, "Could not add — check conflicts")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setSnackbar("Removed");
      setDialog(null);
    },
    onError: (err) => setSnackbar(apiErrorMessage(err, "Could not remove")),
  });

  function openCell(day: DayOfWeek, timeSlotId: number, entry: ScheduleEntry | null) {
    setDialog({ day, timeSlotId, entry });
    setAssignmentId("");
    setRoomId("");
  }

  function describeEntry(entry: ScheduleEntry) {
    const assignment = assignments?.find((a) => a.id === entry.assignment_id);
    const subjectName = assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : "";
    const teacherName = nameById(teachers, entry.teacher_id, (t) => t.full_name);
    const groupName = nameById(groups, entry.group_id, (g) => g.name);
    const roomName = nameById(rooms, entry.room_id, (r) => r.name);
    return { subjectName, teacherName, groupName, roomName };
  }

  const sortedSlots = [...(timeSlots ?? [])].sort((a, b) => a.order - b.order);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ mr: 2 }}>
          Schedule
        </Typography>
        <TextField
          select
          size="small"
          label="Semester"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{activeSemester ? `Active: ${activeSemester.name}` : "Select a semester"}</MenuItem>
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
            label="Group filter"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All groups</MenuItem>
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

      {!effectiveSemesterId && user?.role !== "TEACHER" && (
        <Alert severity="info">Pick a semester to view or build its timetable.</Alert>
      )}

      {(effectiveSemesterId || user?.role === "TEACHER") && sortedSlots.length === 0 && (
        <Alert severity="warning">No time slots defined yet — ask the Rector to add periods first.</Alert>
      )}

      {(effectiveSemesterId || user?.role === "TEACHER") && sortedSlots.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                {DAYS.map((d) => (
                  <TableCell key={d.value} align="center">
                    {d.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSlots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell>
                    <strong>{slot.order}</strong>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                    </Typography>
                  </TableCell>
                  {DAYS.map((d) => {
                    const entry = entriesByCell.get(`${d.value}-${slot.id}`);
                    return (
                      <TableCell
                        key={d.value}
                        align="center"
                        sx={{
                          cursor: canWrite ? "pointer" : entry ? "default" : "default",
                          minWidth: 130,
                          bgcolor: entry ? "action.hover" : undefined,
                          "&:hover": canWrite ? { bgcolor: "action.selected" } : undefined,
                        }}
                        onClick={() => {
                          if (!entry && !canWrite) return; // nothing to view, and this viewer can't add one
                          openCell(d.value, slot.id, entry ?? null);
                        }}
                      >
                        {entry ? (
                          <Box>
                            <Typography variant="body2">{describeEntry(entry).subjectName}</Typography>
                            {user?.role !== "TEACHER" && (
                              <Typography variant="caption" sx={{ display: "block" }}>
                                {describeEntry(entry).teacherName}
                              </Typography>
                            )}
                            <Chip size="small" label={describeEntry(entry).groupName} sx={{ mt: 0.5, mr: 0.5 }} />
                            <Chip size="small" variant="outlined" label={describeEntry(entry).roomName} sx={{ mt: 0.5 }} />
                          </Box>
                        ) : (
                          canWrite && (
                            <Typography variant="caption" color="text.disabled">
                              + add
                            </Typography>
                          )
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialog?.entry ? "Schedule entry" : "Add to timetable"} — {DAYS.find((d) => d.value === dialog?.day)?.label}
          , period {sortedSlots.find((s) => s.id === dialog?.timeSlotId)?.order}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {dialog?.entry ? (
            (() => {
              const info = describeEntry(dialog.entry);
              const dept = teachers?.find((t) => t.id === dialog.entry!.teacher_id)?.department_id;
              return (
                <Box>
                  <Typography>Subject: {info.subjectName}</Typography>
                  <Typography>Teacher: {info.teacherName}</Typography>
                  <Typography>Group: {info.groupName}</Typography>
                  <Typography>Room: {info.roomName}</Typography>
                  {dept !== undefined && (
                    <Typography color="text.secondary">
                      Department: {nameById(departments, dept, (d) => d.name)}
                    </Typography>
                  )}
                </Box>
              );
            })()
          ) : (
            <>
              <TextField
                select
                label="Teaching assignment"
                value={assignmentId}
                onChange={(e) => setAssignmentId(Number(e.target.value))}
                required
                helperText="Teacher + subject + group for this semester"
              >
                {(assignments ?? []).map((a) => {
                  const teacherName = nameById(teachers, a.teacher_id, (t) => t.full_name);
                  const subjectName = nameById(subjects, a.subject_id, (s) => s.name);
                  const groupName = nameById(groups, a.group_id, (g) => g.name);
                  return (
                    <MenuItem key={a.id} value={a.id}>
                      {teacherName} — {subjectName} — {groupName} ({a.hour_type})
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                select
                label="Room"
                value={roomId}
                onChange={(e) => setRoomId(Number(e.target.value))}
                required
              >
                {(rooms ?? []).map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name} ({r.building})
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Close</Button>
          {dialog?.entry && canWrite && (
            <Button color="error" onClick={() => deleteMutation.mutate(dialog.entry!.id)}>
              Remove
            </Button>
          )}
          {!dialog?.entry && canWrite && (
            <Button
              variant="contained"
              disabled={!assignmentId || !roomId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Add
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

