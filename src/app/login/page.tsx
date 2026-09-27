import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { LoginForm } from "./LoginForm";

const DEMO_ACCOUNTS = [
  { email: "priya@vendra.demo", role: "Employee" },
  { email: "rahul@vendra.demo", role: "Division Manager" },
  { email: "meera@vendra.demo", role: "Finance" },
  { email: "arjun@vendra.demo", role: "Procurement" },
  { email: "zara@vendra.demo", role: "Auditor" },
  { email: "admin@vendra.demo", role: "Admin" },
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
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 animate-fade-in"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)" }}
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
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="mb-8 lg:hidden">
            <h1 className="text-xl font-semibold text-ink">Vendra</h1>
            <p className="text-sm text-graphite mt-1">Procurement & Vendor Operations Console</p>
          </div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-ink">Sign in</h2>
            <p className="text-sm text-graphite mt-1">Enter your credentials to access the console.</p>
          </div>
          <div className="bg-surface border border-line rounded-lg p-6 shadow-sm panel-interactive">
            <LoginForm />
          </div>
          <div className="mt-6 rounded-lg border border-line bg-surface/60 p-4">
            <p className="text-xs font-medium text-graphite mb-2">Demo accounts · password vendra123</p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((acct) => (
                <span
                  key={acct.email}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-page-bg px-2.5 py-1 text-[11px] text-graphite font-mono"
                >
                  {acct.email}
                  <span className="text-graphite/60 font-sans">· {acct.role}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
