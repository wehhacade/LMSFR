import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Survey" };

export default async function SurveyPage() {
  const initialNav = readModuleNavFromCookies("survey", await cookies());
  return <ModuleWorkspace moduleId="survey" initialNav={initialNav} />;
}
