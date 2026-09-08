import { Box, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TeacherWorkload } from "../api/types";

// Validated categorical slot-1 blue + the reserved status-warning amber from the
// dataviz skill's reference palette — used as documented, not re-derived.
const COLOR_PLACED = "#2a78d6";
const COLOR_GAP = "#fab219";
const COLOR_TRACK = "#eae9e6";

interface Row extends TeacherWorkload {
  departmentName: string;
}

export default function WorkloadBars({ rows }: { rows: Row[] }) {
  const { t } = useTranslation();
  const maxAssignments = Math.max(1, ...rows.map((r) => r.assignment_count));

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 3, mb: 1.5, fontSize: 13, color: "text.secondary" }}>
        <LegendDot color={COLOR_PLACED} label={t("dashboard.legend_placed")} />
        <LegendDot color={COLOR_GAP} label={t("dashboard.legend_gap")} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {rows.map((row) => {
          const totalPct = (row.assignment_count / maxAssignments) * 100;
          const placedPct = row.assignment_count > 0 ? (row.weekly_scheduled_periods / row.assignment_count) * totalPct : 0;
          const gapPct = Math.max(0, totalPct - placedPct);

          return (
            <Box key={row.teacher_id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: { xs: 120, sm: 200 }, flexShrink: 0, overflow: "hidden" }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {row.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {row.departmentName}
                </Typography>
              </Box>

              <Tooltip
                title={`${t("dashboard.col_placed")}: ${row.weekly_scheduled_periods} · ${t("dashboard.col_assignments")}: ${row.assignment_count}`}
                arrow
              >
                <Box sx={{ flex: 1, minWidth: 80, height: 10, bgcolor: COLOR_TRACK, borderRadius: "4px", position: "relative" }}>
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", gap: "2px" }}>
                    {placedPct > 0 && (
                      <Box sx={{ width: `${placedPct}%`, bgcolor: COLOR_PLACED, borderRadius: "4px" }} />
                    )}
                    {gapPct > 0 && <Box sx={{ width: `${gapPct}%`, bgcolor: COLOR_GAP, borderRadius: "4px" }} />}
                  </Box>
                </Box>
              </Tooltip>

              <Typography
                variant="caption"
                sx={{ width: 56, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "text.secondary" }}
              >
                {row.weekly_scheduled_periods}/{row.assignment_count}
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
