import type { Metadata } from "next";
import "@atlaskit/css-reset";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Snaptie",
  description:
    "Interactive QR code platform that lets businesses turn a single scan into menus, guides, links and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-color-mode="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
