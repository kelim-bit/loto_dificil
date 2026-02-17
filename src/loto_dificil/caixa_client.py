from __future__ import annotations

import json
import re
from urllib import request
from urllib.error import HTTPError, URLError

BASE_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api"
USER_AGENT = "Mozilla/5.0 (compatible; loto-dificil/1.0)"


def _clean_response(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith(")]}'"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    return text


def _extract_hits(description: str) -> int | None:
    match = re.search(r"(\d+)", description)
    if not match:
        return None
    return int(match.group(1))


def _to_float(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().replace("R$", "").replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def _request_json(path: str) -> dict:
    req = request.Request(
        f"{BASE_URL}{path}",
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )

    try:
        with request.urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8", errors="ignore")
    except HTTPError as exc:
        raise RuntimeError(f"Erro ao buscar resultado na Caixa: HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError("Erro de conexão ao buscar resultado na Caixa.") from exc

    cleaned = _clean_response(body)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Resposta inesperada da Caixa. Não foi possível ler o JSON.") from exc


def fetch_result(game_type: str, contest: int | None = None) -> dict:
    path = f"/{game_type}"
    if contest is not None:
        path = f"{path}/{int(contest)}"

    payload = _request_json(path)
    dezenas = [int(x) for x in payload.get("listaDezenas", [])]
    if not dezenas:
        raise RuntimeError("A resposta da Caixa não trouxe as dezenas sorteadas.")

    prize_map: dict[int, float] = {}
    for row in payload.get("listaRateioPremio", []):
        hits = _extract_hits(str(row.get("descricaoFaixa", "")))
        if hits is None:
            continue
        prize_map[hits] = _to_float(row.get("valorPremio"))

    prize_info = {
        "main_prize": _to_float(payload.get("valorTotalPremioFaixaUm")),
        "estimated_next": _to_float(payload.get("valorEstimadoProximoConcurso")),
        "accumulated_next": _to_float(payload.get("valorAcumuladoProximoConcurso")),
        "accumulated_special": _to_float(payload.get("valorAcumuladoConcursoEspecial")),
        "is_accumulated": bool(payload.get("acumulado", False)),
    }

    return {
        "contest": int(payload.get("numero")),
        "draw_date": payload.get("dataApuracao"),
        "next_draw_date": payload.get("dataProximoConcurso"),
        "official_numbers": sorted(dezenas),
        "prize_map": prize_map,
        "base_price": _to_float(payload.get("valorAposta")),
        "prize_info": prize_info,
    }


def fetch_recent_draws(game_type: str, draw_count: int = 60) -> list[dict]:
    latest = fetch_result(game_type)
    latest_contest = latest["contest"]
    min_contest = max(latest_contest - draw_count + 1, 1)

    draws = [{"contest": latest_contest, "numbers": latest["official_numbers"]}]
    consecutive_errors = 0

    for contest in range(latest_contest - 1, min_contest - 1, -1):
        try:
            row = fetch_result(game_type, contest)
            draws.append({"contest": contest, "numbers": row["official_numbers"]})
            consecutive_errors = 0
        except RuntimeError:
            consecutive_errors += 1
            if consecutive_errors >= 5:
                break

    return draws
