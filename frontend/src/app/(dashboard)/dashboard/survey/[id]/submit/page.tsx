import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Submit Survey Response" };

export default async function SurveySubmitRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const surveyId = parseInt(id, 10);
  const initialNav = readModuleNavFromCookies("survey", await cookies());
  return (
    <ModuleWorkspace
      moduleId="survey"
      initialNav={initialNav}
      initialSurveyProfileId={isNaN(surveyId) ? undefined : surveyId}
      initialSurveySubmit
    />
  );
}
