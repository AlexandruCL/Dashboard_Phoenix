import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s.discordId || !s.level) redirect("/login");
  return <Shell me={{ name: s.name ?? "", level: s.level }}>{children}</Shell>;
}
