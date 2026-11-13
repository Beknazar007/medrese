import { Alert, Box, Button, Paper, TextField } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { settingsApi } from "../api/entities";
import { apiErrorMessage } from "../lib/errors";

function isValidThreshold(text: string): boolean {
  return /^\d+$/.test(text.trim()) && Number(text) >= 0 && Number(text) <= 60;
}

function ThresholdForm({ initial }: { initial: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(initial));
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const invalid = !isValidThreshold(value);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ late_threshold_minutes: Number(value) }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      // "Late" is computed from the current threshold for every period, so all figures change.
      queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-teacher-monitoring"] });
    },
  });

  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
      <TextField
        size="small"
        type="number"
        label={t("timeslots.late_threshold")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setTouched(true);
          setSaved(false);
        }}
        error={touched && invalid}
        helperText={touched && invalid ? t("timeslots.late_threshold_error") : " "}
        slotProps={{ htmlInput: { min: 0, max: 60, step: 1, inputMode: "numeric" } }}
        sx={{ width: { xs: "100%", sm: 240 } }}
      />
      <Button
        variant="contained"
        disabled={invalid || mutation.isPending}
        onClick={() => mutation.mutate()}
        sx={{ minHeight: 40, width: { xs: "100%", sm: "auto" } }}
      >
        {t("common.save")}
      </Button>
      {saved && (
        <Alert severity="success" sx={{ py: 0 }}>
          {t("common.saved")}
        </Alert>
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ py: 0 }}>
          {apiErrorMessage(mutation.error, t("common.failed_to_save"), t)}
        </Alert>
      )}
    </Box>
  );
}

/** The rector's late threshold, in minutes after the pair starts. */
export default function LateThresholdCard() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      {/* Mounted once the value is known, so the field starts with it instead of empty.
          No key on the value: remounting after a save would wipe the "saved" message. */}
      {data && <ThresholdForm initial={data.late_threshold_minutes} />}
    </Paper>
  );
}
