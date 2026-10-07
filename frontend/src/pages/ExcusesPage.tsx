import { MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { excusesApi } from "../api/entities";
import type { Excuse } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";
import { nameById, useGroups, useStudents } from "../hooks/useReferenceData";

const fmt = (iso: string) => iso.split("-").reverse().join(".");

// The dean's office records absences with a valid reason here; every lesson of the student's
// group inside the period is marked "excused" and locked for teachers.
export default function ExcusesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: groups } = useGroups();
  const { data: students } = useStudents();
  const [filterGroupId, setFilterGroupId] = useState<number | "">("");

  const visibleGroups = (groups ?? []).filter(
    (g) => user?.role === "RECTOR" || g.department_id === user?.headed_department_id,
  );
  const visibleGroupIds = new Set(visibleGroups.map((g) => g.id));
  const studentOptions = (students ?? [])
    .filter((s) => s.is_active && visibleGroupIds.has(s.group_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((s) => ({ value: s.id, label: `${s.full_name} — ${nameById(groups, s.group_id, (g) => g.name)}` }));

  return (
    <EntityCrudPage<Excuse>
      title={t("excuses.title")}
      queryKey={["excuses"]}
      listParams={filterGroupId ? { group_id: filterGroupId } : undefined}
      api={excusesApi}
      defaultValues={{ date_from: new Date().toLocaleDateString("sv-SE"), date_to: new Date().toLocaleDateString("sv-SE") }}
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
          {visibleGroups.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
            </MenuItem>
          ))}
        </TextField>
      }
      columns={[
        { key: "student_name", label: t("excuses.student") },
        { key: "group", label: t("students.group"), render: (row) => nameById(groups, row.group_id, (g) => g.name) },
        {
          key: "period",
          label: t("excuses.period"),
          render: (row) => (row.date_from === row.date_to ? fmt(row.date_from) : `${fmt(row.date_from)} – ${fmt(row.date_to)}`),
        },
        { key: "reason", label: t("excuses.reason") },
        { key: "created_by", label: t("excuses.created_by"), render: (row) => row.created_by ?? "—" },
      ]}
      fields={[
        { name: "student_id", label: t("excuses.student"), type: "select", required: true, options: studentOptions, editableOnCreateOnly: true },
        { name: "date_from", label: t("excuses.date_from"), type: "date", required: true },
        { name: "date_to", label: t("excuses.date_to"), type: "date", required: true },
        { name: "reason", label: t("excuses.reason"), type: "text", required: true, multiline: true },
      ]}
      emptyHint={t("excuses.empty_hint")}
      searchPlaceholder={t("excuses.search")}
    />
  );
}
