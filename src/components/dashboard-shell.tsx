"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Heading from "@atlaskit/heading";
import Lozenge from "@atlaskit/lozenge";
import Button from "@atlaskit/button/new";
import { token } from "@atlaskit/tokens";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import PersonIcon from "@atlaskit/icon/core/person-avatar";
import SignOutIcon from "@atlaskit/icon/core/log-out";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { logout } from "@/app/dashboard/actions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: DashboardIcon },
  { href: "/dashboard/users", label: "Utilizadores", icon: PeopleGroupIcon },
  { href: "/dashboard/profile", label: "Perfil", icon: PersonIcon },
];

type Props = {
  user: { nome: string; email: string; role: UserRole };
  children: React.ReactNode;
};

export default function DashboardShell({ user, children }: Props) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 248,
          flexShrink: 0,
          borderRight: `1px solid ${token("color.border")}`,
          backgroundColor: token("elevation.surface"),
          display: "flex",
          flexDirection: "column",
          padding: token("space.300"),
          gap: token("space.300"),
        }}
      >
        <div style={{ padding: `${token("space.100")} ${token("space.150")}` }}>
          <Heading size="medium">Snaptie</Heading>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: token("space.050") }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: token("space.150"),
                  padding: `${token("space.150")} ${token("space.150")}`,
                  borderRadius: token("radius.small"),
                  textDecoration: "none",
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? token("color.text.selected")
                    : token("color.text"),
                  backgroundColor: active
                    ? token("color.background.selected")
                    : "transparent",
                }}
              >
                <Icon label="" color="currentColor" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: token("space.200"),
            height: 64,
            padding: `0 ${token("space.400")}`,
            borderBottom: `1px solid ${token("color.border")}`,
            backgroundColor: token("elevation.surface"),
          }}
        >
          <div style={{ textAlign: "right", lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600 }}>{user.nome}</div>
            <div style={{ fontSize: 12, color: token("color.text.subtle") }}>
              {user.email}
            </div>
          </div>
          <Lozenge>{ROLE_LABELS[user.role]}</Lozenge>
          <form action={logout}>
            <Button
              type="submit"
              appearance="subtle"
              iconBefore={() => <SignOutIcon label="" color="currentColor" />}
            >
              Sair
            </Button>
          </form>
        </header>

        <main
          style={{
            flex: 1,
            padding: token("space.400"),
            backgroundColor: token("elevation.surface.sunken"),
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
