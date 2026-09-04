import { MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { assignmentsApi } from "../api/entities";
import type { TeachingAssignment } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments, useGroups, useSemesters, useSubjects, useTeachers } from "../hooks/useReferenceData";

const HOUR_TYPES = [
  { value: "LECTURE", label: "Lecture" },
  { value: "PRACTICE", label: "Practice" },
  { value: "LAB", label: "Lab" },
];

export default function AssignmentsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";

  const { data: semesters } = useSemesters();
  const { data: teachers } = useTeachers();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: departments } = useDepartments();

  const [semesterId, setSemesterId] = useState<number | "">("");

  const inScope = (departmentId: number) => user?.role === "RECTOR" || departmentId === user?.headed_department_id;
  const teacherOptions = (teachers ?? [])
    .filter((t) => inScope(t.department_id))
    .map((t) => ({ value: t.id, label: t.full_name }));
  const subjectOptions = (subjects ?? [])
    .filter((s) => inScope(s.department_id))
    .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const groupOptions = (groups ?? [])
    .filter((g) => inScope(g.department_id))
    .map((g) => ({ value: g.id, label: g.name }));
  const semesterOptions = (semesters ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <EntityCrudPage<TeachingAssignment>
      title="Teaching assignments"
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
          label="Filter by semester"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All semesters</MenuItem>
          {semesterOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      }
      columns={[
        { key: "teacher", label: "Teacher", render: (row) => nameById(teachers, row.teacher_id, (t) => t.full_name) },
        { key: "subject", label: "Subject", render: (row) => nameById(subjects, row.subject_id, (s) => s.name) },
        { key: "group", label: "Group", render: (row) => nameById(groups, row.group_id, (g) => g.name) },
        { key: "semester", label: "Semester", render: (row) => nameById(semesters, row.semester_id, (s) => s.name) },
        { key: "hour_type", label: "Type" },
        {
          key: "department",
          label: "Department",
          render: (row) => {
            const teacher = teachers?.find((t) => t.id === row.teacher_id);
            return teacher ? nameById(departments, teacher.department_id, (d) => d.name) : "—";
          },
        },
      ]}
      fields={[
        { name: "teacher_id", label: "Teacher", type: "select", required: true, options: teacherOptions },
        { name: "subject_id", label: "Subject", type: "select", required: true, options: subjectOptions },
        { name: "group_id", label: "Group", type: "select", required: true, options: groupOptions },
        { name: "semester_id", label: "Semester", type: "select", required: true, options: semesterOptions },
        { name: "hour_type", label: "Hour type", type: "select", required: true, options: HOUR_TYPES },
      ]}
      emptyHint="No teaching assignments yet — assign a teacher to a subject+group+semester first, then build the timetable."
    />
  );
}
