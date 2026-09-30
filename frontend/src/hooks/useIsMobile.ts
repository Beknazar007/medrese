import { useMediaQuery, useTheme } from "@mui/material";

/** Phone-sized screen (below MUI's "sm", 600px) — big dialogs go full-screen there. */
export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}
