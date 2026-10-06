import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Dhacdooyin" };

export default async function DhacdooyinVictimProfilePage({
  params,
}: {
  params: Promise<{ id: string; victimId: string }>;
}) {
  const { id, victimId } = await params;
  const eventId = parseInt(id, 10);
  const parsedVictimId = parseInt(victimId, 10);
  const initialNav = readModuleNavFromCookies("dhacdooyin", await cookies());
  return (
    <ModuleWorkspace
      moduleId="dhacdooyin"
      initialNav={initialNav}
      initialDhacdoProfileId={isNaN(eventId) ? undefined : eventId}
      initialDhacdoVictimId={isNaN(parsedVictimId) ? undefined : parsedVictimId}
    />
  );
}
