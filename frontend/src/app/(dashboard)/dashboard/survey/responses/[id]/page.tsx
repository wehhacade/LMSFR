import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Response Profile" };

export default async function SurveyResponseProfileRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const responseId = parseInt(id, 10);
  const initialNav = readModuleNavFromCookies("survey", await cookies());
  const nav = { ...initialNav, activeMenu: "responses" as const };

  return (
    <ModuleWorkspace
      moduleId="survey"
      initialNav={nav}
      initialSurveyResponseId={Number.isNaN(responseId) ? undefined : responseId}
    />
  );
}
