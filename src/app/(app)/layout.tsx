import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar ctx={ctx} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header ctx={ctx} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
