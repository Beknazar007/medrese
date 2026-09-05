import { useTranslation } from "react-i18next";
import { subjectsApi } from "../api/entities";
import type { Subject } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function SubjectsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Subject>
      title={t("subjects.title")}
      queryKey={["subjects"]}
      api={subjectsApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
      columns={[
        { key: "name", label: t("subjects.name") },
        { key: "code", label: t("subjects.code") },
        {
          key: "department",
          label: t("subjects.department"),
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
        { key: "lecture_hours", label: t("subjects.lecture_hours") },
        { key: "practice_hours", label: t("subjects.practice_hours") },
        { key: "lab_hours", label: t("subjects.lab_hours") },
      ]}
      fields={[
        { name: "name", label: t("subjects.name"), type: "text", required: true },
        { name: "code", label: t("subjects.code"), type: "text", required: true, editableOnCreateOnly: true },
        {
          name: "department_id",
          label: t("subjects.department"),
          type: "select",
          required: true,
          options: departmentOptions,
          editableOnCreateOnly: true, // backend doesn't support moving a subject between departments
        },
        { name: "lecture_hours", label: t("subjects.lecture_hours"), type: "number" },
        { name: "practice_hours", label: t("subjects.practice_hours"), type: "number" },
        { name: "lab_hours", label: t("subjects.lab_hours"), type: "number" },
      ]}
      emptyHint={t("subjects.empty_hint")}
    />
  );
}
