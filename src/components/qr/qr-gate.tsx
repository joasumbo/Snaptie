"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockQr } from "@/app/[empresa]/[codigo]/access-actions";

// Shown instead of the page when the QR is not open: the private mode asks for
// the PIN on every visit, the activation mode asks once, to claim the QR.
export default function QrGate({
  codigo,
  modo,
  nome,
}: {
  codigo: string;
  modo: "ativacao" | "privado";
  nome: string;
}) {
  const router = useRouter();
  const t = useTranslations("Gate");
  const tc = useTranslations("Common");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activating = modo === "ativacao";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await unlockQr(codigo, pin);
      if (!r.ok) {
        setError(t("invalidPin"));
        return;
      }
      router.refresh(); // the page renders for real now
    } catch {
      setError(tc("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
          {activating ? (
            <Sparkles className="size-6" />
          ) : (
            <Lock className="size-6" />
          )}
        </span>

        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {activating ? t("activateTitle") : t("privateTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activating ? t("activateHint", { nome }) : t("privateHint")}
          </p>
        </div>

        <div className="space-y-1.5 text-left">
          <Label htmlFor="access-pin">{t("pin")}</Label>
          <Input
            id="access-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin && !busy) submit();
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={busy || !pin.trim()}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {activating ? t("activate") : t("open")}
        </Button>
      </div>
    </div>
  );
}
