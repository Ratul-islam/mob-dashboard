import { ShieldCheck } from "lucide-react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-ink">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <ShieldCheck className="size-4.5" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">Traffic Dashboard</span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
