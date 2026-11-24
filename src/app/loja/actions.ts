"use server";

import { redirect } from "next/navigation";
import { comprarModelo } from "@/lib/loja";
import { comprarProduto } from "@/lib/envios";

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

// Comprar um produto enviado por correio, com a quantidade escolhida.
export async function comprarEnvio(formData: FormData): Promise<void> {
  const id = String(formData.get("produto") ?? "");
  const quantidade = Number(formData.get("quantidade") ?? 1);
  if (!/^[a-z0-9]{10,40}$/.test(id)) redirect("/loja");
  let pagamento: string;
  try {
    pagamento = await comprarProduto(id, quantidade);
  } catch (e) {
    console.error("[loja] comprar envio", id, e);
    redirect("/loja?erro=1");
  }
  redirect(`/pagar/${pagamento}`);
}
