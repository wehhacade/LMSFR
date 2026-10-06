import type { Metadata } from "next";
import { StatusScreen } from "@/components/lmsbr/status-screen";
import { getModules, type ModuleId } from "@/lib/lmsbr/data";

export const metadata: Metadata = { title: "Access Denied" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleId } = await searchParams;
  const moduleName = moduleId ? getModules("en")[moduleId as ModuleId]?.name : undefined;
  const description = moduleName
    ? `You don't have permission to access ${moduleName}. If you think this is a mistake, contact an administrator to request access.`
    : "You don't have permission to view this page. If you think this is a mistake, contact an administrator to request access.";

  return (
    <StatusScreen
      code="403"
      title="Access denied"
      description={description}
      actions={[
        { kind: "link", label: "Back to Dashboard", href: "/dashboard", variant: "primary" },
        { kind: "back", label: "Go Back", variant: "secondary" },
      ]}
    />
  );
}
