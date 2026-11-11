"use server";

import { redirect } from "next/navigation";
import { comprarModelo } from "@/lib/loja";

// O botão Comprar da loja: cria o pagamento e leva à nossa página de pagamento.
export async function comprar(formData: FormData): Promise<void> {
  const id = String(formData.get("modelo") ?? "");
  if (!/^[a-z0-9]{10,40}$/.test(id)) redirect("/loja");
  let pagamento: string;
  try {
    pagamento = await comprarModelo(id);
  } catch (e) {
    console.error("[loja] comprar", id, e);
    redirect("/loja?erro=1");
  }
  redirect(`/pagar/${pagamento}`);
}
