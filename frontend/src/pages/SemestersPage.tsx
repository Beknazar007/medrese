import { semestersApi } from "../api/entities";
import type { Semester } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function SemestersPage() {
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Semester>
      title="Semesters"
      queryKey={["semesters"]}
      api={semestersApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: "Name" },
        { key: "start_date", label: "Start" },
        { key: "end_date", label: "End" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "end_date", label: "End date", type: "date", required: true },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      emptyHint="No semesters yet. Rector can add one."
    />
  );
}
