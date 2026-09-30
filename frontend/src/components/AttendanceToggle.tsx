import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "../api/types";

// Shared by the regular journal and the hifz journal so attendance is taken identically in both.
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "К",
  ABSENT: "Ж",
  LATE: "О",
  EXCUSED: "С",
};

const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: "#2e7d32",
  ABSENT: "#c62828",
  LATE: "#e08600",
  EXCUSED: "#1565c0",
};

export const ATTENDANCE_ROW_TINT: Partial<Record<AttendanceStatus, string>> = {
  ABSENT: "rgba(198,40,40,.06)",
  LATE: "rgba(224,134,0,.08)",
};

export function countAttendance(statuses: (AttendanceStatus | null)[]): Record<AttendanceStatus | "UNSET", number> {
  const counts: Record<AttendanceStatus | "UNSET", number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, UNSET: 0 };
  for (const status of statuses) {
    if (status) counts[status] += 1;
    else counts.UNSET += 1;
  }
  return counts;
}

export default function AttendanceToggle({
  value,
  onChange,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_e, next) => onChange(next)}>
      {ATTENDANCE_OPTIONS.map((status) => (
        <ToggleButton
          key={status}
          value={status}
          sx={{
            px: 1.1,
            py: 0.3,
            fontSize: 12,
            fontWeight: 600,
            "&.Mui-selected": {
              bgcolor: ATTENDANCE_COLOR[status],
              color: "#fff",
              "&:hover": { bgcolor: ATTENDANCE_COLOR[status], opacity: 0.9 },
            },
          }}
        >
          <Tooltip title={t(`journal.attendance_${status.toLowerCase()}`)}>
            <span>{ATTENDANCE_SHORT[status]}</span>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
