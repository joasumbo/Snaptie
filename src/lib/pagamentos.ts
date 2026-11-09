// Partes dos pagamentos que também correm no browser (formulários e listas).

export const INTERVALOS = ["mes", "ano", "unico"] as const;
export type Intervalo = (typeof INTERVALOS)[number];

export const NOMES_INTERVALO: Record<Intervalo, string> = {
  mes: "por mês",
  ano: "por ano",
  unico: "pagamento único",
};

export function euros(centimos: number, moeda = "eur"): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: moeda.toUpperCase() }).format(
    centimos / 100,
  );
}

export const NOMES_ESTADO_PAGAMENTO: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  falhou: "Falhou",
  expirado: "Expirado",
};

export const NOMES_ESTADO_SUBSCRICAO: Record<string, string> = {
  ativa: "Ativa",
  em_falta: "Pagamento em falta",
  cancelada: "Cancelada",
  unico: "Paga (pagamento único)",
  suspensa: "Suspensa por falta de pagamento",
  a_cancelar: "Cancela no fim do período",
};

// O elemento Pagamento: o visitante paga um valor fixo, ou escolhe quanto.
export const PAGAMENTO_MIN_CENTIMOS = 100;
export const PAGAMENTO_MAX_CENTIMOS = 1_000_000;

export type ConteudoPagamento = {
  valorCentimos: number;
  valorLivre: boolean;
  textoBotao: string;
};

export function lerPagamento(c: Record<string, unknown>): ConteudoPagamento {
  const v = Number(c.valorCentimos);
  return {
    valorCentimos: Number.isInteger(v) && v > 0 ? v : 0,
    valorLivre: c.valorLivre === true,
    textoBotao: typeof c.textoBotao === "string" ? c.textoBotao : "",
  };
}
