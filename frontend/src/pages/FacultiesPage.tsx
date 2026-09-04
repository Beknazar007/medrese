import { facultiesApi } from "../api/entities";
import type { Faculty } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function FacultiesPage() {
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Faculty>
      title="Faculties"
      queryKey={["faculties"]}
      api={facultiesApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[{ key: "name", label: "Name" }]}
      fields={[{ name: "name", label: "Name", type: "text", required: true }]}
      emptyHint="No faculties yet. Rector can add one."
    />
  );
}
