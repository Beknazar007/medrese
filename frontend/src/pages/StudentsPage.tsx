import { useTranslation } from "react-i18next";
import { studentsApi } from "../api/entities";
import type { Student } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useGroups } from "../hooks/useReferenceData";

export default function StudentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: groups } = useGroups();

  const groupOptions = (groups ?? [])
    .filter((g) => user?.role === "RECTOR" || g.department_id === user?.headed_department_id)
    .map((g) => ({ value: g.id, label: g.name }));

  return (
    <EntityCrudPage<Student>
      title={t("students.title")}
      queryKey={["students"]}
      api={studentsApi}
      canCreate={canWrite}
      canEdit={canWrite}
      canDelete={canWrite}
      columns={[
        { key: "full_name", label: t("students.full_name") },
        { key: "group", label: t("students.group"), render: (row) => nameById(groups, row.group_id, (g) => g.name) },
        { key: "student_number", label: t("students.student_number") },
        { key: "phone", label: t("students.phone") },
        { key: "is_active", label: t("students.active"), render: (row) => (row.is_active ? t("common.yes") : t("common.no")) },
      ]}
      fields={[
        { name: "full_name", label: t("students.full_name"), type: "text", required: true },
        { name: "group_id", label: t("students.group"), type: "select", required: true, options: groupOptions },
        { name: "student_number", label: t("students.student_number"), type: "text" },
        { name: "phone", label: t("students.phone"), type: "text" },
        { name: "birth_date", label: t("students.birth_date"), type: "date" },
        { name: "address", label: t("students.address"), type: "text" },
        { name: "guardian_name", label: t("students.guardian_name"), type: "text" },
        { name: "guardian_phone", label: t("students.guardian_phone"), type: "text" },
        { name: "enrollment_date", label: t("students.enrollment_date"), type: "date" },
        { name: "is_active", label: t("students.active"), type: "checkbox" },
      ]}
      emptyHint={t("students.empty_hint")}
    />
  );
}
