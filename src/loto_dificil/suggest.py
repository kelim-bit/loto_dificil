from __future__ import annotations

import random
from collections import Counter

from loto_dificil.calc import GAME_RULES


def build_suggestions(
    game_type: str,
    draws: list[dict],
    numbers_per_play: int,
    suggestions_count: int = 3,
) -> dict:
    rules = GAME_RULES[game_type]
    max_number = rules["max_number"]

    if not draws:
        raise ValueError("Não há histórico de concursos para sugerir jogos.")

    freq = Counter()
    recency = Counter()

    for idx, draw in enumerate(draws):
        numbers = draw["numbers"]
        for num in numbers:
            freq[num] += 1
            if idx < 15:
                recency[num] += 1

    weights: dict[int, float] = {}
    for num in range(1, max_number + 1):
        base = float(freq[num])
        recent_bonus = recency[num] * 0.35
        jitter = random.random() * 0.2
        weights[num] = base + recent_bonus + jitter

    ranked_numbers = sorted(weights.keys(), key=lambda n: weights[n], reverse=True)
    suggestions: list[list[int]] = []

    for _ in range(suggestions_count):
        picked: list[int] = []
        pool = ranked_numbers[: max(numbers_per_play * 4, numbers_per_play)]
        random.shuffle(pool)

        while len(picked) < numbers_per_play:
            candidate = max(pool, key=lambda n: weights[n] - _overlap_penalty(n, picked, suggestions))
            if candidate not in picked:
                picked.append(candidate)
            if len(pool) > 1:
                pool.remove(candidate)

        suggestions.append(sorted(picked))

    hottest = [num for num, _ in freq.most_common(min(10, max_number))]

    return {
        "draws_used": len(draws),
        "hottest_numbers": hottest,
        "suggestions": suggestions,
    }


def _overlap_penalty(number: int, current_pick: list[int], suggestions: list[list[int]]) -> float:
    penalty = 0.0
    for suggestion in suggestions:
        if number in suggestion:
            penalty += 2.2
    if number in current_pick:
        penalty += 4.0
    return penalty
