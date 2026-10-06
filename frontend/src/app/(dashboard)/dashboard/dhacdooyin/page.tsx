import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Dhacdooyin" };

export default async function Dhacdooyin() {
  const initialNav = readModuleNavFromCookies("dhacdooyin", await cookies());
  return <ModuleWorkspace moduleId="dhacdooyin" initialNav={initialNav} />;
}
