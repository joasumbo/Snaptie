"use client";

import Button from "@atlaskit/button/new";
import Heading from "@atlaskit/heading";
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
      }}
    >
      <Heading size="xxlarge">Snaptie</Heading>
      <p
        style={{
          color: token("color.text.subtle"),
          maxWidth: 480,
          margin: 0,
          fontSize: 18,
          lineHeight: 1.5,
        }}
      >
        Interactive QR codes that let businesses turn a single scan into menus,
        guides, links and more.
      </p>
      <Button appearance="primary">Sign in</Button>
    </main>
  );
}
