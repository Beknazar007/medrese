import { useQuery } from "@tanstack/react-query";
import { departmentsApi, usersApi } from "../api/entities";
import type { Department } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { nameById, useFaculties } from "../hooks/useReferenceData";
import { useAuth } from "../context/AuthContext";

interface DeanUser {
  id: number;
  username: string;
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";
  const { data: faculties } = useFaculties();

  const { data: deans } = useQuery({
    queryKey: ["users", "DEAN"],
    queryFn: () => usersApi.list("DEAN") as Promise<DeanUser[]>,
    enabled: isRector,
  });

  return (
    <EntityCrudPage<Department>
      title="Departments"
      queryKey={["departments"]}
      api={departmentsApi}
      canCreate={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "faculty",
          label: "Faculty",
          render: (row) => nameById(faculties, row.faculty_id, (f) => f.name),
        },
        {
          key: "head",
          label: "Dean",
          render: (row) =>
            row.head_user_id
              ? (deans?.find((d) => d.id === row.head_user_id)?.username ?? `#${row.head_user_id}`)
              : "— not assigned —",
        },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        {
          name: "faculty_id",
          label: "Faculty",
          type: "select",
          required: true,
          options: (faculties ?? []).map((f) => ({ value: f.id, label: f.name })),
        },
        ...(isRector
          ? [
              {
                name: "head_user_id",
                label: "Dean",
                type: "select" as const,
                options: [
                  { value: "", label: "— not assigned —" },
                  ...(deans ?? []).map((d) => ({ value: d.id, label: d.username })),
                ],
              },
            ]
          : []),
      ]}
      emptyHint="No departments yet. Rector can add one (pick a faculty first)."
    />
  );
}
