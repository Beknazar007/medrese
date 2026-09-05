import { useTranslation } from "react-i18next";
import { roomsApi } from "../api/entities";
import type { Room } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function RoomsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Room>
      title={t("rooms.title")}
      queryKey={["rooms"]}
      api={roomsApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: t("rooms.name") },
        { key: "building", label: t("rooms.building") },
        { key: "capacity", label: t("rooms.capacity") },
      ]}
      fields={[
        { name: "name", label: t("rooms.name"), type: "text", required: true },
        { name: "building", label: t("rooms.building"), type: "text", required: true },
        { name: "capacity", label: t("rooms.capacity"), type: "number" },
      ]}
      emptyHint={t("rooms.empty_hint")}
    />
  );
}
