import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Build standalone: imagem Docker pequena para deploy no servidor.
  output: "standalone",
};

export default withNextIntl(nextConfig);
