"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ColorPalette = "gold" | "navy";

const ColorPaletteCtx = createContext<{
  palette: ColorPalette;
  setPalette: (p: ColorPalette) => void;
  toggle: () => void;
}>({ palette: "navy", setPalette: () => {}, toggle: () => {} });

export function ColorPaletteProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>("navy");

  useEffect(() => {
    const raw = localStorage.getItem("lmsbr-palette");
    if (raw === "gold" || raw === "navy") {
      setPaletteState(raw);
      return;
    }
    if (raw === "light") {
      localStorage.setItem("lmsbr-palette", "navy");
      setPaletteState("navy");
    }
  }, []);

  const setPalette = (p: ColorPalette) => {
    setPaletteState(p);
    localStorage.setItem("lmsbr-palette", p);
    document.documentElement.setAttribute("data-palette", p);
  };

  const toggle = () => setPalette(palette === "gold" ? "navy" : "gold");

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  return (
    <ColorPaletteCtx.Provider value={{ palette, setPalette, toggle }}>
      {children}
    </ColorPaletteCtx.Provider>
  );
}

export function useColorPalette() {
  return useContext(ColorPaletteCtx);
}
