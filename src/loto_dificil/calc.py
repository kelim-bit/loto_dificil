from __future__ import annotations

from math import comb
from typing import Iterable


GAME_RULES = {
    "megasena": {
        "draw_size": 6,
        "min_number": 1,
        "max_number": 60,
        "min_pick": 6,
        "max_pick": 20,
        "default_base_price": 5.0,
    },
    "lotofacil": {
        "draw_size": 15,
        "min_number": 1,
        "max_number": 25,
        "min_pick": 15,
        "max_pick": 20,
        "default_base_price": 3.0,
    },
}


def normalize_game_type(value: str) -> str:
    normalized = value.strip().lower().replace("-", "")
    if normalized not in GAME_RULES:
        raise ValueError("Tipo de jogo inválido. Use 'megasena' ou 'lotofacil'.")
    return normalized


def parse_numbers(raw_numbers: Iterable[int], game_type: str) -> list[int]:
    rules = GAME_RULES[game_type]
    numbers = sorted({int(value) for value in raw_numbers})

    min_pick = rules["min_pick"]
    max_pick = rules["max_pick"]
    if len(numbers) < min_pick or len(numbers) > max_pick:
        raise ValueError(
            f"Cada jogo de {game_type} deve ter entre {min_pick} e {max_pick} números únicos."
        )

    min_number = rules["min_number"]
    max_number = rules["max_number"]
    for number in numbers:
        if number < min_number or number > max_number:
            raise ValueError(
                f"Número fora do intervalo para {game_type}: {number}. "
                f"Permitidos: {min_number} a {max_number}."
            )

    return numbers


def stake_for_play(pick_size: int, draw_size: int, base_price: float) -> float:
    return comb(pick_size, draw_size) * float(base_price)


def prize_for_play(play: list[int], official_numbers: list[int], draw_size: int, prize_map: dict[int, float]) -> tuple[int, float]:
    play_set = set(play)
    official_set = set(official_numbers)
    hit_count = len(play_set.intersection(official_set))
    pick_size = len(play)

    total_prize = 0.0
    for tier_hits, tier_prize in prize_map.items():
        if tier_hits > draw_size:
            continue
        if hit_count < tier_hits:
            continue

        misses_in_play = pick_size - hit_count
        misses_needed = draw_size - tier_hits
        if misses_in_play < misses_needed:
            continue

        winners = comb(hit_count, tier_hits) * comb(misses_in_play, misses_needed)
        total_prize += winners * float(tier_prize)

    return hit_count, total_prize


def evaluate_plays(
    plays: list[list[int]],
    official_numbers: list[int],
    prize_map: dict[int, float],
    draw_size: int,
    base_price: float,
) -> dict:
    official_set = set(official_numbers)
    checked = []

    for idx, play in enumerate(plays, start=1):
        hit_count, prize = prize_for_play(
            play=play,
            official_numbers=official_numbers,
            draw_size=draw_size,
            prize_map=prize_map,
        )
        spent = stake_for_play(len(play), draw_size, base_price)
        hits = sorted(official_set.intersection(play))
        misses = sorted(set(play).difference(official_set))

        checked.append(
            {
                "index": idx,
                "numbers": play,
                "pick_size": len(play),
                "hits": hit_count,
                "hit_numbers": hits,
                "miss_numbers": misses,
                "spent": round(spent, 2),
                "prize": round(prize, 2),
            }
        )

    total_spent = sum(item["spent"] for item in checked)
    total_won = sum(item["prize"] for item in checked)
    net = total_won - total_spent

    return {
        "plays": checked,
        "total_spent": round(total_spent, 2),
        "total_won": round(total_won, 2),
        "net": round(net, 2),
        "profit": round(max(net, 0.0), 2),
        "loss": round(max(-net, 0.0), 2),
    }
