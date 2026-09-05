import { useTranslation } from "react-i18next";
import { timeSlotsApi } from "../api/entities";
import type { TimeSlot } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";
import { useAuth } from "../context/AuthContext";

export default function TimeSlotsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRector = user?.role === "RECTOR";

  return (
    <EntityCrudPage<TimeSlot>
      title={t("timeslots.title")}
      queryKey={["timeslots"]}
      api={timeSlotsApi}
      canCreate={isRector}
      canEdit={isRector}
      canDelete={isRector}
      columns={[
        { key: "order", label: t("timeslots.order") },
        { key: "start_time", label: t("timeslots.start") },
        { key: "end_time", label: t("timeslots.end") },
      ]}
      fields={[
        { name: "order", label: t("timeslots.order"), type: "number", required: true },
        { name: "start_time", label: t("timeslots.start"), type: "time", required: true },
        { name: "end_time", label: t("timeslots.end"), type: "time", required: true },
      ]}
      emptyHint={t("timeslots.empty_hint")}
    />
  );
}
