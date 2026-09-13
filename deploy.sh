#!/usr/bin/env bash
# Deploy do Snaptie: puxa o codigo novo, reconstroi e reinicia o contentor.
# Chamado pelo CI/CD (GitHub Actions) ou a mao. Nao toca em mais nada no servidor.
set -euo pipefail

cd /opt/snaptie

echo "==> git pull"
git fetch --all --quiet
git reset --hard origin/main

echo "==> build + up (so o snaptie)"
docker compose up -d --build

echo "==> aplicar migracoes Prisma pendentes (contra o Neon)"
docker compose exec -T snaptie npx prisma migrate deploy || echo "aviso: migrate deploy falhou (verificar)"

echo "==> estado"
docker compose ps
