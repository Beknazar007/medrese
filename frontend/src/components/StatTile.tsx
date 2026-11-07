import { Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { TONE_INK } from "../lib/palette";

interface Props {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warning";
}

const TONE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  neutral: TONE_INK.neutral,
  good: TONE_INK.good,
  warning: TONE_INK.warning,
};

export default function StatTile({ label, value, tone = "neutral" }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, flex: { xs: "1 1 130px", sm: "1 1 150px" }, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 600, color: TONE_COLOR[tone], fontSize: { xs: "1.4rem", sm: "2rem" }, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Paper>
  );
}
