# Deploy

Produção roda em uma VM Ubuntu atrás de nginx, servida em
`https://gptfin.alexandre-magno.com`.

```
Internet → nginx (host, 443, TLS Let's Encrypt)
             └→ 127.0.0.1:3010  frontend (Next.js, next start)
                   └→ rewrite /api/* → http://backend:8000   (rede interna do compose)
                                          └→ http://qdrant:6333
```

O backend e o Qdrant não são expostos publicamente. O Qdrant publica
`127.0.0.1:6333` apenas porque a ingestão roda no host (veja abaixo).

## Por que o deploy é pull-based

A porta 22 da VM só aceita conexão do IP do dono, então um runner do GitHub não
consegue fazer SSH para lá — a abordagem usual (`appleboy/ssh-action`) resulta
em timeout. O fluxo é invertido:

1. **GitHub Actions** (`.github/workflows/ci.yml`) roda lint/type-check/sintaxe,
   builda `backend` e `frontend` e publica em `ghcr.io/alexandre-magno/gpt-finance-*`
   com as tags `latest` e `sha-<commit>`.
2. **A VM** roda `scripts/deploy.sh` a cada 2 minutos por um timer systemd. O
   script autentica no GitHub com uma **deploy key read-only**, compara o SHA da
   `main` com o último deployado (`.deploy-tag`) e, se mudou, sobe a imagem
   `sha-<commit>` correspondente.

Toda conexão parte da VM para fora. Nenhuma porta é aberta para isso.

Se as imagens ainda não estiverem publicadas quando o timer disparar, o script
sai em silêncio e tenta no ciclo seguinte, em vez de derrubar o que está no ar.
Se o health check falhar depois de subir, ele reverte para o commit e a tag de
imagem anteriores.

## Instalação na VM

```bash
# 1. deploy key read-only, com alias SSH proprio para nao afetar outros repos
ssh-keygen -t ed25519 -f ~/.ssh/gptfin_deploy_key -N "" -C "gptfin-deploy"
gh repo deploy-key add ~/.ssh/gptfin_deploy_key.pub --title "gptfin VM (read-only)"

cat >> ~/.ssh/config <<'EOF'
Host github-gptfin
    HostName github.com
    User git
    IdentityFile ~/.ssh/gptfin_deploy_key
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# 2. script e timer
install -m 755 scripts/deploy.sh /usr/local/bin/gptfin-deploy
cp scripts/systemd/gptfin-deploy.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gptfin-deploy.timer
```

O `.env` de produção fica em `/root/gpt-finance/.env` (fora do git) e é lido
pelo `env_file` do `docker-compose.prod.yml`.

## Operação

```bash
systemctl list-timers gptfin-deploy.timer   # proximo disparo
journalctl -u gptfin-deploy.service -n 50   # log do ultimo deploy
systemctl start gptfin-deploy.service       # forcar deploy agora
docker compose -f docker-compose.prod.yml ps
```

Para fixar uma versão manualmente (ex.: rollback fora do automático):

```bash
IMAGE_TAG=sha-<commit> docker compose -f docker-compose.prod.yml up -d
```

Lembre de atualizar `.deploy-tag` com esse commit, senão o timer volta para a
`main` no próximo ciclo.

## Ingestão

A imagem da API não carrega `torch`/`sec-api` (ver "Dependency split" no
README), então os scripts de ingestão rodam no host, contra a porta loopback do
Qdrant:

```bash
uv venv .venv && uv pip install -r requirements.txt --python .venv/bin/python
.venv/bin/python ingestion/ingestion-yfinance-news.py
.venv/bin/python ingestion/ingestion-sec-api.py
```

Ambos são hardcoded para `AAPL`. O `init-collection` do compose só cria a
collection vazia — sem ingestão, o RAG responde sem fontes.

## Modelo do LLM

`LLM_MODEL` está definido no `.env` de produção. O default do
`app/config/settings.py` (`llama3-8b-8192`) foi descomissionado pela Groq e
retorna `model_decommissioned`.
