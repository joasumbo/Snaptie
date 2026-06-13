import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  style?: CSSProperties;
};

// Lightweight surface card built on Atlassian design tokens (CSS variables),
// usable from both server and client components.
export function Card({ children, style }: Props) {
  return (
    <div
      style={{
        backgroundColor: "var(--ds-surface)",
        border: "1px solid var(--ds-border)",
        borderRadius: 8,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
