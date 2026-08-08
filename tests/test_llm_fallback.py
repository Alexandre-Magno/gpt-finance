"""Testes do fallback entre modelos do LLM.

O que importa aqui e a distincao entre "este modelo nao vai atender" (tenta o
proximo) e "a request esta errada" (falha na hora) -- errar essa fronteira ou
esconde um bug de credencial atras de N retries inuteis, ou devolve 500 quando
bastava usar outro modelo.
"""

import httpx
import pytest
from groq import AuthenticationError, BadRequestError, RateLimitError

from app.config.settings import Settings
from app.utils.llm_fallback import call_with_model_fallback

CHAIN = ["primario", "fallback1", "fallback2"]


def make_error(cls, code=None, status=429):
    """Monta uma excecao do SDK da Groq como ela chega em producao."""
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    body = {"error": {"message": "boom", "code": code}}
    response = httpx.Response(status, request=request, json=body)
    return cls("boom", response=response, body=body)


@pytest.mark.asyncio
async def test_rate_limit_cai_para_o_proximo_modelo():
    chamados = []

    async def call(model):
        chamados.append(model)
        if model == "primario":
            raise make_error(RateLimitError, "rate_limit_exceeded", 429)
        return f"ok:{model}"

    assert await call_with_model_fallback(CHAIN, call) == "ok:fallback1"
    assert chamados == ["primario", "fallback1"]


@pytest.mark.asyncio
async def test_modelo_descomissionado_pula_ate_um_que_responde():
    async def call(model):
        if model in ("primario", "fallback1"):
            raise make_error(BadRequestError, "model_decommissioned", 400)
        return f"ok:{model}"

    assert await call_with_model_fallback(CHAIN, call) == "ok:fallback2"


@pytest.mark.asyncio
async def test_erro_de_credencial_nao_tenta_outro_modelo():
    chamados = []

    async def call(model):
        chamados.append(model)
        raise make_error(AuthenticationError, "invalid_api_key", 401)

    with pytest.raises(AuthenticationError):
        await call_with_model_fallback(CHAIN, call)

    assert chamados == ["primario"], "trocar de modelo nao conserta credencial"


@pytest.mark.asyncio
async def test_quando_todos_falham_propaga_o_ultimo_erro():
    async def call(model):
        raise make_error(RateLimitError, "rate_limit_exceeded", 429)

    with pytest.raises(RateLimitError):
        await call_with_model_fallback(CHAIN, call)


@pytest.mark.asyncio
async def test_primario_respondendo_nao_toca_nos_fallbacks():
    chamados = []

    async def call(model):
        chamados.append(model)
        return f"ok:{model}"

    assert await call_with_model_fallback(CHAIN, call) == "ok:primario"
    assert chamados == ["primario"]


@pytest.mark.asyncio
async def test_lista_vazia_e_erro_de_configuracao():
    async def call(model):  # pragma: no cover - nunca chamado
        return "nao deveria chegar aqui"

    with pytest.raises(ValueError):
        await call_with_model_fallback([], call)


def test_chain_remove_duplicatas_e_espacos():
    settings = Settings(llm_model="a", llm_fallback_models="b, c ,a,")
    assert settings.llm_model_chain == ["a", "b", "c"]


def test_chain_sem_fallback_configurado():
    settings = Settings(llm_model="a", llm_fallback_models="")
    assert settings.llm_model_chain == ["a"]
