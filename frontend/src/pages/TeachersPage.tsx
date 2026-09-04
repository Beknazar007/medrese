import { teachersApi } from "../api/entities";
import type { Teacher } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function TeachersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Teacher>
      title="Teachers"
      queryKey={["teachers"]}
      api={teachersApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
      columns={[
        { key: "full_name", label: "Full name" },
        {
          key: "department",
          label: "Department",
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
        { key: "academic_degree", label: "Degree" },
        { key: "phone", label: "Phone" },
        { key: "hire_date", label: "Hired" },
      ]}
      fields={[
        { name: "username", label: "Username (login)", type: "text", required: true, editableOnCreateOnly: true },
        { name: "password", label: "Password", type: "text", required: true, editableOnCreateOnly: true },
        { name: "email", label: "Email", type: "text", editableOnCreateOnly: true },
        { name: "full_name", label: "Full name", type: "text", required: true },
        { name: "department_id", label: "Department", type: "select", required: true, options: departmentOptions },
        { name: "academic_degree", label: "Academic degree", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "hire_date", label: "Hire date", type: "date" },
        { name: "bio", label: "Bio", type: "text" },
      ]}
      emptyHint="No teachers yet. Add the first one."
    />
  );
}
