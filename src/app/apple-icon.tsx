import { ImageResponse } from "next/og";
import { MarcaOg } from "@/components/brand/marca-og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 180, height: 180, alignItems: "center", justifyContent: "center", backgroundColor: "#18181b" }}>
        <MarcaOg tamanho={130} cor="#ffffff" fundo="#18181b" />
      </div>
    ),
    size,
  );
}
