import "server-only";

import path from "node:path";
import { Document, Font, Page, StyleSheet, Svg, Rect, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Emissor } from "@/lib/configuracao";

// O comprovativo que segue em anexo depois de cada pagamento. É nosso de uma
// ponta à outra: o Stripe processa o dinheiro, mas não emite nem envia nada.

const FONTES = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTES, "Geist-400.woff"), fontWeight: 400 },
    { src: path.join(FONTES, "Geist-600.woff"), fontWeight: 600 },
    { src: path.join(FONTES, "Geist-800.woff"), fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((palavra) => [palavra]);

const TINTA = "#18181b";
const CINZA = "#71717a";
const LINHA = "#e4e4e7";
const MARCA = "#4f46e5";

const s = StyleSheet.create({
  pagina: { fontFamily: "Geist", fontSize: 9.5, color: TINTA, paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48 },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  marca: { flexDirection: "row", alignItems: "center", gap: 7 },
  nomeMarca: { fontSize: 15, fontWeight: 600, letterSpacing: -0.2 },
  doc: { alignItems: "flex-end" },
  docTitulo: { fontSize: 15, fontWeight: 600 },
  docNumero: { marginTop: 3, color: CINZA },
  faixa: { marginTop: 26, height: 3, backgroundColor: MARCA, width: 42 },
  partes: { flexDirection: "row", marginTop: 22, gap: 24 },
  parte: { flex: 1 },
  rotulo: { fontSize: 7.5, fontWeight: 600, color: CINZA, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  forte: { fontWeight: 600 },
  linhaTexto: { marginTop: 2, color: "#3f3f46" },
  datas: { flexDirection: "row", marginTop: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINHA },
  data: { flex: 1, paddingVertical: 9 },
  tabela: { marginTop: 24 },
  cab: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderColor: TINTA },
  cabTexto: { fontSize: 7.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 },
  item: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderColor: LINHA },
  colDesc: { flex: 1, paddingRight: 12 },
  colQtd: { width: 50, textAlign: "right" },
  colValor: { width: 80, textAlign: "right" },
  totais: { marginTop: 14, alignSelf: "flex-end", width: 220 },
  totalLinha: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderColor: TINTA },
  totalValor: { fontSize: 14, fontWeight: 800 },
  pago: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#f4f4f5",
  },
  selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, backgroundColor: "#047857", color: "#ffffff", fontSize: 8, fontWeight: 600, letterSpacing: 0.6 },
  rodape: { position: "absolute", left: 48, right: 48, bottom: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: CINZA, borderTopWidth: 1, borderColor: LINHA, paddingTop: 8 },
});

// O símbolo do Snaptie (os três cantos de um QR e os módulos), o mesmo do
// site, desenhado aqui para o PDF não depender de imagens.
function Simbolo() {
  const canto = (x: number, y: number) => [
    <Rect key={`c${x}${y}`} x={x} y={y} width={7} height={7} rx={2.2} stroke={TINTA} strokeWidth={1.7} fill="none" />,
    <Rect key={`m${x}${y}`} x={x + 2.4} y={y + 2.4} width={2.2} height={2.2} rx={0.7} fill={TINTA} />,
  ];
  const modulos = [
    [14.3, 14.3],
    [19.1, 14.3],
    [16.7, 16.7],
    [14.3, 19.1],
    [19.1, 19.1],
  ];
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {canto(2.5, 2.5)}
      {canto(14.5, 2.5)}
      {canto(2.5, 14.5)}
      {modulos.map(([x, y]) => (
        <Rect key={`d${x}${y}`} x={x} y={y} width={2.4} height={2.4} rx={0.7} fill={TINTA} />
      ))}
    </Svg>
  );
}

export type DadosComprovativo = {
  numero: string;
  pagoEm: Date;
  descricao: string;
  detalhe: string | null; // período da subscrição, página de onde veio, etc.
  valorCentimos: number;
  moeda: string;
  metodo: string | null;
  referencia: string;
  cliente: { nome: string | null; nif: string | null; morada: string | null; email: string | null };
  emissor: Emissor;
};

function dinheiro(centimos: number, moeda: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: moeda.toUpperCase() }).format(centimos / 100);
}

function dia(d: Date) {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Lisbon" });
}

function Comprovativo({ d }: { d: DadosComprovativo }) {
  const valor = dinheiro(d.valorCentimos, d.moeda);
  return (
    <Document title={`Comprovativo ${d.numero}`} author={d.emissor.nome} creator="Snaptie" producer="Snaptie">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo}>
          <View style={s.marca}>
            <Simbolo />
            <Text style={s.nomeMarca}>Snaptie</Text>
          </View>
          <View style={s.doc}>
            <Text style={s.docTitulo}>Comprovativo de pagamento</Text>
            <Text style={s.docNumero}>N.º {d.numero}</Text>
          </View>
        </View>
        <View style={s.faixa} />

        <View style={s.partes}>
          <View style={s.parte}>
            <Text style={s.rotulo}>Recebido por</Text>
            <Text style={s.forte}>{d.emissor.nome}</Text>
            {d.emissor.nif ? <Text style={s.linhaTexto}>NIF {d.emissor.nif}</Text> : null}
            {d.emissor.morada ? <Text style={s.linhaTexto}>{d.emissor.morada}</Text> : null}
            {d.emissor.email ? <Text style={s.linhaTexto}>{d.emissor.email}</Text> : null}
          </View>
          <View style={s.parte}>
            <Text style={s.rotulo}>Pago por</Text>
            <Text style={s.forte}>{d.cliente.nome || d.cliente.email || "Cliente"}</Text>
            {d.cliente.nif ? <Text style={s.linhaTexto}>NIF {d.cliente.nif}</Text> : null}
            {d.cliente.morada ? <Text style={s.linhaTexto}>{d.cliente.morada}</Text> : null}
            {d.cliente.nome && d.cliente.email ? <Text style={s.linhaTexto}>{d.cliente.email}</Text> : null}
          </View>
        </View>

        <View style={s.datas}>
          <View style={s.data}>
            <Text style={s.rotulo}>Data do pagamento</Text>
            <Text>{dia(d.pagoEm)}</Text>
          </View>
          <View style={s.data}>
            <Text style={s.rotulo}>Método</Text>
            <Text>{d.metodo ?? "Pagamento online"}</Text>
          </View>
          <View style={s.data}>
            <Text style={s.rotulo}>Referência</Text>
            <Text>{d.referencia}</Text>
          </View>
        </View>

        <View style={s.tabela}>
          <View style={s.cab}>
            <Text style={[s.cabTexto, s.colDesc]}>Descrição</Text>
            <Text style={[s.cabTexto, s.colQtd]}>Qtd.</Text>
            <Text style={[s.cabTexto, s.colValor]}>Valor</Text>
          </View>
          <View style={s.item}>
            <View style={s.colDesc}>
              <Text style={s.forte}>{d.descricao}</Text>
              {d.detalhe ? <Text style={[s.linhaTexto, { color: CINZA }]}>{d.detalhe}</Text> : null}
            </View>
            <Text style={s.colQtd}>1</Text>
            <Text style={s.colValor}>{valor}</Text>
          </View>
        </View>

        <View style={s.totais}>
          <View style={s.totalLinha}>
            <Text style={{ color: CINZA }}>Subtotal</Text>
            <Text>{valor}</Text>
          </View>
          <View style={s.totalFinal}>
            <Text style={s.forte}>Total pago</Text>
            <Text style={s.totalValor}>{valor}</Text>
          </View>
        </View>

        <View style={s.pago}>
          <Text style={s.selo}>PAGO</Text>
          <Text style={{ color: "#3f3f46", flex: 1 }}>
            Recebemos {valor} a {dia(d.pagoEm)}. Obrigado pela confiança.
          </Text>
        </View>

        <View style={s.rodape} fixed>
          <Text>Comprovativo de pagamento. Não substitui a fatura.</Text>
          <Text>mysnaptie.com</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function gerarComprovativo(d: DadosComprovativo): Promise<Buffer> {
  return renderToBuffer(<Comprovativo d={d} />);
}
