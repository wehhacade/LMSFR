import type { Metadata } from "next";
import { StatusScreen } from "@/components/lmsbr/status-screen";

export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or the link is broken."
      actions={[
        { kind: "link", label: "Back to Dashboard", href: "/dashboard", variant: "primary" },
        { kind: "back", label: "Go Back", variant: "secondary" },
      ]}
    />
  );
}
