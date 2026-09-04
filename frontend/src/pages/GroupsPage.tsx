import { groupsApi } from "../api/entities";
import type { Group } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function GroupsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Group>
      title="Groups"
      queryKey={["groups"]}
      api={groupsApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
      columns={[
        { key: "name", label: "Name" },
        { key: "specialty", label: "Specialty" },
        { key: "course_year", label: "Year" },
        {
          key: "department",
          label: "Department",
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "specialty", label: "Specialty", type: "text", required: true },
        { name: "course_year", label: "Course year", type: "number", required: true },
        {
          name: "department_id",
          label: "Department",
          type: "select",
          required: true,
          options: departmentOptions,
          editableOnCreateOnly: true,
        },
      ]}
      emptyHint="No groups yet — placeholders for future students. Add the first one."
    />
  );
}
