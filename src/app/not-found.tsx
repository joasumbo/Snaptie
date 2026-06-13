import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-gradient-to-br from-foreground to-foreground/40 bg-clip-text text-7xl font-bold text-transparent">
        404
      </div>
      <p className="text-lg text-muted-foreground">Esta página não existe.</p>
      <Button render={<Link href="/dashboard" />} className="mt-2">
        Voltar ao painel
      </Button>
    </main>
  );
}
