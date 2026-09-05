import { useTranslation } from "react-i18next";
import type { ScheduleEntry, TeachingAssignment } from "../../api/types";
import Button from "../../components/ui/Button";
import Overlay from "../../components/ui/Overlay";
import { nameById, useGroups, useRooms, useSubjects, useTimeSlots } from "../../hooks/useReferenceData";

interface Props {
  entry: ScheduleEntry | null;
  assignment: TeachingAssignment | undefined;
  onClose: () => void;
}

export default function ClassDetailSheet({ entry, assignment, onClose }: Props) {
  const { t } = useTranslation();
  const { data: subjects } = useSubjects();
  const { data: groups } = useGroups();
  const { data: rooms } = useRooms();
  const { data: slots } = useTimeSlots();

  if (!entry) return null;
  const slot = slots?.find((s) => s.id === entry.time_slot_id);
  const subjectName = assignment ? nameById(subjects, assignment.subject_id, (s) => s.name) : "";

  return (
    <Overlay open={Boolean(entry)} onClose={onClose} variant="sheet">
      <div className="kicker">
        {t(`days_full.${entry.day_of_week}`)}
        {slot ? ` · ${slot.start_time.slice(0, 5)}` : ""}
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "6px 0 20px" }}>{subjectName}</h2>

      <DetailRow label={t("teacher.detail_group")} value={nameById(groups, entry.group_id, (g) => g.name)} />
      <DetailRow label={t("teacher.detail_room")} value={nameById(rooms, entry.room_id, (r) => r.name)} />
      <DetailRow
        label={t("teacher.detail_type")}
        value={assignment ? t(`hour_type.${assignment.hour_type}`) : "—"}
      />

      <Button variant="primary" block style={{ marginTop: 24 }} onClick={onClose}>
        {t("teacher.detail_close")}
      </Button>
      <p style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--color-neutral-500)", marginTop: 14 }}>
        {t("teacher.detail_journal_note")}
      </p>
    </Overlay>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid var(--color-hairline)",
        fontSize: 14.5,
      }}
    >
      <span style={{ color: "var(--color-neutral-600)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
