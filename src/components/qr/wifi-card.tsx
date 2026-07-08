"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Wifi, Copy, Check } from "lucide-react";

// Escapes the characters that are special in the Wi-Fi QR payload format.
function esc(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

// A web button cannot join a network (browsers have no such API). The standard
// way to connect "directly" is the Wi-Fi QR format: pointing the phone camera at
// it makes iOS/Android offer to join the network.
export function WifiCard({
  titulo,
  descricao,
  ssid,
  password,
  color,
}: {
  titulo: string;
  descricao: string | null;
  ssid: string;
  password: string;
  color: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("Wifi");

  const payload = password
    ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;`
    : `WIFI:T:nopass;S:${esc(ssid)};;`;

  function copy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="rounded-xl px-4 py-4 text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center gap-3">
        <Wifi className="size-5 shrink-0 opacity-90" />
        <div className="min-w-0 text-left">
          <div className="truncate font-medium leading-tight">{titulo}</div>
          {descricao ? (
            <div className="truncate text-xs opacity-80">{descricao}</div>
          ) : null}
        </div>
      </div>

      {ssid ? (
        <>
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={payload} size={150} level="M" />
            </div>
            <p className="text-center text-xs opacity-90">
              {t("pointCamera")}
            </p>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-90">{t("network")}</span>
              <span className="font-medium">{ssid}</span>
            </div>
            {password ? (
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-90">{t("password")}</span>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                >
                  {password}
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm opacity-90">{t("notConfigured")}</div>
      )}
    </div>
  );
}
