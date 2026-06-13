import type { Metadata } from "next";
import "@atlaskit/css-reset";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Snaptie",
  description:
    "Plataforma de QR codes interativos que transforma um único scan em menus, guias, links e muito mais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" data-color-mode="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
