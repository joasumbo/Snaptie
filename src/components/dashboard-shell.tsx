"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserRound,
  LogOut,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "@/app/dashboard/actions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  {
    href: "/dashboard/companies",
    label: "Empresas",
    icon: Building2,
    adminOnly: true,
  },
  { href: "/dashboard/users", label: "Utilizadores", icon: Users },
  { href: "/dashboard/profile", label: "Perfil", icon: UserRound },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function DashboardShell({
  user,
  children,
}: {
  user: { nome: string; email: string; role: UserRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.role === "ADMIN");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-64 shrink-0 flex-col gap-6 border-r bg-card p-4">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <QrCode className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Snaptie</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-foreground/[0.06] ring-1 ring-foreground/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <Icon className="relative z-10 size-4" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-3 border-b bg-card px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
              {initials(user.nome)}
            </div>
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.nome}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut />
              Sair
            </Button>
          </form>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
