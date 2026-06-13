import type { ReactNode } from "react";

// Server-safe page header. Atlaskit's Heading relies on React context, so it can
// only run inside client components; data-fetching server pages use this instead.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--ds-text)",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p style={{ margin: "4px 0 0", color: "var(--ds-text-subtle)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
    </div>
  );
}
