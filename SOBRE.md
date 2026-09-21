# Snaptie — QR codes interactivos

## O que é
Plataforma **multi-tenant** para criar **QR codes interactivos**. Uma empresa cria um QR code,
associa-lhe um conjunto de botões, e cada botão abre conteúdo diferente: um menu, um guia em PDF,
um atalho de Wi-Fi, um vídeo ou um link externo. **Cada leitura (scan) é registada**, para a
empresa perceber como os seus códigos estão a ser usados.

Um único QR code substitui um folheto impresso, um panfleto de recepção ou uma etiqueta de
produto — e o conteúdo pode ser alterado a qualquer momento **sem reimprimir nada**.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma**
- **Tailwind CSS** + **shadcn/ui**, animações com **Motion**
- **AWS S3** (`@aws-sdk/client-s3` + presigned URLs) para ficheiros
- Autenticação com **jose** / bcryptjs

## Estado
- Repositório: `https://github.com/joasumbo/Snaptie.git` (branch `main`).
- **Limpo: tudo commitado e enviado.** ✅
- Último commit: **13/07/2026** — `Merge pull request #1 from joasumbo/feature/edicao-visitante`
  (funcionalidade de **edição por visitante**).

## Como correr
```bash
npm install                # o postinstall gera o cliente Prisma
cp .env.example .env       # o .env real JÁ está incluído nesta pasta
npm run db:migrate
npm run db:seed
npm run dev                # http://localhost:3000
```
Úteis: `npm run db:studio` (Prisma Studio), `npm run db:reset`.

## Dependências a instalar
- **Node.js 20+**
- **PostgreSQL**
- Credenciais **S3** (bucket para os ficheiros dos botões)

## O que falta / próximos passos
- Nada pendente por salvar. Continuar a partir do merge da `feature/edicao-visitante`.
