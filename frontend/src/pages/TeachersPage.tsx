import { Avatar } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { teachersApi } from "../api/entities";
import type { Teacher } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import TeacherProfileDialog from "../components/TeacherProfileDialog";
import { useAuth } from "../context/AuthContext";
import { nameById, useDepartments } from "../hooks/useReferenceData";

export default function TeachersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: departments } = useDepartments();
  const [profileTeacher, setProfileTeacher] = useState<Teacher | null>(null);

  const departmentOptions = (departments ?? [])
    .filter((d) => user?.role === "RECTOR" || d.id === user?.headed_department_id)
    .map((d) => ({ value: d.id, label: d.name }));

  return (
    <>
      <EntityCrudPage<Teacher>
        title={t("teachers.title")}
        queryKey={["teachers"]}
        api={teachersApi}
        canCreate={canWrite}
        canEdit={canWrite}
        canDelete={canWrite}
        defaultValues={user?.role === "DEAN" ? { department_id: user.headed_department_id } : {}}
        onRowClick={(row) => setProfileTeacher(row)}
        columns={[
          {
            key: "photo",
            label: "",
            render: (row) => (
              <Avatar src={row.photo ?? undefined} sx={{ width: 32, height: 32, fontSize: 14 }}>
                {row.full_name.charAt(0)}
              </Avatar>
            ),
          },
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
          { name: "photo", label: t("teachers.photo"), type: "image" },
          { name: "username", label: t("teachers.username_label"), type: "text", required: true, editableOnCreateOnly: true },
          { name: "password", label: t("teachers.password_label"), type: "text", required: true, editableOnCreateOnly: true },
          { name: "email", label: t("teachers.email"), type: "text", editableOnCreateOnly: true },
          { name: "full_name", label: t("teachers.full_name"), type: "text", required: true },
          { name: "department_id", label: t("teachers.department"), type: "select", required: true, options: departmentOptions },
          { name: "academic_degree", label: t("teachers.degree"), type: "text" },
          { name: "phone", label: t("teachers.phone"), type: "text" },
          { name: "hire_date", label: t("teachers.hired"), type: "date" },
          { name: "teaching_experience_years", label: t("teachers.experience_years"), type: "number" },
          { name: "education", label: t("teachers.education"), type: "text", multiline: true },
          { name: "competency", label: t("teachers.competency"), type: "text", multiline: true },
          { name: "previous_subjects", label: t("teachers.previous_subjects"), type: "text", multiline: true },
          { name: "can_teach", label: t("teachers.can_teach"), type: "text", multiline: true },
          { name: "bio", label: t("teachers.bio"), type: "text", multiline: true },
        ]}
        emptyHint={t("teachers.empty_hint")}
      />
      {profileTeacher && <TeacherProfileDialog teacher={profileTeacher} onClose={() => setProfileTeacher(null)} />}
    </>
  );
}
