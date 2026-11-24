import { escapeHtml } from './utils.js';

function splitTableCells(line) {
  let trimmed = String(line || '').trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

export function parseMarkdownTable(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++) {
    if (
      lines[i].includes('|') &&
      /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*(?::?-+:?\s*\|?)?\s*$/.test(lines[i + 1])
    ) {
      const headers = splitTableCells(lines[i]);
      const rows = [];
      let endLine = i + 1;
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|') && !/^\s*$/.test(lines[j])) {
        rows.push(splitTableCells(lines[j]));
        endLine = j;
        j++;
      }
      return { headers, rows, startLine: i, endLine };
    }
  }
  return null;
}

function parseLocaleNumber(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function computeGradebookStats(table, passThreshold = 50) {
  if (!table || !Array.isArray(table.headers)) {
    return { rows: [], classAvg: null, highest: null, lowest: null, passCount: 0, failCount: 0, totalCount: 0 };
  }
  const threshold = Number.isFinite(Number(passThreshold)) ? Number(passThreshold) : 50;
  const rows = [];
  const avgs = [];
  let passCount = 0;
  let failCount = 0;

  for (const rawRow of table.rows) {
    const cells = table.headers.map((_, idx) => (rawRow[idx] !== undefined ? String(rawRow[idx]) : ''));
    const nums = [];
    for (let c = 1; c < table.headers.length; c++) {
      const n = parseLocaleNumber(cells[c]);
      if (n !== null) nums.push(n);
    }
    const avg = nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    let passed = null;
    if (avg !== null) {
      passed = avg >= threshold;
      avgs.push(avg);
      if (passed) passCount++;
      else failCount++;
    }
    rows.push({ cells, avg, passed });
  }

  const classAvg = avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
  const highest = avgs.length ? Math.max(...avgs) : null;
  const lowest = avgs.length ? Math.min(...avgs) : null;

  return {
    rows,
    classAvg,
    highest,
    lowest,
    passCount,
    failCount,
    totalCount: rows.length
  };
}

export function appendTableRow(text, values) {
  const src = String(text == null ? '' : text);
  const table = parseMarkdownTable(src);
  if (!table) return src;
  const lines = src.split(/\r?\n/);
  const safeCells = table.headers.map((_, idx) => {
    const val = values[idx] !== undefined ? String(values[idx]) : '';
    return val.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
  });
  const newLine = '| ' + safeCells.join(' | ') + ' |';
  lines.splice(table.endLine + 1, 0, newLine);
  return lines.join('\n');
}

export function extractRecipeIngredients(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const sectionItems = [];
  let inIngredients = false;
  let foundHeading = false;

  for (const line of lines) {
    if (/^#{1,6}\s+(malzemeler|ingredients|içindekiler)/i.test(line.trim())) {
      inIngredients = true;
      foundHeading = true;
      continue;
    }
    if (inIngredients && /^#{1,6}\s+/.test(line.trim())) {
      inIngredients = false;
      continue;
    }
    if (inIngredients) {
      const m = /^\s*[-*+]\s+(.+)$/.exec(line);
      if (m) sectionItems.push(m[1].trim());
    }
  }

  if (foundHeading) return sectionItems;

  const fallback = [];
  for (const line of lines) {
    const m = /^\s*[-*+]\s+(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?.*)$/.exec(line);
    if (m) fallback.push(m[1].trim());
  }
  return fallback;
}

function formatScaledNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function scaleIngredientLine(line, ratio) {
  const src = String(line == null ? '' : line);
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0 || r === 1) return src;

  const bulletMatch = /^(\s*[-*+]\s+)(.*)$/.exec(src);
  const prefix = bulletMatch ? bulletMatch[1] : '';
  const body = (bulletMatch ? bulletMatch[2] : src).trim();

  // Range: e.g. "2-3 diş sarımsak"
  const rangeMatch = /^(\d+(?:[.,]\d+)?)\s*([-–])\s*(\d+(?:[.,]\d+)?)([\s\S]*)$/.exec(body);
  if (rangeMatch) {
    const a = Number(rangeMatch[1].replace(',', '.')) * r;
    const b = Number(rangeMatch[3].replace(',', '.')) * r;
    return prefix + formatScaledNumber(a) + rangeMatch[2] + formatScaledNumber(b) + rangeMatch[4];
  }

  // Mixed fraction: e.g. "1 1/2 su bardağı su"
  const mixedMatch = /^(\d+)\s+(\d+)\s*\/\s*(\d+)([\s\S]*)$/.exec(body);
  if (mixedMatch && Number(mixedMatch[3]) !== 0) {
    const val = (Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3])) * r;
    return prefix + formatScaledNumber(val) + mixedMatch[4];
  }

  // Simple fraction: e.g. "1/2 su bardağı"
  const fracMatch = /^(\d+)\s*\/\s*(\d+)([\s\S]*)$/.exec(body);
  if (fracMatch && Number(fracMatch[2]) !== 0) {
    const val = (Number(fracMatch[1]) / Number(fracMatch[2])) * r;
    return prefix + formatScaledNumber(val) + fracMatch[3];
  }

  // Leading integer or decimal (dot or comma)
  const numMatch = /^(\d+(?:[.,]\d+)?)([\s\S]*)$/.exec(body);
  if (numMatch) {
    const val = Number(numMatch[1].replace(',', '.')) * r;
    return prefix + formatScaledNumber(val) + numMatch[2];
  }

  return src;
}

export function calculateBmi(weightKg, heightCm) {
  const w = Number(weightKg);
  const hCm = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(hCm) || w <= 0 || hCm <= 0) return null;
  const hM = hCm / 100;
  const bmi = round1(w / (hM * hM));
  let category = 'normal';
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 25) category = 'normal';
  else if (bmi < 30) category = 'overweight';
  else category = 'obese';
  return { bmi, category };
}

export function calculateWeightDose(weightKg, mgPerKgDay, dosesPerDay = 1) {
  const w = Number(weightKg);
  const mg = Number(mgPerKgDay);
  const doses = Number(dosesPerDay);
  if (!Number.isFinite(w) || !Number.isFinite(mg) || !Number.isFinite(doses) || w <= 0 || mg <= 0 || doses <= 0) {
    return null;
  }
  const dailyMg = round1(w * mg);
  const singleDoseMg = round1(dailyMg / doses);
  return { dailyMg, singleDoseMg };
}

export function renderGradebookMacro(tiddlerText, currentTiddler, passThreshold = 50, lang = 'tr') {
  const table = parseMarkdownTable(tiddlerText);
  if (!table) {
    return '<div class="widget-box widget-gradebook"><p class="muted">' +
      escapeHtml(lang === 'en' ? 'Add a Markdown table to this card to activate Gradebook.' : 'Not çizelgesi hesaplaması için bu karta bir Markdown tablosu ekle.') +
      '</p></div>';
  }
  const stats = computeGradebookStats(table, passThreshold);
  const isEn = lang === 'en';

  const kpis =
    '<div class="gb-kpis">' +
      '<div class="gb-kpi"><span class="gb-kpi-val">' + stats.totalCount + '</span><span class="gb-kpi-lbl">' + escapeHtml(isEn ? 'Records' : 'Kayıt') + '</span></div>' +
      '<div class="gb-kpi"><span class="gb-kpi-val">' + (stats.classAvg !== null ? stats.classAvg : '—') + '</span><span class="gb-kpi-lbl">' + escapeHtml(isEn ? 'Class Avg' : 'Sınıf Ort.') + '</span></div>' +
      '<div class="gb-kpi"><span class="gb-kpi-val">' + stats.passCount + ' / ' + stats.failCount + '</span><span class="gb-kpi-lbl">' + escapeHtml(isEn ? 'Pass / Fail' : 'Geçen / Kalan') + '</span></div>' +
      '<div class="gb-kpi"><span class="gb-kpi-val">' + (stats.highest !== null ? stats.highest + ' / ' + stats.lowest : '—') + '</span><span class="gb-kpi-lbl">' + escapeHtml(isEn ? 'High / Low' : 'En Yük. / Düş.') + '</span></div>' +
    '</div>';

  const headCols = table.headers.map((h) => '<th>' + escapeHtml(h) + '</th>').join('') +
    '<th>' + escapeHtml(isEn ? 'Avg' : 'Ort.') + '</th>' +
    '<th>' + escapeHtml(isEn ? 'Status' : 'Durum') + '</th>';

  const bodyRows = stats.rows.map((r) => {
    const badge = r.passed === null
      ? '<span class="muted">—</span>'
      : (r.passed
        ? '<span class="gb-badge is-pass">' + escapeHtml(isEn ? 'Pass' : 'Geçti') + '</span>'
        : '<span class="gb-badge is-fail">' + escapeHtml(isEn ? 'Fail' : 'Kaldı') + '</span>');
    return '<tr>' +
      r.cells.map((c) => '<td>' + escapeHtml(c) + '</td>').join('') +
      '<td><strong>' + (r.avg !== null ? r.avg : '—') + '</strong></td>' +
      '<td>' + badge + '</td>' +
    '</tr>';
  }).join('');

  const addInputs = table.headers.map((h, idx) =>
    '<input class="input gb-add-input" type="text" data-gb-col="' + idx + '" placeholder="' + escapeHtml(h) + '">'
  ).join('');

  return (
    '<div class="widget-box widget-gradebook" data-widget="gradebook" data-tiddler="' + escapeHtml(currentTiddler) + '" data-pass="' + escapeHtml(String(passThreshold)) + '">' +
      '<div class="widget-head">' +
        '<strong>' + escapeHtml(isEn ? 'Gradebook Summary' : 'Not Çizelgesi Özeti') + '</strong>' +
        '<button type="button" class="btn btn-sm" data-gb-csv>' + escapeHtml(isEn ? 'Download CSV (Excel)' : 'CSV İndir (Excel)') + '</button>' +
      '</div>' +
      kpis +
      '<div class="table-wrap"><table><thead><tr>' + headCols + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>' +
      '<form class="gb-add-form" data-gb-form>' +
        addInputs +
        '<button type="submit" class="btn btn-primary btn-sm">+ ' + escapeHtml(isEn ? 'Add Row' : 'Satır Ekle') + '</button>' +
      '</form>' +
    '</div>'
  );
}

export function renderRecipeMacro(tiddlerText, currentTiddler, baseServings = 4, lang = 'tr') {
  const base = Math.max(1, parseInt(baseServings, 10) || 4);
  const ingredients = extractRecipeIngredients(tiddlerText);
  const isEn = lang === 'en';

  const itemsHtml = ingredients.length
    ? ingredients.map((line) => '<li data-raw-ing="' + escapeHtml(line) + '">' + escapeHtml(line) + '</li>').join('')
    : '<li class="muted">' + escapeHtml(isEn ? 'Add bullet ingredients under ## Ingredients.' : '## Malzemeler başlığı altına madde imli liste ekle.') + '</li>';

  return (
    '<div class="widget-box widget-recipe" data-widget="recipe" data-tiddler="' + escapeHtml(currentTiddler) + '" data-base-servings="' + base + '" data-cur-servings="' + base + '">' +
      '<div class="widget-head">' +
        '<strong>' + escapeHtml(isEn ? 'Portion Scaler' : 'Porsiyon Ölçekleyici') + '</strong>' +
        '<span class="muted">' + escapeHtml(isEn ? 'Base:' : 'Temel:') + ' ' + base + '</span>' +
      '</div>' +
      '<div class="recipe-controls">' +
        '<button type="button" class="btn btn-sm" data-recipe-step="-1" aria-label="-">−</button>' +
        '<span class="recipe-servings-badge" data-recipe-count>' + base + ' ' + escapeHtml(isEn ? 'servings' : 'kişilik') + '</span>' +
        '<button type="button" class="btn btn-sm" data-recipe-step="1" aria-label="+">+</button>' +
        '<button type="button" class="btn btn-sm" data-recipe-mult="0.5">0.5×</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-recipe-mult="1">1×</button>' +
        '<button type="button" class="btn btn-sm" data-recipe-mult="2">2×</button>' +
        '<button type="button" class="btn btn-sm" data-recipe-mult="3">3×</button>' +
        '<button type="button" class="btn btn-sm" data-recipe-shop>' + escapeHtml(isEn ? 'Add to Shopping List' : 'Alışveriş Listesine Ekle') + '</button>' +
      '</div>' +
      '<ul class="recipe-ing-list" data-recipe-list>' + itemsHtml + '</ul>' +
    '</div>'
  );
}

export function renderTimerMacro(minutes = 15, label = '', lang = 'tr') {
  const mins = Math.max(1, Math.min(240, parseInt(minutes, 10) || 15));
  const isEn = lang === 'en';
  const title = label || (isEn ? 'Timer' : 'Zamanlayıcı');
  const display = String(mins).padStart(2, '0') + ':00';

  return (
    '<div class="widget-box widget-timer" data-widget="timer" data-minutes="' + mins + '" data-label="' + escapeHtml(title) + '">' +
      '<div class="widget-head">' +
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<span class="timer-display" data-timer-display>' + display + '</span>' +
      '</div>' +
      '<div class="timer-controls">' +
        '<button type="button" class="btn btn-primary btn-sm" data-timer-toggle>' + escapeHtml(isEn ? 'Start' : 'Başlat') + '</button>' +
        '<button type="button" class="btn btn-sm" data-timer-reset>' + escapeHtml(isEn ? 'Reset' : 'Sıfırla') + '</button>' +
        '<button type="button" class="btn btn-sm" data-timer-add="60">+1 dk</button>' +
        '<button type="button" class="btn btn-sm" data-timer-add="300">+5 dk</button>' +
      '</div>' +
    '</div>'
  );
}

export function renderCalcMacro(type = 'bmi', lang = 'tr') {
  const isEn = lang === 'en';
  const kind = String(type || 'bmi').toLowerCase() === 'dose' ? 'dose' : 'bmi';

  if (kind === 'dose') {
    return (
      '<div class="widget-box widget-calc" data-widget="calc" data-calc-type="dose">' +
        '<div class="widget-head"><strong>' + escapeHtml(isEn ? 'Weight-Based Dose Calculator' : 'Kilo Bazlı Doz Hesaplayıcı') + '</strong></div>' +
        '<div class="calc-grid">' +
          '<label><span>' + escapeHtml(isEn ? 'Weight (kg)' : 'Kilo (kg)') + '</span><input class="input" type="number" step="0.1" min="0.5" value="20" data-calc-w></label>' +
          '<label><span>' + escapeHtml(isEn ? 'Dose (mg/kg/day)' : 'Günlük Doz (mg/kg/gün)') + '</span><input class="input" type="number" step="0.5" min="0.1" value="50" data-calc-mg></label>' +
          '<label><span>' + escapeHtml(isEn ? 'Doses / Day' : 'Günlük Bölünme') + '</span><input class="input" type="number" step="1" min="1" max="6" value="2" data-calc-div></label>' +
        '</div>' +
        '<div class="calc-result" data-calc-out></div>' +
        '<div class="muted" style="font-size:0.76rem;margin-top:4px;">' + escapeHtml(isEn ? 'Reference aid only — verify against clinical guidelines.' : 'Yalnızca hızlı hesaplama yardımcısıdır; klinik kılavuzla doğrulayın.') + '</div>' +
      '</div>'
    );
  }

  return (
    '<div class="widget-box widget-calc" data-widget="calc" data-calc-type="bmi">' +
      '<div class="widget-head"><strong>' + escapeHtml(isEn ? 'BMI Calculator (VKİ)' : 'Vücut Kitle İndeksi (VKİ)') + '</strong></div>' +
      '<div class="calc-grid">' +
        '<label><span>' + escapeHtml(isEn ? 'Weight (kg)' : 'Kilo (kg)') + '</span><input class="input" type="number" step="0.1" min="1" value="75" data-calc-w></label>' +
        '<label><span>' + escapeHtml(isEn ? 'Height (cm)' : 'Boy (cm)') + '</span><input class="input" type="number" step="1" min="30" value="180" data-calc-h></label>' +
      '</div>' +
      '<div class="calc-result" data-calc-out></div>' +
    '</div>'
  );
}
