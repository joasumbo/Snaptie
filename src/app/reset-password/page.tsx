"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "./actions";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setBusy(true);
    const result = await resetPassword({ token, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success("Palavra-passe alterada. Inicie sessão.");
    router.replace("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo markClassName="size-7" />
        </div>
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 shadow-xl shadow-foreground/5">
          <h1 className="text-lg font-semibold">Nova palavra-passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina a sua nova palavra-passe.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {!token ? (
            <div className="mt-4 text-sm text-muted-foreground">
              Ligação inválida.{" "}
              <Link href="/forgot-password" className="text-primary hover:underline">
                Pedir um novo link
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova palavra-passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar palavra-passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <Button type="submit" className="h-9 w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Alterar palavra-passe
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
