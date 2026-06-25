"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await requestReset(email);
    setBusy(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo markClassName="size-7" />
        </div>
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 shadow-xl shadow-foreground/5">
          {sent ? (
            <div className="space-y-3 text-center">
              <h1 className="text-lg font-semibold">Verifique o seu email</h1>
              <p className="text-sm text-muted-foreground">
                Se existir uma conta com esse email, enviámos um link para repor a
                palavra-passe. O link expira em 1 hora.
              </p>
              <Button
                variant="outline"
                className="w-full"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Voltar ao início de sessão
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Recuperar palavra-passe</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Introduza o seu email e enviamos-lhe um link de recuperação.
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nome@empresa.pt"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
                <Button type="submit" className="h-9 w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  Enviar link
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <Link href="/login" className="text-muted-foreground hover:text-foreground">
                  Voltar ao início de sessão
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
