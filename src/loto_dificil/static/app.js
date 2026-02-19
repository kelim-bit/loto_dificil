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

const clearSelectionBtn = document.getElementById('clear-selection');
const addPlayBtn = document.getElementById('add-play');
const clearPlaysBtn = document.getElementById('clear-plays');
const checkAllBtn = document.getElementById('check-all');
const suggestGamesBtn = document.getElementById('suggest-games');
const exportResultsBtn = document.getElementById('export-results');

const downloadTemplateBtn = document.getElementById('download-template');
const csvFileInput = document.getElementById('csv-file');
const importCsvBtn = document.getElementById('import-csv');

const rules = {
  megasena: { draw_size: 6, min_number: 1, max_number: 60, min_pick: 6, max_pick: 20, default_base_price: 5.0 },
  lotofacil: { draw_size: 15, min_number: 1, max_number: 25, min_pick: 15, max_pick: 20, default_base_price: 3.0 },
};

let selectedNumbers = new Set();
let plays = [];
let latestResult = null;

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

function formatFixed(value) {
  return Number(value || 0).toFixed(2);
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
  const base = rule.default_base_price;
  const estCost = stakeForPlay(target, rule.draw_size, base);

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
      const cost = stakeForPlay(play.length, rule.draw_size, rule.default_base_price);
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
  exportResultsBtn.disabled = true;
  output.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
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
  if (lines.length === 0) {
    throw new Error('CSV vazio.');
  }

  const separator = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(separator).map((col) => col.trim()));

  let start = 0;
  if (rows[0].some((cell) => /^n\d+$/i.test(cell) || /numero/i.test(cell))) {
    start = 1;
  }

  const rule = getRule();
  const parsed = [];
  for (let i = start; i < rows.length; i += 1) {
    const nums = rows[i]
      .map((cell) => Number(cell))
      .filter((n) => Number.isFinite(n) && n > 0);

    const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
    if (unique.length < rule.min_pick || unique.length > rule.max_pick) {
      continue;
    }

    const valid = unique.every((n) => n >= rule.min_number && n <= rule.max_number);
    if (!valid) continue;

    parsed.push(unique);
  }

  if (parsed.length === 0) {
    throw new Error('Nenhum jogo válido encontrado no CSV.');
  }

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
    renderError(output, 'Adicione pelo menos 1 jogo para baixar seus jogos em CSV.');
    return;
  }

  const maxColumns = Math.max(...plays.map((play) => play.length));
  const headers = ['Jogo'];
  for (let i = 1; i <= maxColumns; i += 1) {
    headers.push(`N°${i}`);
  }

  const rows = plays.map((play, idx) => {
    const cols = [idx + 1];
    for (let col = 0; col < maxColumns; col += 1) {
      cols.push(play[col] ?? '');
    }
    return cols.join(';');
  });

  const content = [headers.join(';'), ...rows].join('\n');
  downloadCsv(`jogos_${getGameType()}.csv`, content);
}

function renderSuggestions(data) {
  const hottest = data.model.hottest_numbers || [];
  const suggestions = data.model.suggestions || [];

  suggestionsBox.classList.remove('hidden');
  suggestionsBox.innerHTML = `
    <h2>Sugestões estatísticas</h2>
    <p class="hint">Baseado nos últimos ${data.model.draws_used} concursos.</p>
    <p><strong>Números mais frequentes:</strong> ${formatNumbers(hottest)}</p>
    <div class="plays-list">
      ${suggestions
        .map((play, idx) => `<div class="play-line"><strong>Sugestão ${idx + 1}:</strong> ${formatNumbers(play)}</div>`)
        .join('')}
    </div>
    <div class="row actions">
      <button type="button" id="add-suggestions" class="btn">Adicionar sugestões à lista</button>
    </div>
  `;

  const addSuggestionsBtn = document.getElementById('add-suggestions');
  addSuggestionsBtn.addEventListener('click', () => {
    suggestions.forEach((play) => plays.push(play));
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

  const totalBalance = latestResult.summary.total_won - latestResult.summary.total_spent;
  const contestTitle = latestResult.game_type === 'megasena' ? 'Mega Sena' : 'Lotofácil';

  const rows = [
    ['', '', contestTitle, `Concurso ${latestResult.contest}`, '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Jogo', 'Números', 'Acertos', 'Valor jogado', 'Lucro/Perda', 'Números acertados', 'Sequência premiada', 'Saldo final'],
  ];

  latestResult.summary.plays.forEach((play, idx) => {
    const balance = play.prize - play.spent;
    rows.push([
      play.index,
      formatNumbers(play.numbers),
      play.hits,
      formatFixed(play.spent),
      formatFixed(balance),
      formatNumbers(play.hit_numbers),
      idx === 0 ? formatNumbers(latestResult.official_numbers) : '',
      idx === 0 ? formatFixed(totalBalance) : '',
    ]);
  });

  const content = rows.map((row) => row.join(';')).join('\n');
  downloadCsv(`resultado_${latestResult.game_type}_concurso_${latestResult.contest}.csv`, content);
}

async function checkAllPlays() {
  output.classList.add('hidden');

  if (plays.length === 0) {
    renderError(output, 'Adicione pelo menos 1 jogo antes de conferir.');
    return;
  }

  try {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_type: getGameType(),
        contest: contestInput.value ? Number(contestInput.value) : null,
        plays,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      renderError(output, data.error || 'Falha ao conferir jogos.');
      return;
    }

    latestResult = data;
    exportResultsBtn.disabled = false;
    renderResult(data);
  } catch {
    renderError(output, 'Não foi possível comunicar com o servidor.');
  }
}

async function suggestGames() {
  suggestionsBox.classList.add('hidden');

  try {
    const response = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_type: getGameType(),
        numbers_per_play: getNumbersPerPlay(),
        suggestions_count: 5,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      renderError(suggestionsBox, data.error || 'Falha ao gerar sugestões.');
      return;
    }

    renderSuggestions(data);
  } catch {
    renderError(suggestionsBox, 'Não foi possível gerar sugestões no momento.');
  }
}

gameTypeSelect.addEventListener('change', resetAllForGameType);
numbersPerPlaySelect.addEventListener('change', () => {
  clearSelection();
  renderSelectionStatus();
});
addPlayBtn.addEventListener('click', addCurrentPlay);
clearSelectionBtn.addEventListener('click', clearSelection);
clearPlaysBtn.addEventListener('click', () => {
  plays = [];
  renderPlays();
  latestResult = null;
  exportResultsBtn.disabled = true;
  output.classList.add('hidden');
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

resetAllForGameType();
