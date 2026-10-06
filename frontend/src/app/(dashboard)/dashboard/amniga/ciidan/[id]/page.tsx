import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Agent Profile" };

export default async function AmnigaAgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  const initialNav = readModuleNavFromCookies("amniga", await cookies());
  return (
    <ModuleWorkspace
      moduleId="amniga"
      initialNav={{
        ...initialNav,
        activeMenu: "forces",
        openSubs: { ...initialNav.openSubs, forces: true },
      }}
      initialAgentProfileId={Number.isFinite(agentId) ? agentId : undefined}
    />
  );
}
