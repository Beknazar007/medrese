import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, dashboardApi, scheduleApi, type GroupCoverage } from "../../api/entities";
import type { Department, Subject, TeacherWorkload } from "../../api/types";
import TimetableGrid from "../../components/TimetableGrid";
import { gridDays } from "../../lib/days";
import {
  nameById,
  useActiveSemester,
  useDepartments,
  useGroups,
  useRooms,
  useSubjects,
  useTeachers,
  useTimeSlots,
} from "../../hooks/useReferenceData";

type View = "rector" | "teacher";

export default function RectorDashboardPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("rector");
  const { activeSemester } = useActiveSemester();
  const { data: departments } = useDepartments();

  const { data: workload } = useQuery({
    queryKey: ["dashboard-workload", activeSemester?.id],
    queryFn: () => dashboardApi.workload(activeSemester!.id),
    enabled: Boolean(activeSemester),
  });
  const { data: unassigned } = useQuery({
    queryKey: ["dashboard-unassigned", activeSemester?.id],
    queryFn: () => dashboardApi.unassignedSubjects(activeSemester!.id),
    enabled: Boolean(activeSemester),
  });
  const { data: coverage } = useQuery({
    queryKey: ["dashboard-coverage", activeSemester?.id],
    queryFn: () => dashboardApi.groupCoverage(activeSemester!.id),
    enabled: Boolean(activeSemester),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>{t("app_title")}</div>
        <div style={{ display: "flex", gap: 20 }}>
          <button
            className="text-btn"
            style={{ color: view === "rector" ? "var(--color-text)" : "var(--color-neutral-600)", fontWeight: view === "rector" ? 600 : 400 }}
            onClick={() => setView("rector")}
          >
            {t("nav.rector_view")}
          </button>
          <button
            className="text-btn"
            style={{ color: view === "teacher" ? "var(--color-text)" : "var(--color-neutral-600)", fontWeight: view === "teacher" ? 600 : 400 }}
            onClick={() => setView("teacher")}
          >
            {t("nav.teacher_view")}
          </button>
        </div>
      </div>

      {!activeSemester && <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>{t("rector.pick_semester")}</p>}

      {activeSemester && view === "rector" && (
        <RectorWorkloadView
          workload={workload ?? []}
          unassigned={unassigned ?? []}
          coverage={coverage ?? []}
          departments={departments ?? []}
        />
      )}

      {activeSemester && view === "teacher" && <TeacherReadOnlyView semesterId={activeSemester.id} />}
    </div>
  );
}

function RectorWorkloadView({
  workload,
  unassigned,
  coverage,
  departments,
}: {
  workload: TeacherWorkload[];
  unassigned: Subject[];
  coverage: GroupCoverage[];
  departments: Department[];
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h1 style={{ fontSize: 36, fontWeight: 600, margin: "12px 0 4px" }}>{t("rector.dashboard_title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 64, marginTop: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("rector.col_teacher")}</th>
              <th>{t("rector.col_department")}</th>
              <th style={{ textAlign: "right" }}>{t("rector.col_weekly")}</th>
              <th style={{ textAlign: "right" }}>{t("rector.col_term")}</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((row) => (
              <tr key={row.teacher_id}>
                <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                <td style={{ color: "var(--color-neutral-700)", fontSize: 13.5 }}>
                  {nameById(departments, row.department_id, (d) => d.name)}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--color-accent-700)" }}>
                  {row.weekly_scheduled_periods}
                </td>
                <td style={{ textAlign: "right", color: "var(--color-neutral-700)" }}>{row.assignment_count}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t("rector.unassigned_title")}</h3>
          {unassigned.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--color-neutral-500)", fontStyle: "italic" }}>
              {t("rector.all_subjects_assigned")}
            </p>
          )}
          {unassigned.map((s) => (
            <div key={s.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-accent-2-700)" }}>{s.code}</div>
            </div>
          ))}

          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "24px 0 10px" }}>{t("rector.coverage_title")}</h3>
          {coverage.filter((c) => c.coverage_percent < 100).length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--color-neutral-500)", fontStyle: "italic" }}>
              {t("rector.coverage_all_done")}
            </p>
          )}
          {coverage
            .filter((c) => c.coverage_percent < 100)
            .map((c) => (
              <div key={c.group_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                <span>{c.group_name}</span>
                <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>{c.coverage_percent}%</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function TeacherReadOnlyView({ semesterId }: { semesterId: number }) {
  const { t } = useTranslation();
  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: rooms } = useRooms();
  const { data: slots } = useTimeSlots();
  const [teacherId, setTeacherId] = useState<number | "">("");

  const { data: entries } = useQuery({
    queryKey: ["schedule", "teacher-view", teacherId, semesterId],
    queryFn: () => scheduleApi.list({ semester_id: semesterId }),
    enabled: Boolean(teacherId),
  });
  const { data: assignments } = useQuery({
    queryKey: ["assignments", "teacher-view", semesterId],
    queryFn: () => assignmentsApi.list({ semester_id: semesterId }),
  });

  const sortedSlots = useMemo(() => [...(slots ?? [])].sort((a, b) => a.order - b.order), [slots]);
  const days = gridDays(t);
  const myEntries = (entries ?? []).filter((e) => e.teacher_id === teacherId);

  return (
    <div>
      <select
        className="select"
        style={{ maxWidth: 320, marginBottom: 20 }}
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}
      >
        <option value="">—</option>
        {(teachers ?? []).map((tch) => (
          <option key={tch.id} value={tch.id}>
            {tch.full_name}
          </option>
        ))}
      </select>

      {teacherId && sortedSlots.length > 0 && (
        <TimetableGrid
          variant="desktop"
          days={days}
          slots={sortedSlots}
          renderCell={(day, slotId) => {
            const entry = myEntries.find((e) => e.day_of_week === day && e.time_slot_id === slotId);
            if (!entry) return null;
            const assignment = assignments?.find((a) => a.id === entry.assignment_id);
            return (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                  {nameById(groups, entry.group_id, (g) => g.name)} · {nameById(rooms, entry.room_id, (r) => r.name)}
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
