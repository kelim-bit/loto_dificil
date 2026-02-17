# Loto Difícil (GitHub Pages)

Aplicação 100% estática pronta para publicar no GitHub Pages.

## Requisitos

- Navegador moderno (Chrome, Edge, Safari, Firefox).
- Internet para consultar resultados oficiais da Caixa.

## Estrutura para Pages

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`
- `.github/workflows/pages.yml`

Os caminhos dos assets já estão relativos (`./styles.css`, `./app.js`), compatíveis com repositório Pages em subpasta.

## Como publicar no GitHub Pages

1. Suba o projeto para o GitHub.
2. Garanta que a branch padrão seja `main`.
3. Em `Settings > Pages`, em `Build and deployment`, selecione **GitHub Actions**.
4. Faça push na `main`.
5. O workflow `Deploy GitHub Pages` publicará o site.

## Rodar localmente (prévia estática)

```bash
cd /Users/otavio/Documents/coding/git_projects/loto_dificil
python3 -m http.server 8000
```

Abra: <http://127.0.0.1:8000>

## Recursos implementados

- Seleção de dezenas por clique.
- Mega-Sena e Lotofácil com quantidade variável de dezenas por jogo.
- Cálculo automático do valor jogado por combinação.
- Conferência em lote com resultados oficiais.
- Acertos em verde e erros em vermelho.
- Sugestão estatística por botão (baseada em concursos anteriores).
- Importação de jogos via CSV + botão de modelo.
- Exportação de resultados em CSV.

## Observação importante

Como o site é estático, não existe backend próprio no GitHub Pages. A aplicação consulta diretamente a API pública da Caixa no navegador.
Se a Caixa bloquear CORS no futuro, será necessário usar um backend/proxy.
