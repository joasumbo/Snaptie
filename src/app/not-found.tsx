import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, color: "#172B4D" }}>404</div>
      <p style={{ margin: 0, fontSize: 18, color: "#44546F" }}>
        Esta página não existe.
      </p>
      <Link
        href="/dashboard"
        style={{
          marginTop: 8,
          display: "inline-block",
          padding: "8px 16px",
          borderRadius: 6,
          backgroundColor: "#0052CC",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Voltar ao painel
      </Link>
    </main>
  );
}
