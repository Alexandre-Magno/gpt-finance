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
```

**Os três streams de análise leem formulários diferentes** — veja
`app/config/queries.yaml`. Ingerir só um formulário faz o stream
correspondente retornar vazio (a análise fundamental graduava tudo como `D`
enquanto não havia nenhum 10-K na collection):

| Stream | Formulário | Seções a ingerir |
|---|---|---|
| fundamental | 10-K | `1A` (Risk Factors), `1` (Business), `7` (MD&A), `8` (Financial Statements) |
| momentum | 10-Q | `part2item1a` (Risk Factors), `part1item2` (MD&A), `part1item1` (Financial) |
| sentiment | notícias | — |

Conjunto completo para um ticker (~4 min no total):

```bash
for s in 1A 1 7 8; do
  .venv/bin/python ingestion/ingestion-sec-api.py --ticker AAPL --form-type 10-K --section "$s"
done
for s in part2item1a part1item2 part1item1; do
  .venv/bin/python ingestion/ingestion-sec-api.py --ticker AAPL --form-type 10-Q --section "$s"
done
.venv/bin/python ingestion/ingestion-yfinance-news.py --ticker AAPL --max-stories 20
```

O `init-collection` do compose só cria a collection vazia — sem ingestão, o RAG
responde sem fontes. Para conferir o que já existe:

```bash
curl -s -X POST http://127.0.0.1:6333/collections/documents/points/count \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"must":[{"key":"metadata.formType","match":{"value":"10-K"}}]},"exact":true}'
```

> O timer de deploy faz `git reset --hard` em `/root/gpt-finance`. Se for
> trabalhar no repo direto na VM, pare o timer antes
> (`systemctl stop gptfin-deploy.timer`) para não perder alterações não
> commitadas.

## Modelo do LLM

`LLM_MODEL` está definido no `.env` de produção. O default do
`app/config/settings.py` (`llama3-8b-8192`) foi descomissionado pela Groq e
retorna `model_decommissioned`.
