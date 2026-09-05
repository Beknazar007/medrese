import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi, scheduleApi, teachersApi } from "../../api/entities";
import type { ScheduleEntry } from "../../api/types";
import TimetableGrid from "../../components/TimetableGrid";
import { useAuth } from "../../context/AuthContext";
import { gridDays, todayAsDayOfWeek } from "../../lib/days";
import {
  nameById,
  useActiveSemester,
  useDepartments,
  useGroups,
  useRooms,
  useSubjects,
  useTimeSlots,
} from "../../hooks/useReferenceData";
import ClassDetailSheet from "./ClassDetailSheet";

type Tab = "week" | "subjects" | "profile";

export default function TeacherAppPage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("week");
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);

  const { data: me } = useQuery({ queryKey: ["teachers", "me"], queryFn: () => teachersApi.me() });
  const { activeSemester } = useActiveSemester();
  const { data: departments } = useDepartments();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: rooms } = useRooms();
  const { data: slots } = useTimeSlots();

  const { data: assignments } = useQuery({
    queryKey: ["assignments", "mine", activeSemester?.id],
    queryFn: () => assignmentsApi.list(activeSemester ? { semester_id: activeSemester.id } : undefined),
    enabled: Boolean(activeSemester),
  });

  const { data: entries } = useQuery({
    queryKey: ["schedule", "mine", activeSemester?.id],
    queryFn: () => scheduleApi.list(activeSemester ? { semester_id: activeSemester.id } : undefined),
    enabled: Boolean(activeSemester),
  });

  const sortedSlots = useMemo(() => [...(slots ?? [])].sort((a, b) => a.order - b.order), [slots]);
  const days = gridDays(t);
  const today = todayAsDayOfWeek();

  const weeklyHours = entries?.length ?? 0;
  const departmentName = me ? nameById(departments, me.department_id, (d) => d.name) : "";

  function entryAt(day: number, slotId: number) {
    return entries?.find((e) => e.day_of_week === day && e.time_slot_id === slotId) ?? null;
  }

  const todayEntries = (entries ?? [])
    .filter((e) => e.day_of_week === today)
    .slice()
    .sort((a, b) => {
      const sa = sortedSlots.find((s) => s.id === a.time_slot_id)?.order ?? 0;
      const sb = sortedSlots.find((s) => s.id === b.time_slot_id)?.order ?? 0;
      return sa - sb;
    });

  const selectedAssignment = selectedEntry
    ? assignments?.find((a) => a.id === selectedEntry.assignment_id)
    : undefined;

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <div style={{ padding: "24px 20px 0", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "baseline",
            fontSize: 12,
            color: "var(--color-neutral-600)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              style={{ border: "none", background: "none", fontFamily: "inherit", fontSize: 12 }}
            >
              <option value="ky">KY</option>
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
            <button className="text-btn" onClick={logout}>
              {t("nav.logout")}
            </button>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 600, margin: "8px 0 2px" }}>{me?.full_name ?? user?.username}</h1>
        <p style={{ fontSize: 13.5, color: "var(--color-neutral-700)", margin: "0 0 24px" }}>
          {departmentName} · {weeklyHours} {t("teacher.hours_per_week")}
        </p>

        {tab === "week" && (
          <div>
            {sortedSlots.length > 0 ? (
              <TimetableGrid
                variant="mobile"
                days={days}
                slots={sortedSlots}
                renderCell={(day, slotId) => {
                  const entry = entryAt(day, slotId);
                  if (!entry) return null;
                  return nameById(groups, entry.group_id, (g) => g.name);
                }}
                onCellClick={(day, slotId) => setSelectedEntry(entryAt(day, slotId))}
              />
            ) : (
              <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>{t("common.loading")}</p>
            )}

            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "28px 0 10px" }}>
              {t("teacher.today")} · {t(`days_full.${today}`)}
            </h2>
            {todayEntries.length === 0 && (
              <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>{t("teacher.no_classes_today")}</p>
            )}
            {todayEntries.map((entry) => {
              const assignment = assignments?.find((a) => a.id === entry.assignment_id);
              const slot = sortedSlots.find((s) => s.id === entry.time_slot_id);
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  style={{
                    display: "flex",
                    gap: 14,
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--color-hairline)",
                    background: "none",
                    border: "none",
                    borderBottomStyle: "solid",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <span style={{ width: 44, fontSize: 14, fontWeight: 600, color: "var(--color-accent-700)" }}>
                    {slot?.start_time.slice(0, 5)}
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 600 }}>
                      {assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : ""}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                      {nameById(groups, entry.group_id, (g) => g.name)} · {nameById(rooms, entry.room_id, (r) => r.name)}
                      -{t("teacher.room_label")} ·{" "}
                      {assignment ? t(`hour_type.${assignment.hour_type}`) : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "subjects" && (
          <div>
            {(() => {
              const mySubjectIds = Array.from(new Set((assignments ?? []).map((a) => a.subject_id)));
              if (mySubjectIds.length === 0) {
                return <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>—</p>;
              }
              return mySubjectIds.map((subjectId) => {
                const subject = subjects?.find((s) => s.id === subjectId);
                if (!subject) return null;
                const myGroups = Array.from(
                  new Set(
                    (assignments ?? [])
                      .filter((a) => a.subject_id === subjectId)
                      .map((a) => nameById(groups, a.group_id, (g) => g.name)),
                  ),
                );
                return (
                  <div key={subjectId} style={{ padding: "14px 0", borderBottom: "1px solid var(--color-hairline)" }}>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>{subject.name}</div>
                    <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                      {subject.code} · {myGroups.join(", ")}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--color-accent-700)", marginTop: 4 }}>
                      {subject.lecture_hours} {t("teacher.lecture_hours")} · {subject.practice_hours}{" "}
                      {t("teacher.practice_hours")} · {subject.lab_hours} {t("teacher.lab_hours")}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {tab === "profile" && me && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{me.full_name}</div>
            <div style={{ fontSize: 14, color: "var(--color-neutral-700)", marginBottom: 20 }}>
              {me.academic_degree ?? ""}
            </div>
            <ProfileRow label={t("teacher.phone")} value={me.phone ?? "—"} />
            <ProfileRow label={t("teacher.hire_date")} value={me.hire_date ?? "—"} />
            <ProfileRow label={t("teacher.weekly_load")} value={String(weeklyHours)} />
            <ProfileRow label={t("teacher.term_load")} value={String(assignments?.length ?? 0)} />
            <p style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--color-neutral-500)", marginTop: 14 }}>
              {t("teacher.profile_note")}
            </p>
          </div>
        )}
      </div>

      <nav className="tab-bar">
        <button className={`tab-bar-item${tab === "week" ? " active" : ""}`} onClick={() => setTab("week")}>
          {t("teacher.tab_week")}
        </button>
        <button className={`tab-bar-item${tab === "subjects" ? " active" : ""}`} onClick={() => setTab("subjects")}>
          {t("teacher.tab_subjects")}
        </button>
        <button className={`tab-bar-item${tab === "profile" ? " active" : ""}`} onClick={() => setTab("profile")}>
          {t("teacher.tab_profile")}
        </button>
      </nav>

      <ClassDetailSheet entry={selectedEntry} assignment={selectedAssignment} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--color-hairline)",
        fontSize: 14.5,
      }}
    >
      <span style={{ color: "var(--color-neutral-600)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
