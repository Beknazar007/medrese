import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "../api/types";
import { ATTENDANCE_OPTIONS, attendanceLabelKey, attendanceLetterKey } from "../lib/attendance";
import { STATUS_INK } from "../lib/palette";

/** Counters above the roster. Each starts with its button letter, so a phone user learns
 *  what "К"/"П"/"P" mean without a long-press tooltip. */
export default function AttendanceLegend({ counts }: { counts: Record<AttendanceStatus | "UNSET", number> }) {
  const { t } = useTranslation();
  return (
    <Box
      data-testid="attendance-legend"
      sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", fontSize: 13, color: "text.secondary" }}
    >
      {ATTENDANCE_OPTIONS.map((status) => (
        <span key={status}>
          {t("journal.attendance_legend", { letter: t(attendanceLetterKey(status)), label: t(attendanceLabelKey(status)) })}:{" "}
          <strong>{counts[status]}</strong>
        </span>
      ))}
      {counts.UNSET > 0 && (
        <span style={{ color: STATUS_INK.late }}>
          {t("journal.unset")}: <strong>{counts.UNSET}</strong>
        </span>
      )}
    </Box>
  );
}
