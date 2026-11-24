import { trLower, trCompare } from './utils.js';

export class FilterSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FilterSyntaxError';
  }
}

export function parseFilter(expr) {
  const input = String(expr == null ? '' : expr).trim();
  if (!input) return [];

  const runs = [];
  let i = 0;
  const len = input.length;

  const skipWs = () => {
    while (i < len && /\s/.test(input[i])) i++;
  };

  while (i < len) {
    skipWs();
    if (i >= len) break;

    let prefix = '';
    if ((input[i] === '-' || input[i] === '+') && i + 1 < len && !/\s/.test(input[i + 1])) {
      prefix = input[i];
      i++;
    }

    if (input[i] === '[' && input[i + 1] === '[') {
      i += 2;
      const closeIdx = input.indexOf(']]', i);
      if (closeIdx < 0) {
        throw new FilterSyntaxError('Unclosed [[title]] bracket in filter.');
      }
      const title = input.slice(i, closeIdx);
      i = closeIdx + 2;
      runs.push({
        prefix,
        steps: [{ neg: false, op: 'title', suffix: '', operandType: 'literal', operand: title }]
      });
      continue;
    }

    if (input[i] === '[') {
      i++;
      const steps = [];
      while (i < len) {
        if (input[i] === ']') {
          i++;
          break;
        }
        let neg = false;
        if (input[i] === '!') {
          neg = true;
          i++;
        }
        const opStart = i;
        while (i < len && /[a-zA-Z0-9_-]/.test(input[i])) i++;
        const op = input.slice(opStart, i);
        if (!op) {
          throw new FilterSyntaxError('Expected filter operator near position ' + opStart + '.');
        }

        let suffix = '';
        if (input[i] === ':') {
          i++;
          const sufStart = i;
          while (i < len && input[i] !== '[' && input[i] !== '<' && !/\s/.test(input[i])) i++;
          suffix = input.slice(sufStart, i);
          if (!suffix) {
            throw new FilterSyntaxError('Empty operator suffix after ":" in "' + op + ':".');
          }
        }

        const openChar = input[i];
        if (openChar !== '[' && openChar !== '<') {
          throw new FilterSyntaxError('Expected "[" or "<" operand for operator "' + op + '".');
        }
        const closeChar = openChar === '[' ? ']' : '>';
        i++;
        const argStart = i;
        const closeIdx = input.indexOf(closeChar, argStart);
        if (closeIdx < 0) {
          throw new FilterSyntaxError('Unclosed "' + openChar + '...' + closeChar + '" operand for "' + op + '".');
        }
        const operand = input.slice(argStart, closeIdx);
        i = closeIdx + 1;

        steps.push({
          neg,
          op,
          suffix,
          operandType: openChar === '<' ? 'var' : 'literal',
          operand
        });

        if (i >= len) {
          throw new FilterSyntaxError('Unclosed "[" filter run.');
        }
      }
      if (!steps.length) {
        throw new FilterSyntaxError('Empty "[]" filter run is not allowed.');
      }
      runs.push({ prefix, steps });
      continue;
    }

    const start = i;
    while (i < len && !/\s/.test(input[i])) {
      if (input[i] === '[' || input[i] === ']') {
        throw new FilterSyntaxError('Unexpected "' + input[i] + '" in bare title.');
      }
      i++;
    }
    const bare = input.slice(start, i);
    runs.push({
      prefix,
      steps: [{ neg: false, op: 'title', suffix: '', operandType: 'literal', operand: bare }]
    });
  }

  return runs;
}

function getFieldValue(store, title, fieldName) {
  const t = store.get(title);
  if (!t) return fieldName === 'title' ? title : '';
  if (fieldName === 'title') return t.title;
  if (fieldName === 'text') return t.text;
  if (fieldName === 'type') return t.type;
  if (fieldName === 'created') return t.created;
  if (fieldName === 'modified') return t.modified;
  if (fieldName === 'tags') return t.tags.join(' ');
  return (t.fields && t.fields[fieldName] !== undefined) ? t.fields[fieldName] : '';
}

function hasFieldValue(store, title, fieldName) {
  const t = store.get(title);
  if (!t) return false;
  if (fieldName === 'tags') return t.tags.length > 0;
  return getFieldValue(store, title, fieldName) !== '';
}

function allNonSystemTitles(store) {
  return store.getAll({ includeSystem: false, includeShadows: false }).map((t) => t.title);
}

function allMissingTitles(store) {
  const missing = [];
  const seen = new Set();
  for (const t of store.getAll({ includeSystem: false, includeShadows: false })) {
    for (const target of store.getLinksFrom(t.title)) {
      if (!store.has(target) && !seen.has(target)) {
        seen.add(target);
        missing.push(target);
      }
    }
  }
  return missing.sort(trCompare);
}

function resolveOperand(step, vars) {
  if (step.operandType === 'var') {
    const key = step.operand.trim();
    return vars[key] !== undefined ? String(vars[key]) : '';
  }
  return step.operand;
}

function applyPredicate(inputList, pred, neg) {
  return inputList.filter((item) => {
    const ok = Boolean(pred(item));
    return neg ? !ok : ok;
  });
}

function evalStep(inputList, isFirstStep, step, store, currentTiddler, vars) {
  const arg = resolveOperand(step, vars);
  const op = step.op;
  const neg = step.neg;
  const suffix = step.suffix;

  const ensureUniverse = () => (isFirstStep ? allNonSystemTitles(store) : inputList);

  if (op === 'all') {
    let base = [];
    if (arg === 'tiddlers') base = allNonSystemTitles(store);
    else if (arg === 'system') {
      base = store.getAll({ includeSystem: true, includeShadows: true })
        .map((t) => t.title)
        .filter((t) => t.startsWith('$:/'));
    } else if (arg === 'shadows') {
      base = store.getAll({ includeSystem: true, includeShadows: true })
        .map((t) => t.title)
        .filter((t) => store.isShadow(t));
    } else if (arg === 'tags') {
      base = store.getAllTags({ includeSystem: false }).map((x) => x.tag);
    } else if (arg === 'current') {
      base = currentTiddler ? [currentTiddler] : [];
    } else {
      throw new FilterSyntaxError('Unknown "all" operand: "' + arg + '".');
    }
    if (isFirstStep) return neg ? [] : base;
    const set = new Set(base);
    return applyPredicate(inputList, (t) => set.has(t), neg);
  }

  if (op === 'current') {
    if (isFirstStep && !neg) return currentTiddler ? [currentTiddler] : [];
    return applyPredicate(ensureUniverse(), (t) => t === currentTiddler, neg);
  }

  if (op === 'title') {
    if (isFirstStep && !neg) return arg ? [arg] : [];
    return applyPredicate(ensureUniverse(), (t) => t === arg, neg);
  }

  if (op === 'tag') {
    return applyPredicate(ensureUniverse(), (t) => {
      const item = store.get(t);
      return item ? item.tags.includes(arg) : false;
    }, neg);
  }

  if (op === 'field') {
    const fieldName = suffix || arg;
    if (!suffix) {
      return applyPredicate(ensureUniverse(), (t) => hasFieldValue(store, t, fieldName), neg);
    }
    return applyPredicate(ensureUniverse(), (t) => getFieldValue(store, t, fieldName) === arg, neg);
  }

  if (op === 'has') {
    return applyPredicate(ensureUniverse(), (t) => hasFieldValue(store, t, arg), neg);
  }

  if (op === 'prefix') {
    const needle = trLower(arg);
    return applyPredicate(ensureUniverse(), (t) => trLower(t).startsWith(needle), neg);
  }

  if (op === 'suffix') {
    const needle = trLower(arg);
    return applyPredicate(ensureUniverse(), (t) => trLower(t).endsWith(needle), neg);
  }

  if (op === 'search') {
    const needle = trLower(arg).trim();
    if (!needle) return ensureUniverse();
    return applyPredicate(ensureUniverse(), (t) => {
      const item = store.get(t);
      if (!item) return trLower(t).includes(needle);
      if (trLower(item.title).includes(needle)) return true;
      if (trLower(item.text).includes(needle)) return true;
      if (item.tags.some((tg) => trLower(tg).includes(needle))) return true;
      for (const val of Object.values(item.fields || {})) {
        if (trLower(val).includes(needle)) return true;
      }
      return false;
    }, neg);
  }

  if (op === 'backlinks') {
    if (arg) {
      const backs = store.getBacklinks(arg);
      if (isFirstStep && !neg) return backs;
      const backSet = new Set(backs);
      return applyPredicate(ensureUniverse(), (t) => backSet.has(t), neg);
    }
    const sources = isFirstStep ? (currentTiddler ? [currentTiddler] : []) : inputList;
    const out = [];
    const seen = new Set();
    for (const s of sources) {
      for (const b of store.getBacklinks(s)) {
        if (!seen.has(b)) {
          seen.add(b);
          out.push(b);
        }
      }
    }
    return out;
  }

  if (op === 'links') {
    if (arg) {
      const targets = store.getLinksFrom(arg);
      if (isFirstStep && !neg) return targets;
      const targetSet = new Set(targets);
      return applyPredicate(ensureUniverse(), (t) => targetSet.has(t), neg);
    }
    const sources = isFirstStep ? (currentTiddler ? [currentTiddler] : []) : inputList;
    const out = [];
    const seen = new Set();
    for (const s of sources) {
      for (const target of store.getLinksFrom(s)) {
        if (!seen.has(target)) {
          seen.add(target);
          out.push(target);
        }
      }
    }
    return out;
  }

  if (op === 'missing') {
    if (isFirstStep && !neg) return allMissingTitles(store);
    return applyPredicate(ensureUniverse(), (t) => !store.has(t), neg);
  }

  if (op === 'orphans') {
    return applyPredicate(ensureUniverse(), (t) => {
      if (String(t).startsWith('$:/') || !store.has(t)) return false;
      return store.getBacklinks(t).length === 0;
    }, neg);
  }

  if (op === 'sort') {
    const fieldName = arg || 'title';
    const list = [...ensureUniverse()];
    list.sort((a, b) => {
      const va = getFieldValue(store, a, fieldName);
      const vb = getFieldValue(store, b, fieldName);
      let cmp;
      if (fieldName === 'modified' || fieldName === 'created') {
        cmp = va < vb ? -1 : (va > vb ? 1 : 0);
      } else {
        cmp = trCompare(va, vb);
      }
      if (cmp === 0) cmp = trCompare(a, b);
      return neg ? -cmp : cmp;
    });
    return list;
  }

  if (op === 'nsort') {
    const fieldName = arg || 'title';
    const list = [...ensureUniverse()];
    list.sort((a, b) => {
      const na = parseFloat(getFieldValue(store, a, fieldName));
      const nb = parseFloat(getFieldValue(store, b, fieldName));
      const aOk = !Number.isNaN(na);
      const bOk = !Number.isNaN(nb);
      if (!aOk && !bOk) return trCompare(a, b);
      if (!aOk) return 1;
      if (!bOk) return -1;
      const cmp = na - nb;
      return neg ? -cmp : (cmp !== 0 ? cmp : trCompare(a, b));
    });
    return list;
  }

  if (op === 'limit' || op === 'first') {
    const n = Math.max(0, parseInt(arg || '1', 10) || 0);
    return ensureUniverse().slice(0, n);
  }

  if (op === 'last') {
    const n = Math.max(0, parseInt(arg || '1', 10) || 0);
    const list = ensureUniverse();
    return n === 0 ? [] : list.slice(-n);
  }

  if (op === 'reverse') {
    return [...ensureUniverse()].reverse();
  }

  if (op === 'count') {
    return [String(ensureUniverse().length)];
  }

  throw new FilterSyntaxError('Unknown filter operator: "' + op + '".');
}

export function runFilter(expr, store, { currentTiddler = '' } = {}) {
  try {
    const runs = parseFilter(expr);
    const vars = { currentTiddler };
    let acc = [];

    for (const run of runs) {
      let current = run.prefix === '+' ? [...acc] : [];
      for (let idx = 0; idx < run.steps.length; idx++) {
        const isFirst = idx === 0 && run.prefix !== '+';
        current = evalStep(current, isFirst, run.steps[idx], store, currentTiddler, vars);
      }

      if (run.prefix === '+') {
        acc = Array.from(new Set(current));
      } else if (run.prefix === '-') {
        const drop = new Set(current);
        acc = acc.filter((item) => !drop.has(item));
      } else {
        const seen = new Set(acc);
        for (const item of current) {
          if (!seen.has(item)) {
            seen.add(item);
            acc.push(item);
          }
        }
      }
    }

    return { titles: acc, error: null };
  } catch (err) {
    return { titles: [], error: err && err.message ? err.message : String(err) };
  }
}
