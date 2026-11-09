import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider, type PaletteMode } from "@mui/material/styles";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { paletteCssVars } from "../lib/palette";
import { BAR_COLOR, makeTheme } from "../theme";
import { ColorModeContext } from "./colorModeContext";

const STORAGE_KEY = "color_mode";

function readStored(): PaletteMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Light or dark (night) theme: follows the phone/computer setting until the user picks one in the header. */
export default function ColorModeProvider({ children }: { children: ReactNode }) {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const [chosen, setChosen] = useState<PaletteMode | null>(readStored);
  const mode: PaletteMode = chosen ?? (systemDark ? "dark" : "light");

  const value = useMemo(
    () => ({
      mode,
      toggle: () => {
        const next: PaletteMode = mode === "dark" ? "light" : "dark";
        setChosen(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Private mode etc.: the choice just lasts until the page reloads.
        }
      },
    }),
    [mode],
  );
  const theme = useMemo(() => makeTheme(mode), [mode]);

  // Phone status bar / installed-app title bar follow the theme too.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[mode]);
  }, [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <GlobalStyles styles={{ ":root": paletteCssVars(mode) }} />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
