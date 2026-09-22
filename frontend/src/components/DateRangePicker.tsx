import { Box, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { computeRange, type DateRange, type RangePreset } from "../lib/dateRanges";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<RangePreset | null>("week");

  function handlePreset(p: RangePreset) {
    setPreset(p);
    onChange(computeRange(p));
  }

  function handleFromChange(from: string) {
    setPreset(null);
    onChange({ from, to: value.to });
  }

  function handleToChange(to: string) {
    setPreset(null);
    onChange({ from: value.from, to });
  }

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      <ToggleButtonGroup size="small" exclusive value={preset} onChange={(_e, v) => v && handlePreset(v)}>
        <ToggleButton value="day">{t("monitoring.range_day")}</ToggleButton>
        <ToggleButton value="week">{t("monitoring.range_week")}</ToggleButton>
        <ToggleButton value="month">{t("monitoring.range_month")}</ToggleButton>
        <ToggleButton value="year">{t("monitoring.range_year")}</ToggleButton>
      </ToggleButtonGroup>
      <TextField
        type="date"
        size="small"
        label={t("monitoring.range_from")}
        value={value.from}
        onChange={(e) => handleFromChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ minWidth: 150 }}
      />
      <TextField
        type="date"
        size="small"
        label={t("monitoring.range_to")}
        value={value.to}
        onChange={(e) => handleToChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ minWidth: 150 }}
      />
    </Box>
  );
}
