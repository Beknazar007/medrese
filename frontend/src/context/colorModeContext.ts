import { createContext } from "react";
import type { PaletteMode } from "@mui/material/styles";

export interface ColorModeValue {
  mode: PaletteMode;
  toggle: () => void;
}

export const ColorModeContext = createContext<ColorModeValue>({ mode: "light", toggle: () => {} });
