import type { Metadata } from "next";
import { Launcher } from "@/components/lmsbr/launcher";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <Launcher />;
}
