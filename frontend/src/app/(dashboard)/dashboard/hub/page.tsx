import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Hub-Kadhigis" };

export default async function HubPage() {
  const initialNav = readModuleNavFromCookies("hub", await cookies());
  return <ModuleWorkspace moduleId="hub" initialNav={initialNav} />;
}
