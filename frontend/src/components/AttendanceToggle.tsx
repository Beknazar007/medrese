import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "../api/types";
import { ATTENDANCE_OPTIONS, attendanceLabelKey, attendanceLetterKey } from "../lib/attendance";
import { STATUS_INK, STATUS_SOLID } from "../lib/palette";

// Darker "ink" shades: white letters stay readable on all four.
const ATTENDANCE_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: STATUS_SOLID.present,
  ABSENT: STATUS_SOLID.absent,
  LATE: STATUS_SOLID.late,
  EXCUSED: STATUS_SOLID.excused,
};

// 44 px is the smallest target a teacher hits reliably with a thumb during a lesson.
const TAP_SIZE = 44;

export default function AttendanceToggle({
  value,
  onChange,
  excuseReason,
  layout = "row",
  fullWidth = false,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  /** Excused by the dean's office: shown locked, with the reason underneath. */
  excuseReason?: string | null;
  /** "grid" stacks the buttons 2×2 so a wide table cell doesn't grow wider. */
  layout?: "row" | "grid";
  /** Phone cards: buttons share the full card width. */
  fullWidth?: boolean;
}) {
  const { t } = useTranslation();
  const isGrid = layout === "grid";
  const group = (
    <ToggleButtonGroup
      exclusive
      fullWidth={fullWidth && !isGrid}
      value={value}
      disabled={Boolean(excuseReason)}
      onChange={(_e, next) => onChange(next)}
      sx={
        isGrid
          ? {
              display: "grid",
              gridTemplateColumns: `repeat(2, ${TAP_SIZE}px)`,
              gap: 0.5,
              // The group normally glues buttons into one bar; in a grid each needs its own border.
              "& .MuiToggleButtonGroup-grouped": {
                m: 0,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              },
            }
          : undefined
      }
    >
      {ATTENDANCE_OPTIONS.map((status) => (
        <ToggleButton
          key={status}
          value={status}
          aria-label={t(attendanceLabelKey(status))}
          sx={{
            p: 0,
            minWidth: TAP_SIZE,
            minHeight: TAP_SIZE,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            "&.Mui-selected, &.Mui-selected.Mui-disabled": {
              bgcolor: ATTENDANCE_COLOR[status],
              color: "common.white",
              "&:hover": { bgcolor: ATTENDANCE_COLOR[status], opacity: 0.9 },
            },
          }}
        >
          {/* describeChild: the button already carries the full word as its name; the tooltip
              only shows it on hover instead of becoming a second label. The span fills the
              button so the hint appears anywhere over it. */}
          <Tooltip title={t(attendanceLabelKey(status))} describeChild>
            <Box
              component="span"
              sx={{
                flex: 1,
                alignSelf: "stretch",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: TAP_SIZE,
                minHeight: TAP_SIZE,
              }}
            >
              {t(attendanceLetterKey(status))}
            </Box>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
  if (!excuseReason) return group;
  return (
    <Box>
      {group}
      <Typography variant="caption" sx={{ display: "block", color: STATUS_INK.excused, mt: 0.25, maxWidth: 220 }}>
        {t("journal.excused_by_deanery")}: {excuseReason}
      </Typography>
    </Box>
  );
}
