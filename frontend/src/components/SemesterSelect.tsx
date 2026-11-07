import { MenuItem, TextField, type SxProps, type Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSemesters } from "../hooks/useReferenceData";

/**
 * Semester picker where the empty value means "the active semester". The empty option is shown as
 * "Active: <name>" — without `displayEmpty` + a shrunk label MUI renders "" as a blank field with
 * the label sitting inside it, which looked like nothing was selected.
 */
export default function SemesterSelect({
  value,
  onChange,
  sx,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation();
  const { data: semesters } = useSemesters();
  const activeSemester = semesters?.find((s) => s.is_active);
  return (
    <TextField
      select
      size="small"
      label={t("common.select_semester")}
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
      sx={{ minWidth: 200, ...sx }}
    >
      <MenuItem value="">
        {activeSemester ? `${t("common.active_prefix")} ${activeSemester.name}` : t("common.pick_semester")}
      </MenuItem>
      {(semesters ?? []).map((s) => (
        <MenuItem key={s.id} value={s.id}>
          {s.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
