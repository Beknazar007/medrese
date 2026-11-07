import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

import { STATUS_FILL, TRACK as COLOR_TRACK } from "../lib/palette";

const COLOR_PRESENT = STATUS_FILL.present;
const COLOR_LATE = STATUS_FILL.late;
const COLOR_ABSENT = STATUS_FILL.absent;
const COLOR_EXCUSED = STATUS_FILL.excused;

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
