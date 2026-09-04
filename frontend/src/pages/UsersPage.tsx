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
  return (
    <EntityCrudPage<AdminUser>
      title="Admin accounts (Rector / Dean)"
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
        { key: "username", label: "Username" },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" },
      ]}
      fields={[
        { name: "username", label: "Username", type: "text", required: true },
        { name: "password", label: "Password", type: "text", required: true },
        { name: "email", label: "Email", type: "text" },
        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          options: [
            { value: "DEAN", label: "Dean" },
            { value: "RECTOR", label: "Rector" },
          ],
        },
      ]}
      emptyHint="No admin accounts yet besides yourself."
    />
  );
}
