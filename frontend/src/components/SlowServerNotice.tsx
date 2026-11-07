import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** True once `active` has stayed true for `delayMs` — resets as soon as it turns false. */
function useIsSlow(active: boolean, delayMs = 4000): boolean {
  const [slowSince, setSlowSince] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlowSince(Date.now()), delayMs);
    return () => {
      clearTimeout(timer);
      setSlowSince(null);
    };
  }, [active, delayMs]);
  return active && slowSince !== null;
}

/**
 * The backend sleeps when idle (free hosting) and takes ~25-30 s to wake up. Without a word the
 * login button or the first screen just seemed frozen; after a few seconds we say what's going on.
 */
export function SlowServerAlert({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const slow = useIsSlow(active);
  if (!slow) return null;
  return <Alert severity="info">{t("common.server_waking")}</Alert>;
}

/** Full-screen loader for the app start (checking the saved login). */
export function FullScreenLoader() {
  const { t } = useTranslation();
  const slow = useIsSlow(true);
  return (
    <Box
      sx={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, px: 3 }}
      aria-busy="true"
    >
      <CircularProgress />
      {slow && (
        <Typography color="text.secondary" sx={{ textAlign: "center", maxWidth: 360 }}>
          {t("common.server_waking")}
        </Typography>
      )}
    </Box>
  );
}
