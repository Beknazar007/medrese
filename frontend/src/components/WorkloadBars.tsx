import { Box, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TeacherWorkload } from "../api/types";
import { CHART_BLUE, STATUS_INK, TRACK } from "../lib/palette";

interface Row extends TeacherWorkload {
  departmentName: string;
}

/**
 * One bar per teacher: lessons per week, scaled to the busiest teacher, heaviest first, so over-
 * and under-loaded teachers stand out. Assignments that are not on the timetable yet are a
 * separate count in amber — they are a different unit (subject × group), not part of the bar.
 */
export default function WorkloadBars({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();
  const maxPeriods = Math.max(1, ...rows.map((r) => r.weekly_scheduled_periods));
  const sorted = [...rows].sort(
    (a, b) => b.weekly_scheduled_periods - a.weekly_scheduled_periods || a.full_name.localeCompare(b.full_name),
  );

  return (
    <Box>
      <Box sx={{ display: "flex", columnGap: 3, rowGap: 0.5, mb: 1.5, fontSize: 13, color: "text.secondary", flexWrap: "wrap" }}>
        <LegendDot color={CHART_BLUE} label={t("dashboard.legend_placed")} />
        <LegendDot color={STATUS_INK.late} label={t("dashboard.legend_gap")} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {sorted.map((row) => {
          const pct = (row.weekly_scheduled_periods / maxPeriods) * 100;
          const unplaced = row.placed_assignment_count === undefined ? 0 : Math.max(0, row.assignment_count - row.placed_assignment_count);

          return (
            <Box key={row.teacher_id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: { xs: 110, sm: 200 }, flexShrink: 0, overflow: "hidden" }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }} title={row.full_name}>
                  {row.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {row.departmentName}
                  {unplaced > 0 && (
                    <Box component="span" sx={{ color: STATUS_INK.late, fontWeight: 600 }}>
                      {" · "}
                      {t("dashboard.unplaced_count", { count: unplaced })}
                    </Box>
                  )}
                </Typography>
              </Box>

              <Tooltip
                arrow
                title={`${t("dashboard.legend_placed")}: ${row.weekly_scheduled_periods} · ${t("dashboard.col_assignments")}: ${row.placed_assignment_count ?? "?"}/${row.assignment_count}`}
              >
                <Box sx={{ flex: 1, minWidth: 60, height: 10, bgcolor: TRACK, borderRadius: "4px", overflow: "hidden" }}>
                  <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: CHART_BLUE, borderRadius: "4px" }} />
                </Box>
              </Tooltip>

              <Typography
                variant="body2"
                sx={{ width: 32, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
              >
                {row.weekly_scheduled_periods}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color }} />
      {label}
    </Box>
  );
}
