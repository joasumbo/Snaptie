"use client";

import { LinkButton } from "@atlaskit/button/new";
import { token } from "@atlaskit/tokens";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: token("space.300"),
        padding: token("space.400"),
        textAlign: "center",
        background: `linear-gradient(180deg, ${token(
          "elevation.surface",
        )} 0%, ${token("elevation.surface.sunken")} 100%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: token("space.150"),
          marginBottom: token("space.100"),
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: token("radius.small"),
            backgroundColor: token("color.background.brand.bold"),
          }}
          aria-hidden
        />
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Snaptie
        </span>
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          maxWidth: 600,
          lineHeight: 1.15,
        }}
      >
        QR codes interativos para empresas
      </h1>
      <p
        style={{
          color: token("color.text.subtle"),
          maxWidth: 480,
          margin: 0,
          fontSize: 18,
          lineHeight: 1.5,
        }}
      >
        Transforme um único scan em menus, guias, links e muito mais, e atualize
        o conteúdo a qualquer momento sem reimprimir nada.
      </p>

      <div style={{ marginTop: token("space.200") }}>
        <LinkButton href="/login" appearance="primary">
          Iniciar sessão
        </LinkButton>
      </div>
    </main>
  );
}
