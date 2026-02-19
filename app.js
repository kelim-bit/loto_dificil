const gameTypeSelect = document.getElementById('game-type');
const contestInput = document.getElementById('contest');
const numbersPerPlaySelect = document.getElementById('numbers-per-play');
const numberGrid = document.getElementById('number-grid');
const pickerLabel = document.getElementById('picker-label');
const selectionCount = document.getElementById('selection-count');
const playsCount = document.getElementById('plays-count');
const playsList = document.getElementById('plays-list');
const output = document.getElementById('output');
const suggestionsBox = document.getElementById('suggestions');
const priceSource = document.getElementById('price-source');

const clearSelectionBtn = document.getElementById('clear-selection');
const addPlayBtn = document.getElementById('add-play');
const clearPlaysBtn = document.getElementById('clear-plays');
const checkAllBtn = document.getElementById('check-all');
const suggestGamesBtn = document.getElementById('suggest-games');
const exportResultsBtn = document.getElementById('export-results');
const downloadTemplateBtn = document.getElementById('download-template');
const csvFileInput = document.getElementById('csv-file');
const importCsvBtn = document.getElementById('import-csv');

const CAIXA_API_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';

const rules = {
  megasena: {
    draw_size: 6,
    min_number: 1,
    max_number: 60,
    min_pick: 6,
    max_pick: 20,
    fallback_base_price: 5.0,
  },
  lotofacil: {
    draw_size: 15,
    min_number: 1,
    max_number: 25,
    min_pick: 15,
    max_pick: 20,
    fallback_base_price: 3.0,
  },
};

let selectedNumbers = new Set();
let plays = [];
let latestResult = null;
let currentBasePrice = rules.megasena.fallback_base_price;
const resultCache = new Map();

function getGameType() {
  return gameTypeSelect.value;
}

function getRule() {
  return rules[getGameType()];
}

function getNumbersPerPlay() {
  return Number(numbersPerPlaySelect.value);
}

function toCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumbers(numbers) {
  return numbers.map((n) => String(n).padStart(2, '0')).join(' ');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}


function comb(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= kk; i += 1) {
    result = (result * (n - kk + i)) / i;
  }
  return result;
}

function stakeForPlay(pickSize, drawSize, basePrice) {
  return comb(pickSize, drawSize) * basePrice;
}

function parseMoney(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  return Number(String(value).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function renderError(target, message) {
  target.classList.remove('hidden');
  target.innerHTML = `<p class="error">${message}</p>`;
}

function renderNumbersPerPlayOptions() {
  const rule = getRule();
  const current = Number(numbersPerPlaySelect.value || rule.min_pick);

  numbersPerPlaySelect.innerHTML = '';
  for (let qty = rule.min_pick; qty <= rule.max_pick; qty += 1) {
    const option = document.createElement('option');
    option.value = String(qty);
    option.textContent = `${qty} números`;
    if (qty === current) option.selected = true;
    numbersPerPlaySelect.appendChild(option);
  }

  if (!numbersPerPlaySelect.value) {
    numbersPerPlaySelect.value = String(rule.min_pick);
  }
}

function renderGrid() {
  const rule = getRule();
  numberGrid.innerHTML = '';

  for (let number = rule.min_number; number <= rule.max_number; number += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'number-btn';
    button.dataset.number = String(number);
    button.textContent = String(number).padStart(2, '0');

    button.addEventListener('click', () => {
      const limit = getNumbersPerPlay();
      if (selectedNumbers.has(number)) {
        selectedNumbers.delete(number);
      } else if (selectedNumbers.size < limit) {
        selectedNumbers.add(number);
      }
      renderSelectionStatus();
    });

    numberGrid.appendChild(button);
  }

  renderSelectionStatus();
}

function renderSelectionStatus() {
  const rule = getRule();
  const target = getNumbersPerPlay();
  const selected = selectedNumbers.size;
  const estCost = stakeForPlay(target, rule.draw_size, currentBasePrice);

  pickerLabel.textContent = `Selecione ${target} números`;
  selectionCount.textContent = `${selected} selecionados • custo estimado: ${toCurrency(estCost)}`;

  const canSelectMore = selected < target;
  document.querySelectorAll('.number-btn').forEach((button) => {
    const num = Number(button.dataset.number);
    const active = selectedNumbers.has(num);
    button.classList.toggle('selected', active);
    button.disabled = !active && !canSelectMore;
  });
}

function renderPlays() {
  const rule = getRule();
  playsCount.textContent = `${plays.length} jogo${plays.length === 1 ? '' : 's'}`;

  if (plays.length === 0) {
    playsList.innerHTML = '<div class="play-line">Nenhum jogo adicionado.</div>';
    return;
  }

  playsList.innerHTML = plays
    .map((play, idx) => {
      const cost = stakeForPlay(play.length, rule.draw_size, currentBasePrice);
      return `<div class="play-line"><strong>Jogo ${idx + 1}:</strong> ${formatNumbers(play)} <span class="hint">(${play.length} números, estimado ${toCurrency(cost)})</span></div>`;
    })
    .join('');
}

function clearSelection() {
  selectedNumbers = new Set();
  renderSelectionStatus();
}

function resetAllForGameType() {
  selectedNumbers = new Set();
  plays = [];
  latestResult = null;
  output.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
  exportResultsBtn.disabled = true;

  const rule = getRule();
  currentBasePrice = rule.fallback_base_price;
  priceSource.textContent = `Valor base de referência: ${toCurrency(currentBasePrice)} (atualiza automaticamente quando consultar a Caixa).`;

  renderNumbersPerPlayOptions();
  renderGrid();
  renderPlays();
}

function addCurrentPlay() {
  const required = getNumbersPerPlay();
  if (selectedNumbers.size !== required) {
    renderError(output, `Selecione exatamente ${required} números para adicionar o jogo.`);
    return;
  }

  plays.push(Array.from(selectedNumbers).sort((a, b) => a - b));
  clearSelection();
  renderPlays();
  output.classList.add('hidden');
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('CSV vazio.');

  const separator = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(separator).map((col) => col.trim()));

  let start = 0;
  if (rows[0].some((cell) => /^n\d+$/i.test(cell) || /numero/i.test(cell) || /jogo/i.test(cell))) {
    start = 1;
  }

  const rule = getRule();
  const parsed = [];

  for (let i = start; i < rows.length; i += 1) {
    const cols = rows[i];
    const firstLooksLikeIndex = cols.length > 1 && /^\d+$/.test(cols[0]);
    const numberCells = firstLooksLikeIndex ? cols.slice(1) : cols;

    const nums = numberCells.map((cell) => Number(cell)).filter((n) => Number.isFinite(n) && n > 0);
    const unique = Array.from(new Set(nums)).sort((a, b) => a - b);

    if (unique.length < rule.min_pick || unique.length > rule.max_pick) continue;
    if (!unique.every((n) => n >= rule.min_number && n <= rule.max_number)) continue;

    parsed.push(unique);
  }

  if (parsed.length === 0) throw new Error('Nenhum jogo válido encontrado no CSV.');
  return parsed;
}


function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplateCsv() {
  if (plays.length === 0) {
    renderError(output, 'Adicione pelo menos 1 jogo para gerar o CSV de importação.');
    return;
  }

  const maxColumns = Math.max(...plays.map((play) => play.length));
  const headers = ['jogo'];
  for (let i = 1; i <= maxColumns; i += 1) headers.push(`n${i}`);

  const rows = plays.map((play, idx) => {
    const cols = [idx + 1];
    for (let col = 0; col < maxColumns; col += 1) {
      const number = play[col];
      cols.push(number ? String(number).padStart(2, '0') : '');
    }
    return cols.map((value) => csvEscape(value)).join(',');
  });

  const content = [headers.map((value) => csvEscape(value)).join(','), ...rows].join('\n');
  downloadCsv(`jogos_${getGameType()}.csv`, content);
  output.classList.add('hidden');
}

function cleanJsonPrefix(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith(")]}'")) {
    const lineBreak = trimmed.indexOf('\n');
    return lineBreak >= 0 ? trimmed.slice(lineBreak + 1) : '';
  }
  return trimmed;
}

function extractHitTier(description) {
  const match = String(description || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function fetchCaixaResult(gameType, contest = null) {
  const cacheKey = `${gameType}:${contest || 'latest'}`;
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey);

  const url = `${CAIXA_API_BASE}/${gameType}${contest ? `/${contest}` : ''}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error('Falha de rede ao consultar a Caixa.');
  }

  if (!response.ok) {
    throw new Error(`Erro ao consultar Caixa (HTTP ${response.status}).`);
  }

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(cleanJsonPrefix(rawText));
  } catch {
    throw new Error('A resposta da Caixa não está em formato JSON esperado.');
  }

  const officialNumbers = (payload.listaDezenas || []).map((n) => Number(n)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!officialNumbers.length) {
    throw new Error('A Caixa não retornou dezenas para este concurso.');
  }

  const prizeMap = {};
  for (const row of payload.listaRateioPremio || []) {
    const tier = extractHitTier(row.descricaoFaixa);
    if (!tier) continue;
    prizeMap[tier] = parseMoney(row.valorPremio);
  }

  const parsed = {
    contest: Number(payload.numero),
    draw_date: payload.dataApuracao || null,
    next_draw_date: payload.dataProximoConcurso || null,
    official_numbers: officialNumbers,
    prize_map: prizeMap,
    base_price: parseMoney(payload.valorAposta),
    prize_info: {
      main_prize: parseMoney(payload.valorTotalPremioFaixaUm),
      estimated_next: parseMoney(payload.valorEstimadoProximoConcurso),
      accumulated_next: parseMoney(payload.valorAcumuladoProximoConcurso),
      accumulated_special: parseMoney(payload.valorAcumuladoConcursoEspecial),
      is_accumulated: Boolean(payload.acumulado),
    },
  };

  resultCache.set(cacheKey, parsed);
  return parsed;
}

function evaluatePlays(playsList, officialNumbers, prizeMap, drawSize, basePrice) {
  const officialSet = new Set(officialNumbers);
  const resultPlays = playsList.map((play, idx) => {
    const playSet = new Set(play);
    const hitNumbers = play.filter((n) => officialSet.has(n));
    const missNumbers = play.filter((n) => !officialSet.has(n));
    const hitCount = hitNumbers.length;

    let prize = 0;
    for (const [tierText, tierPrize] of Object.entries(prizeMap)) {
      const tier = Number(tierText);
      if (hitCount < tier || tier > drawSize) continue;
      const missesInPlay = play.length - hitCount;
      const missesNeeded = drawSize - tier;
      if (missesInPlay < missesNeeded) continue;

      const winners = comb(hitCount, tier) * comb(missesInPlay, missesNeeded);
      prize += winners * Number(tierPrize);
    }

    const spent = stakeForPlay(play.length, drawSize, basePrice);

    return {
      index: idx + 1,
      numbers: play,
      hits: hitCount,
      hit_numbers: hitNumbers,
      miss_numbers: missNumbers,
      spent: Number(spent.toFixed(2)),
      prize: Number(prize.toFixed(2)),
    };
  });

  const total_spent = Number(resultPlays.reduce((acc, play) => acc + play.spent, 0).toFixed(2));
  const total_won = Number(resultPlays.reduce((acc, play) => acc + play.prize, 0).toFixed(2));
  const net = Number((total_won - total_spent).toFixed(2));

  return {
    plays: resultPlays,
    total_spent,
    total_won,
    net,
    profit: Number(Math.max(net, 0).toFixed(2)),
    loss: Number(Math.max(-net, 0).toFixed(2)),
  };
}

async function fetchRecentDraws(gameType, latestContest, limit = 30) {
  const minContest = Math.max(latestContest - limit + 1, 1);
  const draws = [];
  let consecutiveErrors = 0;

  for (let contest = latestContest; contest >= minContest; contest -= 1) {
    try {
      const result = await fetchCaixaResult(gameType, contest);
      draws.push({ contest, numbers: result.official_numbers });
      consecutiveErrors = 0;
    } catch {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 5) break;
    }
  }

  return draws;
}

function buildSuggestions(draws, numbersPerPlay, maxNumber, suggestionsCount = 5) {
  const frequency = new Map();
  const recency = new Map();

  for (let n = 1; n <= maxNumber; n += 1) {
    frequency.set(n, 0);
    recency.set(n, 0);
  }

  draws.forEach((draw, idx) => {
    draw.numbers.forEach((n) => {
      frequency.set(n, (frequency.get(n) || 0) + 1);
      if (idx < 12) recency.set(n, (recency.get(n) || 0) + 1);
    });
  });

  const ranked = Array.from(frequency.keys())
    .map((n) => ({
      n,
      score: (frequency.get(n) || 0) + (recency.get(n) || 0) * 0.35 + Math.random() * 0.2,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.n);

  const suggestions = [];
  for (let i = 0; i < suggestionsCount; i += 1) {
    const pool = [...ranked.slice(0, Math.max(numbersPerPlay * 4, numbersPerPlay))];
    const suggestion = [];

    while (suggestion.length < numbersPerPlay && pool.length > 0) {
      const candidate = pool.shift();
      if (!suggestion.includes(candidate)) suggestion.push(candidate);
    }

    suggestions.push(suggestion.sort((a, b) => a - b));
    ranked.push(ranked.shift());
  }

  return {
    draws_used: draws.length,
    hottest_numbers: ranked.slice(0, Math.min(10, maxNumber)).sort((a, b) => a - b),
    suggestions,
  };
}

function renderSuggestions(model) {
  suggestionsBox.classList.remove('hidden');
  suggestionsBox.innerHTML = `
    <h2>Sugestões estatísticas</h2>
    <p class="hint">Baseado nos últimos ${model.draws_used} concursos disponíveis.</p>
    <p><strong>Números mais frequentes:</strong> ${formatNumbers(model.hottest_numbers)}</p>
    <div class="plays-list">
      ${model.suggestions
        .map((play, idx) => `<div class="play-line"><strong>Sugestão ${idx + 1}:</strong> ${formatNumbers(play)}</div>`)
        .join('')}
    </div>
    <div class="row actions">
      <button type="button" id="add-suggestions" class="btn">Adicionar sugestões à lista</button>
    </div>
  `;

  const addSuggestionsBtn = document.getElementById('add-suggestions');
  addSuggestionsBtn.addEventListener('click', () => {
    model.suggestions.forEach((play) => plays.push(play));
    renderPlays();
    suggestionsBox.classList.add('hidden');
  });
}

function renderResult(data) {
  const summary = data.summary;

  const officialBalls = `
    <div class="numbers">
      ${data.official_numbers.map((n) => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join('')}
    </div>
  `;

  const rows = summary.plays
    .map((play) => {
      const decorated = play.numbers
        .map((n) => {
          const css = play.hit_numbers.includes(n) ? 'hit' : 'miss';
          return `<span class="ball ${css}">${String(n).padStart(2, '0')}</span>`;
        })
        .join('');

      return `
        <tr>
          <td>${play.index}</td>
          <td><div class="numbers">${decorated}</div></td>
          <td>${play.hits}</td>
          <td>${toCurrency(play.spent)}</td>
          <td>${toCurrency(play.prize)}</td>
        </tr>
      `;
    })
    .join('');

  output.classList.remove('hidden');
  output.innerHTML = `
    <h2>Resultado oficial: ${data.game_type} concurso ${data.contest}</h2>
    <p>Data do sorteio: ${data.draw_date || 'N/A'} | Próximo: ${data.next_draw_date || 'N/A'}</p>
    <p><strong>Dezenas sorteadas:</strong></p>
    ${officialBalls}

    <div class="totals">
      <div class="total-item">
        <div class="total-label">Valor da aposta simples</div>
        <div class="total-value">${toCurrency(data.base_price)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Prêmio faixa principal</div>
        <div class="total-value">${toCurrency(data.prize_info.main_prize)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Estimado próximo concurso</div>
        <div class="total-value">${toCurrency(data.prize_info.estimated_next)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Acumulado próximo</div>
        <div class="total-value">${toCurrency(data.prize_info.accumulated_next)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Total gasto</div>
        <div class="total-value">${toCurrency(summary.total_spent)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Total ganho</div>
        <div class="total-value">${toCurrency(summary.total_won)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Lucro</div>
        <div class="total-value profit">${toCurrency(summary.profit)}</div>
      </div>
      <div class="total-item">
        <div class="total-label">Prejuízo</div>
        <div class="total-value loss">${toCurrency(summary.loss)}</div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Jogo #</th>
            <th>Números</th>
            <th>Acertos</th>
            <th>Valor jogado</th>
            <th>Valor ganho</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function exportResults() {
  if (!latestResult) {
    renderError(output, 'Nenhum resultado para exportar ainda.');
    return;
  }

  const maxColumns = Math.max(...latestResult.summary.plays.map((play) => play.numbers.length));
  const headers = ['jogo'];
  for (let i = 1; i <= maxColumns; i += 1) headers.push(`n${i}`);
  headers.push('acertos', 'valor_jogado', 'valor_ganho', 'resultado');

  const rows = latestResult.summary.plays.map((play) => {
    const cols = [play.index];
    for (let col = 0; col < maxColumns; col += 1) {
      const number = play.numbers[col];
      cols.push(number ? String(number).padStart(2, '0') : '');
    }

    const saldo = play.prize - play.spent;
    const resultado = saldo > 0 ? `lucro ${toCurrency(saldo)}` : saldo < 0 ? `prejuízo ${toCurrency(Math.abs(saldo))}` : 'empate';

    cols.push(play.hits, play.spent.toFixed(2), play.prize.toFixed(2), resultado);
    return cols.map((value) => csvEscape(value)).join(',');
  });

  const totals = [
    'TOTAL',
    ...Array(maxColumns).fill(''),
    '',
    latestResult.summary.total_spent.toFixed(2),
    latestResult.summary.total_won.toFixed(2),
    latestResult.summary.net >= 0
      ? `lucro total ${toCurrency(latestResult.summary.net)}`
      : `prejuízo total ${toCurrency(Math.abs(latestResult.summary.net))}`,
  ].map((value) => csvEscape(value)).join(',');

  const content = [headers.map((value) => csvEscape(value)).join(','), ...rows, totals].join('\n');
  downloadCsv(`resultado_${latestResult.game_type}_concurso_${latestResult.contest}.csv`, content);
}

async function updateBasePriceFromLatest() {
  const rule = getRule();
  try {
    const latest = await fetchCaixaResult(getGameType());
    currentBasePrice = latest.base_price || rule.fallback_base_price;
    priceSource.textContent = `Valor base atual da Caixa: ${toCurrency(currentBasePrice)}.`;
  } catch {
    currentBasePrice = rule.fallback_base_price;
    priceSource.textContent = `Não foi possível atualizar valor na Caixa. Usando referência: ${toCurrency(currentBasePrice)}.`;
  }

  renderSelectionStatus();
  renderPlays();
}

async function checkAllPlays() {
  output.classList.add('hidden');

  if (plays.length === 0) {
    renderError(output, 'Adicione pelo menos 1 jogo antes de conferir.');
    return;
  }

  const gameType = getGameType();
  const rule = getRule();

  try {
    const result = await fetchCaixaResult(gameType, contestInput.value ? Number(contestInput.value) : null);
    const basePrice = result.base_price || currentBasePrice || rule.fallback_base_price;

    const summary = evaluatePlays(plays, result.official_numbers, result.prize_map, rule.draw_size, basePrice);

    latestResult = {
      game_type: gameType,
      contest: result.contest,
      draw_date: result.draw_date,
      next_draw_date: result.next_draw_date,
      official_numbers: result.official_numbers,
      base_price: basePrice,
      prize_info: result.prize_info,
      summary,
    };

    exportResultsBtn.disabled = false;
    renderResult(latestResult);
  } catch (err) {
    renderError(output, err.message || 'Falha ao conferir jogos com dados da Caixa.');
  }
}

async function suggestGames() {
  suggestionsBox.classList.add('hidden');

  const gameType = getGameType();
  const rule = getRule();

  try {
    const latest = await fetchCaixaResult(gameType);
    const draws = await fetchRecentDraws(gameType, latest.contest, 30);
    const model = buildSuggestions(draws, getNumbersPerPlay(), rule.max_number, 5);
    renderSuggestions(model);
  } catch (err) {
    renderError(suggestionsBox, err.message || 'Não foi possível gerar sugestões no momento.');
  }
}

gameTypeSelect.addEventListener('change', async () => {
  resetAllForGameType();
  await updateBasePriceFromLatest();
});

numbersPerPlaySelect.addEventListener('change', () => {
  clearSelection();
  renderSelectionStatus();
});

addPlayBtn.addEventListener('click', addCurrentPlay);
clearSelectionBtn.addEventListener('click', clearSelection);

clearPlaysBtn.addEventListener('click', () => {
  plays = [];
  latestResult = null;
  output.classList.add('hidden');
  exportResultsBtn.disabled = true;
  renderPlays();
});

checkAllBtn.addEventListener('click', checkAllPlays);
suggestGamesBtn.addEventListener('click', suggestGames);
exportResultsBtn.addEventListener('click', exportResults);
downloadTemplateBtn.addEventListener('click', downloadTemplateCsv);

importCsvBtn.addEventListener('click', async () => {
  const file = csvFileInput.files[0];
  if (!file) {
    renderError(output, 'Selecione um arquivo CSV antes de importar.');
    return;
  }

  try {
    const text = await file.text();
    const imported = parseCsv(text);
    plays.push(...imported);
    renderPlays();
    output.classList.add('hidden');
  } catch (err) {
    renderError(output, err.message || 'Falha ao importar CSV.');
  }
});

(async function init() {
  resetAllForGameType();
  await updateBasePriceFromLatest();
})();
