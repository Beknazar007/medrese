import { useTranslation } from "react-i18next";
import { semestersApi } from "../api/entities";
import type { Semester } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function SemestersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Semester>
      title={t("semesters.title")}
      queryKey={["semesters"]}
      api={semestersApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: t("semesters.name") },
        { key: "start_date", label: t("semesters.start") },
        { key: "end_date", label: t("semesters.end") },
        { key: "is_active", label: t("semesters.active"), render: (row) => (row.is_active ? t("common.yes") : t("common.no")) },
      ]}
      fields={[
        { name: "name", label: t("semesters.name"), type: "text", required: true },
        { name: "start_date", label: t("semesters.start"), type: "date", required: true },
        { name: "end_date", label: t("semesters.end"), type: "date", required: true },
        { name: "is_active", label: t("semesters.active"), type: "checkbox" },
      ]}
      emptyHint={t("semesters.empty_hint")}
    />
  );
}
