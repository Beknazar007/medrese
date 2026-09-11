import { Avatar, MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { studentsApi } from "../api/entities";
import type { Student } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import StudentProfileDialog from "../components/StudentProfileDialog";
import { useAuth } from "../context/AuthContext";
import { nameById, useGroups } from "../hooks/useReferenceData";

export default function StudentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = user?.role === "RECTOR" || user?.role === "DEAN";
  const { data: groups } = useGroups();
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<number | "">("");

  const groupOptions = (groups ?? [])
    .filter((g) => user?.role === "RECTOR" || g.department_id === user?.headed_department_id)
    .map((g) => ({ value: g.id, label: g.name }));

  return (
    <>
      <EntityCrudPage<Student>
        title={t("students.title")}
        queryKey={["students"]}
        listParams={filterGroupId ? { group_id: filterGroupId } : undefined}
        api={studentsApi}
        canCreate={canWrite}
        canEdit={canWrite}
        canDelete={canWrite}
        onRowClick={(row) => setProfileStudentId(row.id)}
        extraToolbar={
          <TextField
            select
            size="small"
            label={t("common.group_filter")}
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">{t("common.all_groups")}</MenuItem>
            {groupOptions.map((g) => (
              <MenuItem key={g.value} value={g.value}>
                {g.label}
              </MenuItem>
            ))}
          </TextField>
        }
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
          { key: "full_name", label: t("students.full_name") },
          { key: "group", label: t("students.group"), render: (row) => nameById(groups, row.group_id, (g) => g.name) },
          { key: "student_number", label: t("students.student_number") },
          { key: "phone", label: t("students.phone") },
          { key: "is_active", label: t("students.active"), render: (row) => (row.is_active ? t("common.yes") : t("common.no")) },
        ]}
        fields={[
          { name: "photo", label: t("students.photo"), type: "image" },
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
          { name: "bio", label: t("students.bio"), type: "text", multiline: true },
        ]}
        emptyHint={t("students.empty_hint")}
      />
      {profileStudentId !== null && (
        <StudentProfileDialog studentId={profileStudentId} onClose={() => setProfileStudentId(null)} />
      )}
    </>
  );
}
