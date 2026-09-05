import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, scheduleApi } from "../../api/entities";
import type { DayOfWeek, ScheduleEntry } from "../../api/types";
import Button from "../../components/ui/Button";
import { WarningBanner } from "../../components/ui/Banner";
import { Field, SelectInput } from "../../components/ui/Field";
import Overlay from "../../components/ui/Overlay";
import TimetableGrid from "../../components/TimetableGrid";
import { useAuth } from "../../context/AuthContext";
import { gridDays } from "../../lib/days";
import { apiErrorMessage } from "../../lib/errors";
import {
  nameById,
  useActiveSemester,
  useGroups,
  useRooms,
  useSubjects,
  useTeachers,
  useTimeSlots,
} from "../../hooks/useReferenceData";

export default function DeanSchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const departmentId = user?.headed_department_id ?? null;
  const { activeSemester } = useActiveSemester();

  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: rooms } = useRooms();
  const { data: slots } = useTimeSlots();

  const { data: assignments } = useQuery({
    queryKey: ["assignments", activeSemester?.id],
    queryFn: () => assignmentsApi.list(activeSemester ? { semester_id: activeSemester.id } : undefined),
    enabled: Boolean(activeSemester),
  });
  const { data: entries } = useQuery({
    queryKey: ["schedule", activeSemester?.id],
    queryFn: () => scheduleApi.list(activeSemester ? { semester_id: activeSemester.id } : undefined),
    enabled: Boolean(activeSemester),
  });

  const myTeacherIds = new Set((teachers ?? []).filter((tch) => tch.department_id === departmentId).map((t2) => t2.id));
  const myAssignments = (assignments ?? []).filter((a) => myTeacherIds.has(a.teacher_id));
  const myEntries = (entries ?? []).filter((e) => myTeacherIds.has(e.teacher_id));

  const sortedSlots = useMemo(() => [...(slots ?? [])].sort((a, b) => a.order - b.order), [slots]);
  const days = gridDays(t);

  const [cell, setCell] = useState<{ day: DayOfWeek; slotId: number } | null>(null);
  const [pickAssignmentId, setPickAssignmentId] = useState<number | "">("");
  const [pickRoomId, setPickRoomId] = useState<number | "">("");
  const [gridWarn, setGridWarn] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      scheduleApi.create({
        assignment_id: Number(pickAssignmentId),
        room_id: Number(pickRoomId),
        time_slot_id: cell!.slotId,
        day_of_week: cell!.day,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setCell(null);
      setPickAssignmentId("");
      setPickRoomId("");
    },
    onError: (err) => {
      setGridWarn(resolveConflictMessage(err));
      setCell(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      setCell(null);
    },
  });

  function resolveConflictMessage(err: unknown): string {
    const detail = apiErrorMessage(err, "");
    const lower = detail.toLowerCase();
    const teacherName = nameById(teachers, assignmentTeacherId(), (x) => x.full_name);
    const groupName = nameById(groups, assignmentGroupId(), (x) => x.name);
    const roomName = nameById(rooms, Number(pickRoomId), (x) => x.name);
    if (lower.includes("teacher")) return `${t("dean.conflict_teacher")} ${teacherName}`;
    if (lower.includes("room")) return `${t("dean.conflict_room")} ${roomName}`;
    if (lower.includes("group")) return `${t("dean.conflict_group")} ${groupName}`;
    return detail || "Error";
  }

  function assignmentTeacherId(): number {
    return myAssignments.find((a) => a.id === pickAssignmentId)?.teacher_id ?? 0;
  }
  function assignmentGroupId(): number {
    return myAssignments.find((a) => a.id === pickAssignmentId)?.group_id ?? 0;
  }

  function entriesAt(day: number, slotId: number): ScheduleEntry[] {
    return myEntries.filter((e) => e.day_of_week === day && e.time_slot_id === slotId);
  }

  function checkClientSideConflict(day: DayOfWeek, slotId: number, assignmentId: number): string | null {
    const assignment = myAssignments.find((a) => a.id === assignmentId);
    if (!assignment) return null;
    const clashes = (entries ?? []).filter((e) => e.day_of_week === day && e.time_slot_id === slotId);
    const teacherClash = clashes.find((e) => e.teacher_id === assignment.teacher_id);
    if (teacherClash) return `${t("dean.conflict_teacher")} ${nameById(teachers, assignment.teacher_id, (x) => x.full_name)}`;
    const groupClash = clashes.find((e) => e.group_id === assignment.group_id);
    if (groupClash) return `${t("dean.conflict_group")} ${nameById(groups, assignment.group_id, (x) => x.name)}`;
    if (pickRoomId) {
      const roomClash = clashes.find((e) => e.room_id === Number(pickRoomId));
      if (roomClash) return `${t("dean.conflict_room")} ${nameById(rooms, Number(pickRoomId), (x) => x.name)}`;
    }
    return null;
  }

  function handlePlace() {
    if (!cell || !pickAssignmentId || !pickRoomId) return;
    const clientConflict = checkClientSideConflict(cell.day, cell.slotId, Number(pickAssignmentId));
    if (clientConflict) {
      setGridWarn(clientConflict);
      setCell(null);
      return;
    }
    createMutation.mutate();
  }

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 600, marginBottom: 4 }}>{t("dean.schedule_title")}</h1>
      {activeSemester && (
        <p style={{ fontSize: 13.5, color: "var(--color-neutral-700)", marginBottom: 20 }}>{activeSemester.name}</p>
      )}

      {gridWarn && (
        <div style={{ marginBottom: 16 }}>
          <WarningBanner>{gridWarn}</WarningBanner>
        </div>
      )}

      {sortedSlots.length > 0 && (
        <TimetableGrid
          variant="builder"
          days={days}
          slots={sortedSlots}
          renderCell={(day, slotId) => {
            const cellEntries = entriesAt(day, slotId);
            if (cellEntries.length === 0) return null;
            return (
              <span style={{ fontSize: 10.5, lineHeight: 1.3 }}>
                {cellEntries.map((e) => {
                  const assignment = myAssignments.find((a) => a.id === e.assignment_id);
                  return (
                    <span key={e.id} style={{ display: "block" }}>
                      {assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : ""} ·{" "}
                      {nameById(groups, e.group_id, (g) => g.name)}
                    </span>
                  );
                })}
              </span>
            );
          }}
          onCellClick={(day, slotId) => {
            setGridWarn(null);
            setCell({ day: day as DayOfWeek, slotId });
            setPickAssignmentId("");
            setPickRoomId("");
          }}
        />
      )}

      <Overlay open={Boolean(cell)} onClose={() => setCell(null)} variant="dialog">
        {cell && (
          <>
            <div className="kicker">
              {t(`days_full.${cell.day}`)} · {sortedSlots.find((s) => s.id === cell.slotId)?.order}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "6px 0 20px" }}>{t("dean.pick_assignment")}</h2>

            {entriesAt(cell.day, cell.slotId).map((e) => {
              const assignment = myAssignments.find((a) => a.id === e.assignment_id);
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-hairline)",
                    fontSize: 14,
                  }}
                >
                  <span>
                    {assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : ""} ·{" "}
                    {nameById(groups, e.group_id, (g) => g.name)} · {nameById(rooms, e.room_id, (r) => r.name)}
                  </span>
                  <button className="text-btn" onClick={() => removeMutation.mutate(e.id)}>
                    {t("dean.clear")}
                  </button>
                </div>
              );
            })}

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {myAssignments.length === 0 ? (
                <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>{t("dean.no_assignments")}</p>
              ) : (
                <>
                  <Field label={t("dean.select_teacher")}>
                    <SelectInput
                      value={pickAssignmentId}
                      onChange={(e) => setPickAssignmentId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">—</option>
                      {myAssignments.map((a) => {
                        const label = `${nameById(teachers, a.teacher_id, (x) => x.full_name)} — ${nameById(
                          subjects,
                          a.subject_id,
                          (x) => x.name,
                        )} — ${nameById(groups, a.group_id, (x) => x.name)} (${t(`hour_type.${a.hour_type}`)})`;
                        return (
                          <option key={a.id} value={a.id}>
                            {label}
                          </option>
                        );
                      })}
                    </SelectInput>
                  </Field>
                  <Field label={t("dean.pick_room")}>
                    <SelectInput value={pickRoomId} onChange={(e) => setPickRoomId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">—</option>
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Button
                    variant="primary"
                    disabled={!pickAssignmentId || !pickRoomId || createMutation.isPending}
                    onClick={handlePlace}
                  >
                    {t("dean.assign")}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Overlay>
    </div>
  );
}
