// Há quanto tempo foi, na forma curta que se espera num mural: segundos na
// primeira minuto, minutos até uma hora, horas até um dia, e daí em diante a
// data. Passada a primeira volta ao relógio, saber que foi "há 37 horas" já
// não diz nada a ninguém; a data diz.
export function tempoRelativo(iso: string, agora: number, locale: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const segundos = Math.max(0, Math.round((agora - t) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (segundos < 60) return rtf.format(-segundos, "second");

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return rtf.format(-minutos, "minute");

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return rtf.format(-horas, "hour");

  return new Date(iso).toLocaleDateString(locale);
}
