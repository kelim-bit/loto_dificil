from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from loto_dificil.caixa_client import fetch_recent_draws, fetch_result
from loto_dificil.calc import GAME_RULES, evaluate_plays, normalize_game_type, parse_numbers
from loto_dificil.suggest import build_suggestions


STATIC_DIR = Path(__file__).resolve().parent / "static"


class AppHandler(BaseHTTPRequestHandler):
    server_version = "LotoDificil/2.0"

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_file(self, path: Path, content_type: str) -> None:
        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("JSON inválido na requisição.") from exc

    def do_GET(self) -> None:
        if self.path in ("/", "/index.html"):
            self._send_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return

        if self.path == "/app.js":
            self._send_file(STATIC_DIR / "app.js", "application/javascript; charset=utf-8")
            return

        if self.path == "/styles.css":
            self._send_file(STATIC_DIR / "styles.css", "text/css; charset=utf-8")
            return

        if self.path == "/api/rules":
            self._send_json(GAME_RULES)
            return

        self._send_json({"error": "Rota não encontrada."}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if self.path == "/api/check":
            self._handle_check()
            return

        if self.path == "/api/suggest":
            self._handle_suggest()
            return

        self._send_json({"error": "Rota não encontrada."}, status=HTTPStatus.NOT_FOUND)

    def _handle_check(self) -> None:
        try:
            payload = self._read_json_body()
            game_type = normalize_game_type(str(payload.get("game_type", "")))
            rules = GAME_RULES[game_type]

            contest = payload.get("contest")
            contest = int(contest) if contest not in (None, "") else None

            raw_plays = payload.get("plays", [])
            if not raw_plays or not isinstance(raw_plays, list):
                raise ValueError("Informe pelo menos um jogo em 'plays'.")

            parsed_plays = [parse_numbers(play, game_type) for play in raw_plays]

            result = fetch_result(game_type, contest)
            base_price = result["base_price"] or rules["default_base_price"]

            summary = evaluate_plays(
                plays=parsed_plays,
                official_numbers=result["official_numbers"],
                prize_map=result["prize_map"],
                draw_size=rules["draw_size"],
                base_price=base_price,
            )

            self._send_json(
                {
                    "game_type": game_type,
                    "contest": result["contest"],
                    "draw_date": result["draw_date"],
                    "next_draw_date": result["next_draw_date"],
                    "official_numbers": result["official_numbers"],
                    "base_price": base_price,
                    "prize_info": result["prize_info"],
                    "summary": summary,
                }
            )
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
        except Exception:
            self._send_json(
                {"error": "Erro interno ao processar a conferência."},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def _handle_suggest(self) -> None:
        try:
            payload = self._read_json_body()
            game_type = normalize_game_type(str(payload.get("game_type", "")))
            rules = GAME_RULES[game_type]

            requested = int(payload.get("numbers_per_play") or rules["min_pick"])
            if requested < rules["min_pick"] or requested > rules["max_pick"]:
                raise ValueError(
                    f"numbers_per_play deve estar entre {rules['min_pick']} e {rules['max_pick']}."
                )

            count = int(payload.get("suggestions_count") or 3)
            if count < 1 or count > 10:
                raise ValueError("suggestions_count deve estar entre 1 e 10.")

            draws = fetch_recent_draws(game_type, draw_count=60)
            model = build_suggestions(
                game_type=game_type,
                draws=draws,
                numbers_per_play=requested,
                suggestions_count=count,
            )

            self._send_json(
                {
                    "game_type": game_type,
                    "numbers_per_play": requested,
                    "model": model,
                }
            )
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except RuntimeError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
        except Exception:
            self._send_json(
                {"error": "Erro interno ao gerar sugestões."},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    httpd = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Servidor rodando em http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")


if __name__ == "__main__":
    run()
