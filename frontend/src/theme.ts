import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2f5fb3" },
  },
  shape: { borderRadius: 8 },
  components: {
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
    MuiDialogActions: {
      styleOverrides: {
        // On a full-screen dialog the actions become a bottom bar of equal, thumb-sized buttons
        // instead of two small text buttons squeezed into the corner.
        root: {
          ".MuiDialog-paperFullScreen > &": {
            padding: "12px 16px",
            gap: 12,
            borderTop: "1px solid rgba(0, 0, 0, 0.12)",
            "& > .MuiButton-root": { flex: 1, minHeight: 44, marginLeft: 0 },
          },
        },
      },
    },
  },
});
