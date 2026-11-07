import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "../api/types";
import { ATTENDANCE_OPTIONS } from "../lib/attendance";
import { STATUS_INK } from "../lib/palette";

const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "К",
  ABSENT: "Ж",
  LATE: "О",
  EXCUSED: "С",
};

// Darker "ink" shades: white letters stay readable on all four.
const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: STATUS_INK.present,
  ABSENT: STATUS_INK.absent,
  LATE: STATUS_INK.late,
  EXCUSED: STATUS_INK.excused,
};

export default function AttendanceToggle({
  value,
  onChange,
  excuseReason,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  /** Excused by the dean's office: shown locked, with the reason underneath. */
  excuseReason?: string | null;
}) {
  const { t } = useTranslation();
  const group = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      disabled={Boolean(excuseReason)}
      onChange={(_e, next) => onChange(next)}
    >
      {ATTENDANCE_OPTIONS.map((status) => (
        <ToggleButton
          key={status}
          value={status}
          sx={{
            px: 1.1,
            py: 0.3,
            fontSize: 12,
            fontWeight: 600,
            "&.Mui-selected, &.Mui-selected.Mui-disabled": {
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
  if (!excuseReason) return group;
  return (
    <Box>
      {group}
      <Typography variant="caption" sx={{ display: "block", color: ATTENDANCE_COLOR.EXCUSED, mt: 0.25, maxWidth: 220 }}>
        {t("journal.excused_by_deanery")}: {excuseReason}
      </Typography>
    </Box>
  );
}
