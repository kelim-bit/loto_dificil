import unittest

from loto_dificil.calc import evaluate_plays, normalize_game_type, parse_numbers, prize_for_play, stake_for_play


class CalcTests(unittest.TestCase):
    def test_parse_numbers_megasena_range_ok(self):
        self.assertEqual(parse_numbers([1, 2, 3, 4, 5, 6], "megasena"), [1, 2, 3, 4, 5, 6])

    def test_parse_numbers_lotofacil_rejects_wrong_size(self):
        with self.assertRaises(ValueError):
            parse_numbers(list(range(1, 15)), "lotofacil")

    def test_normalize_game_type_accepts_alias_style(self):
        self.assertEqual(normalize_game_type("mega-sena"), "megasena")

    def test_stake_for_play_with_more_numbers(self):
        self.assertEqual(stake_for_play(7, 6, 5.0), 35.0)

    def test_prize_for_play_handles_multiple_combinations(self):
        hits, prize = prize_for_play(
            play=[1, 2, 3, 4, 5, 6, 7],
            official_numbers=[1, 2, 3, 4, 5, 6],
            draw_size=6,
            prize_map={6: 100.0, 5: 20.0},
        )
        self.assertEqual(hits, 6)
        self.assertEqual(prize, 220.0)

    def test_evaluate_plays_computes_totals(self):
        result = evaluate_plays(
            plays=[[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]],
            official_numbers=[1, 2, 3, 4, 5, 6],
            prize_map={6: 10.0, 4: 1.0},
            draw_size=6,
            base_price=5.0,
        )

        self.assertEqual(result["total_spent"], 10.0)
        self.assertEqual(result["total_won"], 10.0)
        self.assertEqual(result["net"], 0.0)
        self.assertEqual(result["plays"][0]["hits"], 6)
        self.assertEqual(result["plays"][1]["hits"], 0)


if __name__ == "__main__":
    unittest.main()
