import type { ModuleId } from "@/lib/lmsbr/data";

/** Business module bucket for the permissions admin UI. */
export type PermModuleKey = ModuleId | "system";

export const PERM_MODULE_ORDER: PermModuleKey[] = [
  "amniga",
  "survey",
  "dhacdooyin",
  "hub",
  "baaris", "visitors",
  "usercontrol",
  "system",
];

export const PERM_MODULE_META: Record<
  PermModuleKey,
  { label: string; labelSo: string; icon: string; accent: string }
> = {
  amniga: { label: "Amniga", labelSo: "Amniga", icon: "shield", accent: "#e6b25c" },
  survey: { label: "Survey", labelSo: "Sahamin", icon: "clipboard", accent: "#3fd0b5" },
  dhacdooyin: { label: "Dhacdooyin", labelSo: "Dhacdooyin", icon: "calendar", accent: "#f0a04a" },
  hub: { label: "Hub-Kadhigis", labelSo: "Hub-Kadhigis", icon: "archive", accent: "#9d8ef5" },
  visitors: { label: "Visitors", labelSo: "Booqdeyaal", icon: "users", accent: "#c48a3a" },
  baaris: { label: "Baaris", labelSo: "Baaris", icon: "badge", accent: "#4db8a0" },
  usercontrol: {
    label: "User Control",
    labelSo: "Maamulka Isticmaalaha",
    icon: "users",
    accent: "#5b9fd4",
  },
  system: { label: "System", labelSo: "Nidaamka", icon: "box", accent: "#8b7cf6" },
};

/** Map Django app/model to the module tab shown in permissions UI. */
export function permModuleFor(app: string, model: string): PermModuleKey {
  switch (app) {
    case "suspects":
      return "amniga";
    case "surveys":
      return "survey";
    case "dhacdooyinka":
      return "dhacdooyin";
    case "hubkadhigis":
      return "hub";
    case "visitors":
      return "visitors";
    case "personnel":
      return "amniga";
    case "baaris":
      return "baaris";
    case "audit":
      return "usercontrol";
    case "auth":
      return "usercontrol";
    case "accounts":
      return model === "agent" ? "amniga" : "usercontrol";
    default:
      return "system";
  }
}

export function permModuleLabel(key: PermModuleKey, lang: "en" | "so"): string {
  const m = PERM_MODULE_META[key];
  return lang === "so" ? m.labelSo : m.label;
}
