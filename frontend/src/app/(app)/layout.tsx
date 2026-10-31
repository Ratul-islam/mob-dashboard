"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  Database,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStoredState } from "@/lib/useStoredState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, IconButton, Spinner } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Live dashboard", icon: Activity },
  { href: "/raw", label: "Raw data", icon: Database },
  { href: "/users", label: "Users", icon: Users, rootOnly: true },
  { href: "/account", label: "My account", icon: UserCog },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useStoredState("sidebar-collapsed", false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (user?.mustChangePassword && !pathname.startsWith("/account")) {
      router.replace("/account?setup=1");
    } else if (user && user.role !== "root" && pathname.startsWith("/users")) {
      router.replace("/dashboard");
    }
  }, [status, user, pathname, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  // `compact` renders the icon-only variant used by the collapsed desktop sidebar.
  const renderNav = (compact: boolean) => (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((item) => !item.rootOnly || user.role === "root").map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setNavOpen(false)}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            className={clsx(
              "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition",
              active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className={clsx(compact && "sr-only")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const renderAccount = (compact: boolean) => (
    <div className={clsx("flex items-center gap-2 border-t border-line pt-3", compact && "flex-col")}>
      <div
        title={compact ? `${user.name} · ${user.email}` : undefined}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-ink-2"
      >
        {user.name.slice(0, 1).toUpperCase()}
      </div>
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{user.name}</span>
            {user.role === "root" && <Badge tone="accent">root</Badge>}
          </div>
          <div className="truncate text-xs text-muted">{user.email}</div>
        </div>
      )}
      <IconButton label="Sign out" onClick={() => logout().then(() => router.replace("/login"))}>
        <LogOut className="size-4" />
      </IconButton>
    </div>
  );

  const renderBrand = (compact: boolean) => (
    <div className="flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <ShieldCheck className="size-4" aria-hidden />
      </span>
      {!compact && <span className="whitespace-nowrap text-sm font-semibold tracking-tight">Traffic Dashboard</span>}
    </div>
  );

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div
      className={clsx(
        "min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-200",
        collapsed ? "lg:grid-cols-[60px_1fr]" : "lg:grid-cols-[232px_1fr]",
      )}
    >
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-hidden border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className={clsx("flex items-center", collapsed ? "flex-col gap-3" : "justify-between px-1")}>
          {renderBrand(collapsed)}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2 text-ink shadow-sm transition hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CollapseIcon className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-between">
          {renderNav(collapsed)}
          <ThemeToggle />
        </div>
        {renderAccount(collapsed)}
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        {renderBrand(false)}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <IconButton label="Open menu" onClick={() => setNavOpen(true)}>
            <Menu className="size-4" />
          </IconButton>
        </div>
      </header>
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col gap-6 bg-surface p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              {renderBrand(false)}
              <IconButton label="Close menu" onClick={() => setNavOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="flex-1">{renderNav(false)}</div>
            {renderAccount(false)}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
    </div>
  );
}
