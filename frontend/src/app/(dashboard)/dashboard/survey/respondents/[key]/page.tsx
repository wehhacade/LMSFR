import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Respondent Profile" };

export default async function SurveyRespondentProfileRoute({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const respondentKey = decodeURIComponent(key);
  const initialNav = readModuleNavFromCookies("survey", await cookies());
  const nav = { ...initialNav, activeMenu: "settings" as const };

  return (
    <ModuleWorkspace
      moduleId="survey"
      initialNav={nav}
      initialSurveyRespondentKey={respondentKey || undefined}
    />
  );
}
