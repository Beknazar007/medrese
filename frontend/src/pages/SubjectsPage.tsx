import { subjectsApi } from "../api/entities";
import type { Subject } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function SubjectsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Subject>
      title="Subjects"
      queryKey={["subjects"]}
      api={subjectsApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        {
          key: "department",
          label: "Department",
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
        { key: "lecture_hours", label: "Lecture h." },
        { key: "practice_hours", label: "Practice h." },
        { key: "lab_hours", label: "Lab h." },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "code", label: "Code", type: "text", required: true, editableOnCreateOnly: true },
        {
          name: "department_id",
          label: "Department",
          type: "select",
          required: true,
          options: departmentOptions,
          editableOnCreateOnly: true, // backend doesn't support moving a subject between departments
        },
        { name: "lecture_hours", label: "Lecture hours", type: "number" },
        { name: "practice_hours", label: "Practice hours", type: "number" },
        { name: "lab_hours", label: "Lab hours", type: "number" },
      ]}
      emptyHint="No subjects yet. Add the first one."
    />
  );
}
