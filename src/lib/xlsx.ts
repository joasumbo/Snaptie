import "server-only";

import { strToU8, zipSync } from "fflate";

// Um ficheiro Excel (.xlsx) mínimo: uma folha, cabeçalho a negrito e filtros,
// colunas com largura própria. Um .xlsx é um ZIP de XML; montá-lo à mão evita
// uma biblioteca pesada para uma coisa tão pequena.
//
// Porquê .xlsx e não CSV: o Excel em português usa ";" como separador, e um CSV
// com vírgulas abria tudo numa só coluna.

export type Celula = string | number | Date | null | undefined;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de controlo são proibidos no XML do Excel (quebras de linha não).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function coluna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Datas do Excel: dias desde 30/12/1899, contados na hora de Lisboa (o Excel
// não guarda fuso; mostra o número tal como está).
function serialExcel(d: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, Number(x.value)]),
  );
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return local / 86_400_000 + 25569;
}

function celula(ref: string, v: Celula, estilo: number): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return `<c r="${ref}" s="2"><v>${serialExcel(v)}</v></c>`;
  if (typeof v === "number") return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ""}><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

export function gerarXlsx(opts: {
  folha: string;
  colunas: { titulo: string; largura: number }[];
  linhas: Celula[][];
}): Uint8Array {
  const { colunas, linhas } = opts;
  const ultima = coluna(colunas.length - 1);
  const cabecalho = `<row r="1">${colunas.map((c, i) => celula(`${coluna(i)}1`, c.titulo, 1)).join("")}</row>`;
  const corpo = linhas
    .map((l, r) => `<row r="${r + 2}">${l.map((v, i) => celula(`${coluna(i)}${r + 2}`, v, 3)).join("")}</row>`)
    .join("");

  const folha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`).join("")}</cols>
<sheetData>${cabecalho}${corpo}</sheetData>
<autoFilter ref="A1:${ultima}${linhas.length + 1}"/>
</worksheet>`;

  // Estilos: 0 normal, 1 cabeçalho a negrito, 2 data e hora, 3 texto com quebra.
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const nomeFolha = esc(opts.folha.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nomeFolha}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nomeFolha}'!$A$1:$${ultima}$${linhas.length + 1}</definedName></definedNames>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(folha),
    "xl/styles.xml": strToU8(estilos),
  });
}
