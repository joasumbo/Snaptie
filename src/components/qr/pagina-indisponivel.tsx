import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";

export default async function PaginaIndisponivel() {
  const t = await getTranslations("PublicPage");
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="max-w-sm text-center">
        <Clock className="mx-auto size-10 text-zinc-300" />
        <h1 className="mt-4 text-lg font-semibold text-zinc-900">{t("unavailableTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t("unavailableText")}</p>
        <p className="mt-10 text-xs text-zinc-400">Snaptie</p>
      </div>
    </main>
  );
}
