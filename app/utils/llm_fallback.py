"""Fallback entre modelos do LLM.

Na Groq o limite de tokens e por modelo e por dia (TPD), entao quando o modelo
primario esgota a cota o proximo da lista ainda tem cota propria -- basta
tentar outro em vez de devolver 500. O mesmo caminho cobre modelo
descomissionado, que foi como o `llama3-8b-8192` derrubou toda a analise de
uma vez.

Erros que nao sao do modelo (request malformada, credencial invalida) sobem
imediatamente: repetir num modelo diferente daria o mesmo resultado.
"""

import logging
from typing import Awaitable, Callable, Iterator, Optional, Sequence, TypeVar

from groq import APIStatusError, NotFoundError, RateLimitError

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Codigos que significam "este modelo nao vai atender", e nao "a request esta
# errada". So estes justificam tentar o proximo modelo.
_MODEL_LEVEL_CODES = frozenset(
    {
        "model_decommissioned",
        "model_not_found",
        "rate_limit_exceeded",
    }
)


def _unwrap(exc: BaseException) -> Iterator[BaseException]:
    """Percorre a cadeia de excecoes ate o erro original da API.

    O `instructor` nao deixa o erro da Groq subir cru: ele embrulha em
    InstructorRetryException, cujo __cause__ e um RetryError do tenacity, que
    por sua vez guarda a excecao real na ultima tentativa. Olhar so o topo da
    pilha faz o fallback nunca reconhecer um rate limit.
    """
    seen: set = set()
    pending = [exc]
    while pending:
        current = pending.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))
        yield current

        # tenacity: a excecao real fica na ultima tentativa
        last_attempt = getattr(current, "last_attempt", None)
        if last_attempt is not None:
            try:
                pending.append(last_attempt.exception())
            except Exception:  # pragma: no cover - tentativa sem excecao
                pass

        pending.append(getattr(current, "__cause__", None))
        pending.append(getattr(current, "__context__", None))


def is_model_level_failure(exc: BaseException) -> bool:
    """True quando outro modelo tem chance real de atender a mesma request."""
    for candidate in _unwrap(exc):
        if isinstance(candidate, (RateLimitError, NotFoundError)):
            return True
        if isinstance(candidate, APIStatusError):
            body = candidate.body if isinstance(candidate.body, dict) else {}
            error = body.get("error") if isinstance(body.get("error"), dict) else {}
            if error.get("code") in _MODEL_LEVEL_CODES:
                return True
    return False


async def call_with_model_fallback(
    models: Sequence[str],
    call: Callable[[str], Awaitable[T]],
    *,
    operation: str = "LLM call",
) -> T:
    """Executa `call(model)` percorrendo `models` ate um deles responder.

    Args:
        models: modelos em ordem de preferencia; o primeiro e o primario.
        call: recebe o nome do modelo e devolve o awaitable da chamada.
        operation: usado so no log, para identificar quem caiu no fallback.

    Raises:
        O erro do ultimo modelo tentado, se nenhum atender.
    """
    if not models:
        raise ValueError("nenhum modelo de LLM configurado")

    last_exc: Optional[BaseException] = None

    for position, model in enumerate(models):
        try:
            result = await call(model)
            if position:
                logger.warning(
                    "%s: atendida pelo modelo de fallback %s (o primario %s falhou)",
                    operation,
                    model,
                    models[0],
                )
            return result
        except Exception as exc:
            if not is_model_level_failure(exc):
                raise
            last_exc = exc
            remaining = len(models) - position - 1
            logger.warning(
                "%s: modelo %s indisponivel (%s: %s); %s",
                operation,
                model,
                exc.__class__.__name__,
                exc,
                (
                    f"tentando o proximo, {remaining} restante(s)"
                    if remaining
                    else "sem mais fallbacks configurados"
                ),
            )

    raise last_exc
