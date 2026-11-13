import { useTranslation } from "react-i18next";
import { nonWorkingDaysApi } from "../api/entities";
import type { NonWorkingDay } from "../api/types";
import EntityCrudPage from "../components/EntityCrudPage";

export default function NonWorkingDaysPage() {
  const { t } = useTranslation();

  // Checked here as well as on the server so the message appears under the field right away.
  function validate(values: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!String(values.name ?? "").trim()) errors.name = t("non_working_days.error_name_required");
    const start = String(values.start_date ?? "");
    const end = String(values.end_date ?? "");
    // ISO dates compare correctly as strings.
    if (start && end && end < start) errors.end_date = t("non_working_days.error_end_before_start");
    return errors;
  }

  return (
    <EntityCrudPage<NonWorkingDay>
      title={t("non_working_days.title")}
      queryKey={["non-working-days"]}
      api={nonWorkingDaysApi}
      columns={[
        { key: "name", label: t("non_working_days.name") },
        { key: "start_date", label: t("non_working_days.start") },
        { key: "end_date", label: t("non_working_days.end") },
      ]}
      fields={[
        { name: "name", label: t("non_working_days.name"), type: "text", required: true },
        { name: "start_date", label: t("non_working_days.start"), type: "date", required: true },
        { name: "end_date", label: t("non_working_days.end"), type: "date", required: true },
      ]}
      validate={validate}
      deleteConfirmText={t("non_working_days.delete_confirm")}
      labeledActions
      emptyHint={t("non_working_days.empty_hint")}
    />
  );
}
