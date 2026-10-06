export type ThemeMode = "warm" | "navy" | "light";

export interface AppColors {
  bg0: string;
  bg1: string;
  bg2: string;
  bgTop: string;
  ink0: string;
  ink1: string;
  ink2: string;
  ink3: string;
  inkMut: string;
  lineRgb: string;
  hiRgb: string;
  surfRgb: string;
  surf2Rgb: string;
  surfnavRgb: string;
  surfdRgb: string;
  scrimRgb: string;
  gold: string;
  gold2: string;
  goldDeep: string;
  goldRgb: string;
  copperRgb: string;
  onGold: string;
  rose: string;
  roseRgb: string;
  green: string;
  glass: string;
}

const warm: AppColors = {
  bg0: "#0a0805",
  bg1: "#14100a",
  bg2: "#1d160d",
  bgTop: "#2a1d10",
  ink0: "#fbf3e2",
  ink1: "#e9dfca",
  ink2: "#b6a98a",
  ink3: "#6e6450",
  inkMut: "#8a7e62",
  lineRgb: "245, 230, 200",
  hiRgb: "255, 245, 225",
  surfRgb: "28, 22, 14",
  surf2Rgb: "40, 30, 18",
  surfnavRgb: "20, 16, 10",
  surfdRgb: "14, 10, 6",
  scrimRgb: "8, 6, 3",
  gold: "#e9c177",
  gold2: "#f0d59a",
  goldDeep: "#c89545",
  goldRgb: "233, 193, 119",
  copperRgb: "201, 122, 58",
  onGold: "#221706",
  rose: "#e87b6b",
  roseRgb: "232, 123, 107",
  green: "#7ad99e",
  glass: "rgba(28, 22, 14, 0.55)",
};

const navy: AppColors = {
  bg0: "#070F26",
  bg1: "#0B1838",
  bg2: "#12224B",
  bgTop: "#16294f",
  ink0: "#eef3fb",
  ink1: "#cfdaef",
  ink2: "#8d9dc0",
  ink3: "#54648c",
  inkMut: "#6f81a8",
  lineRgb: "206, 221, 250",
  hiRgb: "224, 234, 255",
  surfRgb: "16, 30, 64",
  surf2Rgb: "22, 40, 80",
  surfnavRgb: "11, 24, 56",
  surfdRgb: "8, 18, 44",
  scrimRgb: "4, 9, 24",
  gold: "#7ea6e6",
  gold2: "#a9c7f4",
  goldDeep: "#4f79c9",
  goldRgb: "126, 166, 230",
  copperRgb: "79, 121, 201",
  onGold: "#06122b",
  rose: "#e87b6b",
  roseRgb: "232, 123, 107",
  green: "#7ad99e",
  glass: "rgba(12, 24, 56, 0.55)",
};

const light: AppColors = {
  bg0: "#FDFCFA",
  bg1: "#F8F5EF",
  bg2: "#F0EDE5",
  bgTop: "#E8E4DA",
  ink0: "#1A150D",
  ink1: "#2E271C",
  ink2: "#5C5042",
  ink3: "#A09080",
  inkMut: "#7A6C5A",
  lineRgb: "60, 50, 35",
  hiRgb: "40, 30, 15",
  surfRgb: "248, 245, 238",
  surf2Rgb: "238, 234, 226",
  surfnavRgb: "244, 241, 233",
  surfdRgb: "228, 223, 212",
  scrimRgb: "30, 25, 15",
  gold: "#8A5E10",
  gold2: "#B07820",
  goldDeep: "#6B490D",
  goldRgb: "138, 94, 16",
  copperRgb: "170, 95, 40",
  onGold: "#FEFCF6",
  rose: "#C03530",
  roseRgb: "192, 53, 48",
  green: "#2A784E",
  glass: "rgba(248, 245, 238, 0.88)",
};

export const themes: Record<ThemeMode, AppColors> = { warm, navy, light };
export const brandHoney = warm;
export const rgba = (rgb: string, alpha: number) => `rgba(${rgb}, ${alpha})`;

export const THEME_STORAGE_KEY = "tiphone_theme";
