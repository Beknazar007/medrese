import { timeSlotsApi } from "../api/entities";
import type { TimeSlot } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function TimeSlotsPage() {
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<TimeSlot>
      title="Time slots"
      queryKey={["timeslots"]}
      api={timeSlotsApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "order", label: "Period #" },
        { key: "start_time", label: "Start" },
        { key: "end_time", label: "End" },
      ]}
      fields={[
        { name: "order", label: "Period number", type: "number", required: true },
        { name: "start_time", label: "Start time", type: "time", required: true },
        { name: "end_time", label: "End time", type: "time", required: true },
      ]}
      emptyHint="No time slots yet. Rector can add one (e.g. period 1 = 08:00-08:50)."
    />
  );
}
