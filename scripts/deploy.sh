#!/usr/bin/env bash
#
# Deploy pull-based do gpt-finance.
#
# A porta 22 da VM so aceita conexao do IP do dono, entao o GitHub Actions nao
# consegue fazer SSH para ca. O fluxo e invertido: o Actions apenas builda e
# publica as imagens no GHCR, e a VM busca a nova versao por conta propria,
# autenticando no GitHub com uma deploy key read-only (alias github-gptfin em
# ~/.ssh/config). Toda conexao parte da VM para fora.
#
# Roda pelo timer gptfin-deploy.timer. Instalado em /usr/local/bin/gptfin-deploy;
# a copia instalada e atualizada no fim de cada deploy bem-sucedido, para o
# script nunca se reescrever no meio da propria execucao.
set -euo pipefail

APP_DIR=/root/gpt-finance
REPO_SSH="git@github-gptfin:Alexandre-Magno/gpt-finance.git"
BRANCH=main
IMAGE_PREFIX=ghcr.io/alexandre-magno/gpt-finance
STATE="$APP_DIR/.deploy-tag"
HEALTH_RETRIES=60
HEALTH_INTERVAL=5

cd "$APP_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml)

REMOTE_SHA=$(git ls-remote "$REPO_SSH" "refs/heads/$BRANCH" | cut -f1)
if [ -z "$REMOTE_SHA" ]; then
    echo "erro: nao consegui ler o SHA remoto de $BRANCH"
    exit 1
fi

CURRENT_SHA=$(cat "$STATE" 2>/dev/null || echo "")
if [ "$REMOTE_SHA" = "$CURRENT_SHA" ]; then
    exit 0
fi

TAG="sha-$REMOTE_SHA"

# O build no Actions costuma terminar depois que o commit aparece na main.
# Se as imagens ainda nao existem, sai em silencio e tenta no proximo tick --
# melhor esperar do que derrubar o que esta no ar.
for component in backend frontend; do
    if ! docker manifest inspect "$IMAGE_PREFIX-$component:$TAG" >/dev/null 2>&1; then
        echo "imagem $component:$TAG ainda nao publicada; aguardando proximo ciclo"
        exit 0
    fi
done

echo "deploy: ${CURRENT_SHA:-<nenhum>} -> $REMOTE_SHA"

git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -B "$BRANCH"
git fetch -q "$REPO_SSH" "$BRANCH"
git reset -q --hard FETCH_HEAD

export IMAGE_TAG="$TAG"
"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d --remove-orphans

# O backend carrega tres modelos de embedding no start, entao damos folga.
HEALTHY=false
for _ in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -sf http://127.0.0.1:8010/health >/dev/null 2>&1 \
        && curl -sf http://127.0.0.1:3010/ >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep "$HEALTH_INTERVAL"
done

if [ "$HEALTHY" = false ]; then
    echo "ERRO: health check falhou apos o deploy"
    "${COMPOSE[@]}" ps
    "${COMPOSE[@]}" logs --tail=100
    if [ -n "$CURRENT_SHA" ]; then
        echo "revertendo para $CURRENT_SHA..."
        git reset -q --hard "$CURRENT_SHA"
        IMAGE_TAG="sha-$CURRENT_SHA" "${COMPOSE[@]}" up -d
        echo "rollback concluido"
    else
        echo "sem versao anterior registrada - nada para reverter"
    fi
    exit 1
fi

echo "$REMOTE_SHA" >"$STATE"
docker image prune -f >/dev/null

if [ -f "$APP_DIR/scripts/deploy.sh" ] \
    && ! cmp -s "$APP_DIR/scripts/deploy.sh" /usr/local/bin/gptfin-deploy; then
    install -m 755 "$APP_DIR/scripts/deploy.sh" /usr/local/bin/gptfin-deploy
    echo "script de deploy atualizado para a versao do repo"
fi

echo "deploy concluido: $REMOTE_SHA"
