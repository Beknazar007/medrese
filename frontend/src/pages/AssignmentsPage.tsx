import { MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { assignmentsApi } from "../api/entities";
import type { TeachingAssignment } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments, useGroups, useSemesters, useSubjects, useTeachers } from "../hooks/useReferenceData";

export default function AssignmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";

  const { data: semesters } = useSemesters();
  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: departments } = useDepartments();

  const [semesterId, setSemesterId] = useState<number | "">("");

  const HOUR_TYPES = [
    { value: "LECTURE", label: t("hour_type.LECTURE") },
    { value: "PRACTICE", label: t("hour_type.PRACTICE") },
    { value: "LAB", label: t("hour_type.LAB") },
  ];

  const inScope = (departmentId: number) => user?.role === "RECTOR" || departmentId === user?.headed_department_id;
  const teacherOptions = (teachers ?? [])
    .filter((t2) => inScope(t2.department_id))
    .map((t2) => ({ value: t2.id, label: t2.full_name }));
  const subjectOptions = (subjects ?? [])
    .filter((s) => inScope(s.department_id))
    .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const groupOptions = (groups ?? [])
    .filter((g) => inScope(g.department_id))
    .map((g) => ({ value: g.id, label: g.name }));
  const semesterOptions = (semesters ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <EntityCrudPage<TeachingAssignment>
      title={t("assignments.title")}
      queryKey={["assignments"]}
      listParams={semesterId ? { semester_id: semesterId } : undefined}
      api={{
        list: assignmentsApi.list,
        create: (p) => assignmentsApi.create(p as Omit<TeachingAssignment, "id">),
        remove: assignmentsApi.remove,
      }}
      canCreate={canWrite}
      canEdit={false}
      canDelete={canWrite}
      extraToolbar={
        <TextField
          select
          size="small"
          label={t("assignments.filter_semester")}
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{t("common.all_semesters")}</MenuItem>
          {semesterOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      }
      columns={[
        {
          key: "teacher",
          label: t("assignments.col_teacher"),
          render: (row) => nameById(teachers, row.teacher_id, (t2) => t2.full_name),
        },
        { key: "subject", label: t("assignments.col_subject"), render: (row) => nameById(subjects, row.subject_id, (s) => s.name) },
        { key: "group", label: t("assignments.col_group"), render: (row) => nameById(groups, row.group_id, (g) => g.name) },
        { key: "semester", label: t("assignments.col_semester"), render: (row) => nameById(semesters, row.semester_id, (s) => s.name) },
        { key: "hour_type", label: t("assignments.col_type"), render: (row) => t(`hour_type.${row.hour_type}`) },
        {
          key: "department",
          label: t("assignments.col_department"),
          render: (row) => {
            const teacher = teachers?.find((t2) => t2.id === row.teacher_id);
            return teacher ? nameById(departments, teacher.department_id, (d) => d.name) : "—";
          },
        },
      ]}
      fields={[
        { name: "teacher_id", label: t("assignments.field_teacher"), type: "select", required: true, options: teacherOptions },
        { name: "subject_id", label: t("assignments.field_subject"), type: "select", required: true, options: subjectOptions },
        { name: "group_id", label: t("assignments.field_group"), type: "select", required: true, options: groupOptions },
        { name: "semester_id", label: t("assignments.field_semester"), type: "select", required: true, options: semesterOptions },
        { name: "hour_type", label: t("assignments.field_type"), type: "select", required: true, options: HOUR_TYPES },
      ]}
      emptyHint={t("assignments.empty_hint")}
    />
  );
}
