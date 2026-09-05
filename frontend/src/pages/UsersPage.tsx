import { useTranslation } from "react-i18next";
import { usersApi } from "../api/entities";
import EntityCrudPage from "../components/EntityCrudPage";

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: boolean;
}

export default function UsersPage() {
  const { t } = useTranslation();

  return (
    <EntityCrudPage<AdminUser>
      title={t("users.title")}
      queryKey={["users", "admins"]}
      api={{
        list: () => usersApi.list(),
        create: (payload) =>
          usersApi.create(payload as { username: string; password: string; email?: string; role: string }),
      }}
      canCreate={true}
      canEdit={false}
      canDelete={false}
      columns={[
        { key: "username", label: t("users.username") },
        { key: "email", label: t("users.email") },
        { key: "role", label: t("users.role") },
      ]}
      fields={[
        { name: "username", label: t("users.username"), type: "text", required: true },
        { name: "password", label: t("users.password"), type: "text", required: true },
        { name: "email", label: t("users.email"), type: "text" },
        {
          name: "role",
          label: t("users.role"),
          type: "select",
          required: true,
          options: [
            { value: "DEAN", label: t("users.role_dean") },
            { value: "RECTOR", label: t("users.role_rector") },
          ],
        },
      ]}
      emptyHint={t("users.empty_hint")}
    />
  );
}
