import { useTranslation } from "react-i18next";
import { teachersApi } from "../api/entities";
import type { Teacher } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function TeachersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <EntityCrudPage<Teacher>
      title={t("teachers.title")}
      queryKey={["teachers"]}
      api={teachersApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
      columns={[
        { key: "full_name", label: t("teachers.full_name") },
        { key: "username", label: t("teachers.username_label") },
        {
          key: "department",
          label: t("teachers.department"),
          render: (row) => nameById(departments, row.department_id, (d) => d.name),
        },
        { key: "academic_degree", label: t("teachers.degree") },
        { key: "phone", label: t("teachers.phone") },
        { key: "hire_date", label: t("teachers.hired") },
      ]}
      fields={[
        { name: "username", label: t("teachers.username_label"), type: "text", required: true, editableOnCreateOnly: true },
        { name: "password", label: t("teachers.password_label"), type: "text", required: true, editableOnCreateOnly: true },
        { name: "email", label: t("teachers.email"), type: "text", editableOnCreateOnly: true },
        { name: "full_name", label: t("teachers.full_name"), type: "text", required: true },
        { name: "department_id", label: t("teachers.department"), type: "select", required: true, options: departmentOptions },
        { name: "academic_degree", label: t("teachers.degree"), type: "text" },
        { name: "phone", label: t("teachers.phone"), type: "text" },
        { name: "hire_date", label: t("teachers.hired"), type: "date" },
        { name: "bio", label: t("teachers.bio"), type: "text" },
      ]}
      emptyHint={t("teachers.empty_hint")}
    />
  );
}
