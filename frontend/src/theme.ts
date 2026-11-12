import { createTheme, type PaletteMode } from "@mui/material/styles";

/** Color of the app bar / browser chrome per mode (also used for <meta name="theme-color">). */
export const BAR_COLOR: Record<PaletteMode, string> = { light: "#2f5fb3", dark: "#1a1d22" };

export const makeTheme = (mode: PaletteMode) => createTheme({
  palette:
    mode === "light"
      ? {
          mode,
          primary: { main: "#2f5fb3" },
          // Light grey page behind white cards/tables, so sections read as separate blocks.
          background: { default: "#f5f6f8", paper: "#fff" },
        }
      : {
          mode,
          // A lighter blue: the light theme's #2f5fb3 is too dim as text on a dark page.
          primary: { main: "#7ea6ee" },
          // Same idea at night: the page a step darker than the cards on it.
          background: { default: "#121417", paper: "#1a1d22" },
        },
  shape: { borderRadius: 8 },
  typography: {
    // h5 = page titles, h6 = section titles: one responsive size here instead of per page.
    h5: { fontWeight: 600, fontSize: "1.25rem", "@media (min-width:600px)": { fontSize: "1.5rem" } },
    h6: { fontWeight: 600, fontSize: "1.05rem", "@media (min-width:600px)": { fontSize: "1.2rem" } },
    // ALL-CAPS Cyrillic ("ӨЗГӨРТҮҮ") is hard to read; sentence case everywhere.
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiAppBar: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundColor: BAR_COLOR[mode], color: "#fff" } } },
    MuiTableCell: { styleOverrides: { head: ({ theme }) => ({ fontWeight: 600, color: theme.palette.text.secondary }) } },
    MuiDialog: {
      styleOverrides: {
        // Full-screen dialogs (phones) cover the whole viewport, and with viewport-fit=cover
        // that includes the notch/status bar and the home indicator — keep content clear of both.
        paperFullScreen: {
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        },
      },
    },
    MuiSnackbar: {
      // At the bottom a message covered the full-screen dialogs' button bar («Жабуу», «Сактоо») for
      // seconds right after saving (finding B12). Top, below the notch, covers nothing you press.
      defaultProps: { anchorOrigin: { vertical: "top", horizontal: "center" } },
      styleOverrides: {
        anchorOriginTopCenter: ({ theme }) => ({
          top: "calc(8px + env(safe-area-inset-top))",
          [theme.breakpoints.up("sm")]: { top: "calc(24px + env(safe-area-inset-top))" },
        }),
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        // On a full-screen dialog the actions become a bottom bar of equal, thumb-sized buttons
        // instead of two small text buttons squeezed into the corner.
        root: {
          ".MuiDialog-paperFullScreen > &": {
            padding: "12px 16px",
            gap: 12,
            borderTop: `1px solid ${mode === "light" ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"}`,
            "& > .MuiButton-root": { flex: 1, minHeight: 44, marginLeft: 0 },
          },
        },
      },
    },
  },
});
