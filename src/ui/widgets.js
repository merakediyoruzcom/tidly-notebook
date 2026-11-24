import { t } from '../core/i18n.js';
import { markdownTableToCsv } from '../core/attachments.js';
import { appendTableRow, scaleIngredientLine, calculateBmi, calculateWeightDose } from '../core/widgets.js';
import { downloadTextFile } from '../storage/persistence.js';
import { showToast } from './modals.js';

const timerStates = new Map();
const runningIntervals = new Set();

function clearIntervals() {
  for (const id of runningIntervals) {
    clearInterval(id);
  }
  runningIntervals.clear();
}

function formatClock(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Ignore audio context restrictions
  }
}

export function wireInteractiveWidgets(container, app, { resetTimers = false } = {}) {
  if (resetTimers) clearIntervals();
  const lang = app.lang();
  const isEn = lang === 'en';

  // 1. Gradebook widgets
  container.querySelectorAll('[data-widget="gradebook"]').forEach((box) => {
    const tiddlerTitle = box.getAttribute('data-tiddler');
    const form = box.querySelector('[data-gb-form]');
    const csvBtn = box.querySelector('[data-gb-csv]');

    if (form && tiddlerTitle) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = Array.from(form.querySelectorAll('[data-gb-col]'));
        const values = inputs.map((inp) => inp.value.trim());
        if (!values.some(Boolean)) return;
        const item = app.store.get(tiddlerTitle);
        if (!item) return;
        const nextText = appendTableRow(item.text, values);
        app.store.put({ ...item, text: nextText });
        app.render();
      });
    }

    if (csvBtn && tiddlerTitle) {
      csvBtn.addEventListener('click', () => {
        const item = app.store.get(tiddlerTitle);
        if (!item) return;
        const csv = markdownTableToCsv(item.text, ';');
        const safeName = tiddlerTitle.replace(/[^\w.-]+/g, '_') + '.csv';
        downloadTextFile(csv, safeName, 'text/csv;charset=utf-8');
      });
    }
  });

  // 2. Recipe widgets
  container.querySelectorAll('[data-widget="recipe"]').forEach((box) => {
    const base = Math.max(1, Number(box.getAttribute('data-base-servings')) || 4);
    let cur = base;
    const countEl = box.querySelector('[data-recipe-count]');
    const listEl = box.querySelector('[data-recipe-list]');
    const multBtns = Array.from(box.querySelectorAll('[data-recipe-mult]'));

    const updateView = () => {
      const ratio = cur / base;
      if (countEl) {
        countEl.textContent = cur + ' ' + (isEn ? 'servings' : 'kişilik');
      }
      multBtns.forEach((b) => {
        const m = Number(b.getAttribute('data-recipe-mult'));
        b.classList.toggle('btn-primary', Math.abs(m - ratio) < 0.01);
      });
      if (listEl) {
        listEl.querySelectorAll('[data-raw-ing]').forEach((li) => {
          const raw = li.getAttribute('data-raw-ing') || '';
          li.textContent = scaleIngredientLine(raw, ratio);
        });
      }
    };

    box.querySelectorAll('[data-recipe-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.getAttribute('data-recipe-step')) || 0;
        cur = Math.max(0.5, Math.round((cur + delta) * 2) / 2);
        updateView();
      });
    });

    multBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mult = Number(btn.getAttribute('data-recipe-mult')) || 1;
        cur = Math.max(0.5, Math.round(base * mult * 2) / 2);
        updateView();
      });
    });

    const shopBtn = box.querySelector('[data-recipe-shop]');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        const ratio = cur / base;
        const lines = Array.from(box.querySelectorAll('[data-raw-ing]'))
          .map((li) => '- [ ] ' + scaleIngredientLine(li.getAttribute('data-raw-ing') || '', ratio));
        if (!lines.length) return;
        const listTitle = isEn ? 'Shopping List' : 'Alışveriş Listesi';
        const existing = app.store.get(listTitle);
        const sourceCard = box.getAttribute('data-tiddler') || '';
        const header = sourceCard ? '\n\n### ' + sourceCard + ' (' + cur + ')\n' : '\n';
        const prevText = existing ? existing.text : '# ' + listTitle;
        app.store.put({
          title: listTitle,
          text: prevText + header + lines.join('\n'),
          tags: existing ? existing.tags : ['Mutfak', 'Liste']
        });
        showToast(t('shoppingListAdded', lang), {
          actionLabel: t('attachmentOpen', lang),
          onAction: () => app.openCard(listTitle)
        });
      });
    }
  });

  // 3. Timer widgets
  container.querySelectorAll('[data-widget="timer"]').forEach((box) => {
    const mins = Math.max(1, Number(box.getAttribute('data-minutes')) || 15);
    const label = box.getAttribute('data-label') || 'Timer';
    const key = label + ':' + mins;
    let state = timerStates.get(key);
    if (!state) {
      state = { remaining: mins * 60, running: false };
      timerStates.set(key, state);
    }

    const dispEl = box.querySelector('[data-timer-display]');
    const toggleBtn = box.querySelector('[data-timer-toggle]');
    const resetBtn = box.querySelector('[data-timer-reset]');

    const renderClock = () => {
      if (dispEl) dispEl.textContent = formatClock(state.remaining);
      if (toggleBtn) {
        toggleBtn.textContent = state.running
          ? (isEn ? 'Pause' : 'Duraklat')
          : (isEn ? 'Start' : 'Başlat');
      }
    };

    const startTick = () => {
      const id = setInterval(() => {
        if (!state.running || !document.body.contains(box)) {
          clearInterval(id);
          runningIntervals.delete(id);
          return;
        }
        if (state.remaining > 0) {
          state.remaining--;
          renderClock();
          if (state.remaining === 0) {
            state.running = false;
            renderClock();
            playGentleChime();
            showToast(label + ': 00:00');
          }
        }
      }, 1000);
      runningIntervals.add(id);
    };

    if (state.running) startTick();
    renderClock();

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (state.remaining === 0) state.remaining = mins * 60;
        state.running = !state.running;
        renderClock();
        if (state.running) startTick();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.running = false;
        state.remaining = mins * 60;
        renderClock();
      });
    }

    box.querySelectorAll('[data-timer-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const addSec = Number(btn.getAttribute('data-timer-add')) || 0;
        state.remaining = Math.max(0, state.remaining + addSec);
        renderClock();
      });
    });
  });

  // 4. Clinical calculators
  container.querySelectorAll('[data-widget="calc"]').forEach((box) => {
    const kind = box.getAttribute('data-calc-type');
    const outEl = box.querySelector('[data-calc-out]');
    const update = () => {
      if (!outEl) return;
      if (kind === 'bmi') {
        const w = box.querySelector('[data-calc-w]').value;
        const h = box.querySelector('[data-calc-h]').value;
        const res = calculateBmi(w, h);
        if (!res) {
          outEl.textContent = '—';
          return;
        }
        const catLabels = isEn
          ? { underweight: 'Underweight', normal: 'Normal', overweight: 'Overweight', obese: 'Obese' }
          : { underweight: 'Zayıf', normal: 'Normal', overweight: 'Fazla Kilolu', obese: 'Obez' };
        outEl.textContent = 'VKİ / BMI: ' + res.bmi + ' (' + catLabels[res.category] + ')';
      } else if (kind === 'dose') {
        const w = box.querySelector('[data-calc-w]').value;
        const mg = box.querySelector('[data-calc-mg]').value;
        const div = box.querySelector('[data-calc-div]').value;
        const res = calculateWeightDose(w, mg, div);
        if (!res) {
          outEl.textContent = '—';
          return;
        }
        outEl.textContent = isEn
          ? `Daily: ${res.dailyMg} mg/day · Single dose: ${res.singleDoseMg} mg`
          : `Günlük toplam: ${res.dailyMg} mg/gün · Tek doz: ${res.singleDoseMg} mg`;
      }
    };
    box.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', update));
    update();
  });
}
