import { useTranslation } from "react-i18next";
import { groupsApi } from "../api/entities";
import type { Group } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function GroupsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Group>
      title={t("groups.title")}
      queryKey={["groups"]}
      api={groupsApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={
        user?.role === "DEAN"
          ? { department_id: user.headed_department_id, group_type: "REGULAR" }
          : { group_type: "REGULAR" }
      }
      columns={[
        { key: "name", label: t("groups.name") },
        { key: "specialty", label: t("groups.specialty") },
        { key: "course_year", label: t("groups.course_year") },
        {
          key: "department",
          label: t("groups.department"),
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
        {
          key: "group_type",
          label: t("groups.type"),
          render: (row) => (row.group_type === "HAFIZ" ? t("groups.type_hafiz") : t("groups.type_regular")),
        },
      ]}
      fields={[
        { name: "name", label: t("groups.name"), type: "text", required: true },
        { name: "specialty", label: t("groups.specialty"), type: "text", required: true },
        { name: "course_year", label: t("groups.course_year"), type: "number", required: true },
        {
          name: "department_id",
          label: t("groups.department"),
          type: "select",
          required: true,
          options: departmentOptions,
          editableOnCreateOnly: true,
        },
        {
          name: "group_type",
          label: t("groups.type"),
          type: "select",
          required: true,
          options: [
            { value: "REGULAR", label: t("groups.type_regular") },
            { value: "HAFIZ", label: t("groups.type_hafiz") },
          ],
        },
      ]}
      emptyHint={t("groups.empty_hint")}
    />
  );
}
