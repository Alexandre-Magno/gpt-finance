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

## Como o deploy acontece

`.github/workflows/deploy.yml` roda em push na `main` (e por `workflow_dispatch`):

1. **checks** — lint e type-check do frontend, testes e checagem de sintaxe do
   backend. Roda também em pull request.
2. **build-push** — builda `backend` e `frontend` e publica em
   `ghcr.io/alexandre-magno/gpt-finance-*` com as tags `latest` e `sha-<commit>`.
3. **deploy** — entra na VM por SSH, faz `git reset --hard` na `main`, sobe as
   imagens `sha-<commit>` recém-publicadas e espera os dois serviços ficarem
   saudáveis. Se o health check falhar, reverte para o commit e a tag de imagem
   anteriores, registrados em `.deploy-tag`.

Secrets usados: `VM_HOST`, `VM_USERNAME`, `VM_SSH_KEY`. O login no GHCR usa o
`GITHUB_TOKEN` efêmero do próprio job, então nenhuma credencial de longa
duração fica guardada na VM.

### Deploy pull-based (alternativa, hoje desligada)

`scripts/deploy.sh` faz o mesmo deploy a partir da VM: autentica no GitHub com
uma **deploy key read-only**, compara o SHA da `main` com `.deploy-tag` e sobe a
imagem correspondente. Toda conexão parte da VM para fora, então funciona mesmo
com a porta 22 fechada para o mundo — foi assim que o projeto rodou enquanto o
firewall bloqueava SSH de entrada.

Os dois caminhos compartilham o mesmo `.deploy-tag`, então dá para alternar sem
perder o rastro do que está no ar. **Não deixe os dois ativos ao mesmo tempo**:
eles competiriam pelo mesmo working tree.

```bash
# ligar o modo pull-based
systemctl enable --now gptfin-deploy.timer

# desligar (estado atual: o deploy vem do Actions)
systemctl disable --now gptfin-deploy.timer

# rodar um deploy manual a qualquer momento
/usr/local/bin/gptfin-deploy
```

Instalação do modo pull-based, se precisar reativá-lo numa VM nova:

```bash
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

install -m 755 scripts/deploy.sh /usr/local/bin/gptfin-deploy
cp scripts/systemd/gptfin-deploy.{service,timer} /etc/systemd/system/
systemctl daemon-reload
```

O `.env` de produção fica em `/root/gpt-finance/.env` (fora do git) e é lido
pelo `env_file` do `docker-compose.prod.yml`.

## Operação

```bash
gh run list --branch main --limit 5          # historico de deploys
gh run watch                                 # acompanhar o deploy em curso
docker compose -f docker-compose.prod.yml ps
journalctl -u gptfin-deploy.service -n 50    # log do modo pull-based
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

> O deploy faz `git reset --hard` em `/root/gpt-finance`. Se for trabalhar no
> repo direto na VM, commite antes de dar push na `main` — o deploy seguinte
> descarta o que estiver solto no working tree.

## Modelo do LLM

`LLM_MODEL` está definido no `.env` de produção. O default do
`app/config/settings.py` (`llama3-8b-8192`) foi descomissionado pela Groq e
retorna `model_decommissioned`.
