import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModuleWorkspace } from "@/components/lmsbr/module-workspace";
import { readModuleNavFromCookies } from "@/lib/lmsbr/module-nav-persist";

export const metadata: Metadata = { title: "User Control" };

export default async function UserControlPage() {
  const initialNav = readModuleNavFromCookies("usercontrol", await cookies());
  return <ModuleWorkspace moduleId="usercontrol" initialNav={initialNav} />;
}
