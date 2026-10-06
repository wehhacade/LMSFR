import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Amniga" };

export default async function AmnigaPage() {
  const initialNav = readModuleNavFromCookies("amniga", await cookies());
  return <ModuleWorkspace moduleId="amniga" initialNav={initialNav} />;
}
