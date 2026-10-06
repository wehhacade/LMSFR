import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "Booqdeyaal / Visitors" };

export default async function VisitorsPage() {
  const initialNav = readModuleNavFromCookies("visitors", await cookies());
  return <ModuleWorkspace moduleId="visitors" initialNav={initialNav} />;
}
