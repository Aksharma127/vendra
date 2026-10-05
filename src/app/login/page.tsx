import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { LoginForm, type DemoAccount } from "./LoginForm";
import { Aurora } from "./Aurora";
import { DEMO_PASSWORD } from "@/db/ids";

// One per role, in the order a request moves through the workflow.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "priya@vendra.demo", name: "Priya Sharma", role: "Employee", does: "Raises requests" },
  { email: "rahul@vendra.demo", name: "Rahul Mehta", role: "Division Manager", does: "First approval" },
  { email: "meera@vendra.demo", name: "Meera Iyer", role: "Finance", does: "Final approval" },
  { email: "arjun@vendra.demo", name: "Arjun Nair", role: "Procurement", does: "Issues POs" },
  { email: "zara@vendra.demo", name: "Zara Khan", role: "Auditor", does: "Read-only, audit" },
  { email: "admin@vendra.demo", name: "System Admin", role: "Admin", does: "Users & setup only" },
];

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="flex-1 flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-accent flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div
          className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full drift-b"
          style={{ background: "radial-gradient(closest-side, rgba(45,190,175,0.35), rgba(45,190,175,0) 70%)" }}
        />
        <div
          className="absolute -bottom-32 -left-24 w-[32rem] h-[32rem] rounded-full drift-c"
          style={{ background: "radial-gradient(closest-side, rgba(150,110,230,0.32), rgba(150,110,230,0) 70%)" }}
        />
        <div className="relative animate-fade-in-up">
          <div className="w-9 h-9 rounded bg-white/15 flex items-center justify-center text-white font-semibold mb-8 backdrop-blur-sm">
            V
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Vendra</h1>
          <p className="text-sm text-white/70 mt-2 max-w-xs">
            Procurement &amp; Vendor Operations Console
          </p>
        </div>
        <div className="relative animate-fade-in-up text-white/60 text-xs" style={{ animationDelay: "80ms" }}>
          Multi-company · role-based access · full audit trail
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-hidden">
        <Aurora />
        <div className="w-full max-w-sm animate-fade-in-up relative">
          <div className="mb-8 lg:hidden">
            <h1 className="text-xl font-semibold text-ink">Vendra</h1>
            <p className="text-sm text-graphite mt-1">Procurement & Vendor Operations Console</p>
          </div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-ink">Sign in</h2>
            <p className="text-sm text-graphite mt-1">Enter your credentials to access the console.</p>
          </div>
          <LoginForm demoAccounts={DEMO_ACCOUNTS} demoPassword={DEMO_PASSWORD} />
        </div>
      </div>
    </div>
  );
}
