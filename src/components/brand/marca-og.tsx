// O símbolo do Snaptie (os três cantos de um QR) em formato que o next/og
// desenha: só divs com flex, sem SVG inline. Serve o ícone e a imagem de
// pré-visualização dos links.
export function MarcaOg({ tamanho, cor, fundo }: { tamanho: number; cor: string; fundo: string }) {
  const u = tamanho / 24;
  const canto = (x: number, y: number) => (
    <div
      key={`${x}-${y}`}
      style={{
        position: "absolute",
        left: x * u,
        top: y * u,
        width: 7 * u,
        height: 7 * u,
        borderRadius: 2.2 * u,
        border: `${1.7 * u}px solid ${cor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 2.2 * u, height: 2.2 * u, borderRadius: 0.7 * u, backgroundColor: cor }} />
    </div>
  );
  const modulo = (x: number, y: number) => (
    <div
      key={`m${x}-${y}`}
      style={{
        position: "absolute",
        left: x * u,
        top: y * u,
        width: 2.4 * u,
        height: 2.4 * u,
        borderRadius: 0.7 * u,
        backgroundColor: cor,
      }}
    />
  );
  return (
    <div style={{ position: "relative", display: "flex", width: tamanho, height: tamanho, backgroundColor: fundo }}>
      {canto(2.5, 2.5)}
      {canto(14.5, 2.5)}
      {canto(2.5, 14.5)}
      {modulo(14.3, 14.3)}
      {modulo(19.1, 14.3)}
      {modulo(16.7, 16.7)}
      {modulo(14.3, 19.1)}
      {modulo(19.1, 19.1)}
    </div>
  );
}
