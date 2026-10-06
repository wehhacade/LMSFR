"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/lmsbr/status-screen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const staleBuild =
    error.message?.toLowerCase().includes("chunkloaderror")
    || error.message?.toLowerCase().includes("loading chunk")
    || error.message?.toLowerCase().includes("dynamically imported module");

  return (
    <StatusScreen
      code="500"
      title={staleBuild ? "New version available" : "Something went wrong"}
      description={
        staleBuild
          ? "The app was updated while you had it open. Reload the page to load the latest version."
          : "An unexpected error occurred while loading this page. Try again, or head back to the dashboard."
      }
      reference={error.digest}
      actions={[
        { kind: "button", label: "Try Again", onClick: reset, variant: "primary" },
        { kind: "link", label: "Back to Dashboard", href: "/dashboard", variant: "secondary" },
      ]}
    />
  );
}
