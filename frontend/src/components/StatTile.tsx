import { Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "warning";
}

const TONE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "#0b0b0b",
  good: "#0ca30c",
  warning: "#c98500",
};

export default function StatTile({ label, value, tone = "neutral" }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: "1 1 150px", minWidth: 130 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 600, color: TONE_COLOR[tone], fontSize: { xs: "1.6rem", sm: "2rem" } }}>
        {value}
      </Typography>
    </Paper>
  );
}
