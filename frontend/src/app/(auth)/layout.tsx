import { LangProvider } from "@/components/lmsbr/lang-ctx";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
