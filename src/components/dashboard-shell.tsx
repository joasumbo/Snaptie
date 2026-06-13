"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserRound,
  QrCode,
  LogOut,
  CircleUserRound,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { Logo } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout } from "@/app/dashboard/actions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[]; // when set, only these roles see the item
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  {
    href: "/dashboard/companies",
    label: "Empresas",
    icon: Building2,
    roles: ["ADMIN"],
  },
  {
    href: "/dashboard/qr-codes",
    label: "QR Codes",
    icon: QrCode,
    roles: ["ADMIN", "GESTOR_EMPRESA", "GESTOR_QR"],
  },
  {
    href: "/dashboard/users",
    label: "Utilizadores",
    icon: Users,
    roles: ["ADMIN", "GESTOR_EMPRESA"],
  },
  { href: "/dashboard/profile", label: "Perfil", icon: UserRound },
];

export default function DashboardShell({
  user,
  children,
}: {
  user: { nome: string; email: string; role: UserRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex h-16 items-center border-b px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Navegação
          </p>
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

        <div className="border-t p-4 text-xs text-muted-foreground">
          Snaptie · Plataforma de QR codes
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b bg-card px-6">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted aria-expanded:bg-muted" />
              }
            >
              <CircleUserRound className="size-5 text-muted-foreground" />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{user.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5">
                <div className="text-sm font-medium">{user.nome}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem nativeButton={false} render={<Link href="/dashboard/profile" />}>
                <UserRound />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => logout()}>
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
