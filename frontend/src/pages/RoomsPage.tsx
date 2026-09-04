import { roomsApi } from "../api/entities";
import type { Room } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function RoomsPage() {
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<Room>
      title="Rooms"
      queryKey={["rooms"]}
      api={roomsApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "name", label: "Name" },
        { key: "building", label: "Building" },
        { key: "capacity", label: "Capacity" },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text", required: true },
        { name: "building", label: "Building", type: "text", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
      ]}
      emptyHint="No rooms yet. Rector can add one."
    />
  );
}
