import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

// Status-palette roles from the dataviz skill: conducted=good, missed=critical.
const COLOR_CONDUCTED = "#0ca30c";
const COLOR_MISSED = "#d03b3b";
const COLOR_TRACK = "#eae9e6";

export default function MonitoringBar({ conducted, missed }: { conducted: number; missed: number }) {
  const { t } = useTranslation();
  const total = conducted + missed;

  if (total === 0) {
    return <Box sx={{ height: 10, bgcolor: COLOR_TRACK, borderRadius: "4px" }} />;
  }

  return (
    <Tooltip
      arrow
      title={`${t("monitoring.status_conducted")}: ${conducted} · ${t("monitoring.status_missed")}: ${missed}`}
    >
      <Box sx={{ height: 10, borderRadius: "4px", display: "flex", gap: "2px", overflow: "hidden" }}>
        {conducted > 0 && (
          <Box sx={{ width: `${(conducted / total) * 100}%`, bgcolor: COLOR_CONDUCTED, borderRadius: "4px" }} />
        )}
        {missed > 0 && <Box sx={{ width: `${(missed / total) * 100}%`, bgcolor: COLOR_MISSED, borderRadius: "4px" }} />}
      </Box>
    </Tooltip>
  );
}
