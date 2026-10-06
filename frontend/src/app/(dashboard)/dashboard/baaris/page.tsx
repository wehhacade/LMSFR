import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Baaris" };

export default async function BaarisPage() {
  const initialNav = readModuleNavFromCookies("baaris", await cookies());
  return <ModuleWorkspace moduleId="baaris" initialNav={initialNav} />;
}
