import { useTranslation } from "react-i18next";
import { facultiesApi } from "../api/entities";
import type { Faculty } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function FacultiesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Faculty>
      title={t("faculties.title")}
      queryKey={["faculties"]}
      api={facultiesApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[{ key: "name", label: t("faculties.name") }]}
      fields={[{ name: "name", label: t("faculties.name"), type: "text", required: true }]}
      emptyHint={t("faculties.empty_hint")}
    />
  );
}
