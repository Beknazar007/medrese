import { useContext } from "react";
import { ColorModeContext } from "../context/colorModeContext";

export function useColorMode() {
  return useContext(ColorModeContext);
}
