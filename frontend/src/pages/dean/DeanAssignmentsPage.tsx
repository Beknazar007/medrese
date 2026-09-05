import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi } from "../../api/entities";
import type { HourType } from "../../api/types";
import Button from "../../components/ui/Button";
import { WarningBanner } from "../../components/ui/Banner";
import { Field, SelectInput } from "../../components/ui/Field";
import Segmented from "../../components/ui/Segmented";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../lib/errors";
import { termHoursForTeacher } from "../../lib/hours";
import { nameById, useActiveSemester, useGroups, useSubjects, useTeachers } from "../../hooks/useReferenceData";

const HOUR_TYPES: HourType[] = ["LECTURE", "PRACTICE", "LAB"];

export default function DeanAssignmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const departmentId = user?.headed_department_id ?? null;
  const { activeSemester } = useActiveSemester();

  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: assignments } = useQuery({ queryKey: ["assignments"], queryFn: () => assignmentsApi.list() });

  const myTeachers = (teachers ?? []).filter((tch) => tch.department_id === departmentId);
  const mySubjects = (subjects ?? []).filter((s) => s.department_id === departmentId);
  const myGroups = (groups ?? []).filter((g) => g.department_id === departmentId);
  const myAssignments = (assignments ?? []).filter((a) => myTeachers.some((tch) => tch.id === a.teacher_id));

  const [teacherId, setTeacherId] = useState<number | "">("");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [groupId, setGroupId] = useState<number | "">("");
  const [hourType, setHourType] = useState<HourType>("LECTURE");
  const [warning, setWarning] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (semesterId: number) =>
      assignmentsApi.create({
        teacher_id: Number(teacherId),
        subject_id: Number(subjectId),
        group_id: Number(groupId),
        semester_id: semesterId,
        hour_type: hourType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setWarning(null);
    },
    onError: (err) => setWarning(apiErrorMessage(err, "Error")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assignments"] }),
  });

  function handleAssign() {
    if (!teacherId || !subjectId || !groupId || !activeSemester) return;

    const duplicate = myAssignments.find(
      (a) =>
        a.teacher_id === teacherId &&
        a.subject_id === subjectId &&
        a.group_id === groupId &&
        a.hour_type === hourType,
    );
    if (duplicate) {
      const subjectName = nameById(subjects, Number(subjectId), (s) => s.name);
      const groupName = nameById(groups, Number(groupId), (g) => g.name);
      setWarning(`${t("dean.duplicate_assignment")} ${subjectName} · ${groupName} · ${t(`hour_type.${hourType}`)}`);
      return;
    }

    createMutation.mutate(activeSemester.id);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 48 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 600, marginBottom: 20 }}>{t("dean.assignments_title")}</h1>

        {myAssignments.length === 0 && (
          <p style={{ fontStyle: "italic", color: "var(--color-neutral-500)" }}>{t("dean.no_assignments")}</p>
        )}

        {myAssignments.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--color-hairline)",
            }}
          >
            <span style={{ fontSize: 15 }}>
              {nameById(teachers, a.teacher_id, (x) => x.full_name)} —{" "}
              {nameById(subjects, a.subject_id, (x) => x.name)} — {nameById(groups, a.group_id, (x) => x.name)}{" "}
              <span style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>
                ({t(`hour_type.${a.hour_type}`)})
              </span>
            </span>
            <button className="text-btn" onClick={() => removeMutation.mutate(a.id)}>
              {t("dean.remove")}
            </button>
          </div>
        ))}

        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "28px 0 10px" }}>{t("dean.hours_summary")}</h2>
        {myTeachers.map((tch) => (
          <div
            key={tch.id}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}
          >
            <span>{tch.full_name}</span>
            <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>
              {termHoursForTeacher(assignments ?? [], subjects ?? [], tch.id)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label={t("dean.select_teacher")}>
          <SelectInput value={teacherId} onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">—</option>
            {myTeachers.map((tch) => (
              <option key={tch.id} value={tch.id}>
                {tch.full_name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t("dean.select_subject")}>
          <SelectInput value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">—</option>
            {mySubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t("dean.select_group")}>
          <SelectInput value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">—</option>
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t("teacher.detail_type")}>
          <Segmented
            value={hourType}
            onChange={setHourType}
            options={HOUR_TYPES.map((h) => ({ value: h, label: t(`hour_type.${h}`) }))}
          />
        </Field>

        {warning && <WarningBanner>{warning}</WarningBanner>}

        <Button
          variant="primary"
          disabled={!teacherId || !subjectId || !groupId || !activeSemester || createMutation.isPending}
          onClick={handleAssign}
        >
          {t("dean.assign")}
        </Button>
      </div>
    </div>
  );
}
