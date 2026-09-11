import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { departmentsApi, usersApi } from "../api/entities";
import type { Department } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

interface DeanUser {
  id: number;
  username: string;
}

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  const { data: deans } = useQuery({
    queryKey: ["users", "DEAN"],
    queryFn: () => usersApi.list("DEAN") as Promise<DeanUser[]>,
    enabled: isRector,
  });

  return (
    <EntityCrudPage<Department>
      title={t("departments.title")}
      queryKey={["departments"]}
      api={departmentsApi}
      canCreate={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: t("departments.name") },
        {
          key: "head",
          label: t("departments.dean"),
          render: (row) =>
            row.head_user_id
              ? (deans?.find((d) => d.id === row.head_user_id)?.username ?? `#${row.head_user_id}`)
              : t("common.not_assigned"),
        },
      ]}
      fields={[
        { name: "name", label: t("departments.name"), type: "text", required: true },
        ...(isRector
          ? [
              {
                name: "head_user_id",
                label: t("departments.dean"),
                type: "select" as const,
                options: [
                  { value: "", label: t("common.not_assigned") },
                  ...(deans ?? []).map((d) => ({ value: d.id, label: d.username })),
                ],
              },
            ]
          : []),
      ]}
      emptyHint={t("departments.empty_hint")}
    />
  );
}
