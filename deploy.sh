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

# NAO migrar automaticamente: a base Neon e partilhada com o Vercel ainda vivo.
# Migracoes de schema sao feitas a mao, com intencao. Ver README de deploy.

echo "==> estado"
docker compose ps
