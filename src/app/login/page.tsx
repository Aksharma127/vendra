import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { LoginForm } from "./LoginForm";
import { Panel } from "@/components/ui/Panel";

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-ink">Vendra</h1>
          <p className="text-sm text-graphite mt-1">Procurement & Vendor Operations Console</p>
        </div>
        <Panel className="p-6">
          <LoginForm />
        </Panel>
        <div className="mt-6 text-xs text-graphite space-y-1">
          <p>Demo accounts (password: vendra123):</p>
          <p>priya@vendra.demo (Employee) · rahul@vendra.demo (Division Manager)</p>
          <p>meera@vendra.demo (Finance) · arjun@vendra.demo (Procurement)</p>
          <p>zara@vendra.demo (Auditor) · admin@vendra.demo (Admin)</p>
        </div>
      </div>
    </div>
  );
}
