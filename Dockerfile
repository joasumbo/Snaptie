# Snaptie — imagem de produção. Multi-etapa: a imagem final não leva
# dependências de compilação nem código-fonte, só o standalone + Prisma.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Ignora o postinstall (prisma generate) aqui; corre-o já a seguir, controlado.
RUN npm ci --ignore-scripts && npx prisma generate

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL é injectado no build (algumas páginas podem pré-renderizar).
ARG DATABASE_URL
ARG DIRECT_URL
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3311
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S snaptie && adduser -u 1001 -S snaptie -G snaptie

COPY --from=build /app/public ./public
COPY --from=build --chown=snaptie:snaptie /app/.next/standalone ./
COPY --from=build --chown=snaptie:snaptie /app/.next/static ./.next/static
# Prisma Client e engine, para as consultas em runtime.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma

USER snaptie
EXPOSE 3311

CMD ["node", "server.js"]
