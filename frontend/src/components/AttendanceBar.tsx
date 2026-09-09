import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

// Status-palette roles from the dataviz skill: present=good, late=warning,
// absent=critical, excused=categorical blue (informational, not "bad").
const COLOR_PRESENT = "#0ca30c";
const COLOR_LATE = "#fab219";
const COLOR_ABSENT = "#d03b3b";
const COLOR_EXCUSED = "#2a78d6";
const COLOR_TRACK = "#eae9e6";

interface Segment {
  key: "present" | "late" | "excused" | "absent";
  count: number;
  color: string;
}

interface AttendanceCounts {
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
}

export default function AttendanceBar({ row }: { row: AttendanceCounts }) {
  const { t } = useTranslation();
  const total = row.present_count + row.absent_count + row.late_count + row.excused_count;

  const segments: Segment[] = [
    { key: "present", count: row.present_count, color: COLOR_PRESENT },
    { key: "late", count: row.late_count, color: COLOR_LATE },
    { key: "excused", count: row.excused_count, color: COLOR_EXCUSED },
    { key: "absent", count: row.absent_count, color: COLOR_ABSENT },
  ];

  if (total === 0) {
    return <Box sx={{ height: 10, bgcolor: COLOR_TRACK, borderRadius: "4px" }} />;
  }

  return (
    <Tooltip
      arrow
      title={segments
        .filter((s) => s.count > 0)
        .map((s) => `${t(`journal.attendance_${s.key}`)}: ${s.count}`)
        .join(" · ")}
    >
      <Box sx={{ height: 10, borderRadius: "4px", display: "flex", gap: "2px", overflow: "hidden" }}>
        {segments.map(
          (s) =>
            s.count > 0 && (
              <Box key={s.key} sx={{ width: `${(s.count / total) * 100}%`, bgcolor: s.color, borderRadius: "4px" }} />
            ),
        )}
      </Box>
    </Tooltip>
  );
}
