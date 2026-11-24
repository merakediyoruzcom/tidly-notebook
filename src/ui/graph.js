import { escapeHtml } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { runFilter } from '../core/filter.js';
import { createModal } from './modals.js';

function buildGraphData(store, { mode = 'global', centerTitle = '', tagFilter = '' }) {
  let titles = runFilter(
    tagFilter ? '[all[tiddlers]tag[' + tagFilter + ']sort[title]]' : '[all[tiddlers]sort[title]]',
    store
  ).titles;

  if (mode === 'local' && centerTitle && store.has(centerTitle)) {
    const keep = new Set([centerTitle]);
    const frontier = [centerTitle];
    for (let hop = 0; hop < 2; hop++) {
      const next = [];
      for (const cur of frontier) {
        for (const out of store.getLinksFrom(cur)) {
          if (!keep.has(out) && !out.startsWith('$:/')) {
            keep.add(out);
            if (store.has(out)) next.push(out);
          }
        }
        for (const inc of store.getBacklinks(cur)) {
          if (!keep.has(inc) && !inc.startsWith('$:/')) {
            keep.add(inc);
            next.push(inc);
          }
        }
      }
      frontier.length = 0;
      frontier.push(...next);
    }
    titles = Array.from(keep);
  }

  const nodeMap = new Map();
  const count = Math.max(1, titles.length);
  titles.forEach((title, idx) => {
    const angle = (idx / count) * Math.PI * 2;
    const radius = 85 + (idx % 3) * 32;
    nodeMap.set(title, {
      id: title,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      degree: 0,
      missing: !store.has(title)
    });
  });

  const edges = [];
  const edgeSeen = new Set();
  for (const src of titles) {
    if (!store.has(src)) continue;
    for (const target of store.getLinksFrom(src)) {
      if (target === src || target.startsWith('$:/')) continue;
      if (!nodeMap.has(target) && mode === 'global' && !tagFilter) {
        nodeMap.set(target, {
          id: target,
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
          degree: 0,
          missing: !store.has(target)
        });
      }
      if (nodeMap.has(target)) {
        const key = src + '->' + target;
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key);
          edges.push({ source: src, target });
          nodeMap.get(src).degree++;
          nodeMap.get(target).degree++;
        }
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), nodeMap, edges };
}

export function openGraphModal(app) {
  const lang = app.lang();
  let rafId = null;
  let mode = 'global';
  let tagFilter = '';
  let listMode = false;

  const { card, close } = createModal({
    title: t('graphTitle', lang),
    wide: true,
    onClose: () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    }
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'graph-toolbar';

  const allTags = app.store.getAllTags({ includeSystem: false });
  toolbar.innerHTML =
    '<button type="button" class="btn btn-sm btn-primary" data-g-mode="global">' + escapeHtml(t('graphGlobal', lang)) + '</button>' +
    '<button type="button" class="btn btn-sm" data-g-mode="local">' + escapeHtml(t('graphLocal', lang)) + '</button>' +
    '<select class="select" data-g-tag style="width:auto;min-height:30px;padding:4px 8px;">' +
      '<option value="">' + escapeHtml(t('graphAllTags', lang)) + '</option>' +
      allTags.map((x) => '<option value="' + escapeHtml(x.tag) + '">' + escapeHtml(x.tag) + ' (' + x.count + ')</option>').join('') +
    '</select>' +
    '<button type="button" class="btn btn-sm" data-g-fit>' + escapeHtml(t('graphFit', lang)) + '</button>' +
    '<button type="button" class="btn btn-sm" data-g-list>' + escapeHtml(t('graphListMode', lang)) + '</button>' +
    '<span class="muted" data-g-stats style="margin-left:auto;"></span>';

  const stage = document.createElement('div');
  stage.className = 'graph-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'graph-canvas';
  const listView = document.createElement('div');
  listView.style.cssText = 'display:none;padding:12px;height:100%;overflow-y:auto;';

  stage.appendChild(canvas);
  stage.appendChild(listView);
  card.appendChild(toolbar);
  card.appendChild(stage);

  const statsEl = toolbar.querySelector('[data-g-stats]');
  const ctx = canvas.getContext('2d');
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let graph = buildGraphData(app.store, { mode, centerTitle: app.getActiveCard(), tagFilter });
  let cam = { x: 0, y: 0, scale: 1 };
  let hovered = null;
  let draggedNode = null;
  let panning = false;
  let pointerDownPos = null;
  let movedPx = 0;
  const activePointers = new Map();
  let lastPinchDist = 0;

  const getThemeColors = () => {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue('--bg').trim() || '#F3EFE6',
      surface: cs.getPropertyValue('--surface').trim() || '#FAF8F3',
      ink: cs.getPropertyValue('--ink').trim() || '#1F1C18',
      muted: cs.getPropertyValue('--muted').trim() || '#5C554B',
      border: cs.getPropertyValue('--border').trim() || '#DDD5C7',
      accent: cs.getPropertyValue('--accent').trim() || '#B8432E'
    };
  };

  const syncCanvasSize = () => {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(260, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    return { w, h, dpr };
  };

  const screenToWorld = (sx, sy, w, h) => ({
    x: (sx - w / 2 - cam.x) / cam.scale,
    y: (sy - h / 2 - cam.y) / cam.scale
  });

  const findNodeAt = (wx, wy) => {
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const n = graph.nodes[i];
      const r = 8 + Math.min(8, n.degree * 1.5);
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= (r + 8) * (r + 8)) return n;
    }
    return null;
  };

  const stepPhysics = () => {
    const nodes = graph.nodes;
    const nLen = nodes.length;
    for (let i = 0; i < nLen; i++) {
      for (let j = i + 1; j < nLen; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = 0.7; dy = 0.7; d2 = 1; }
        const force = 2200 / d2;
        const dist = Math.sqrt(d2);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a !== draggedNode) { a.vx -= fx; a.vy -= fy; }
        if (b !== draggedNode) { b.vx += fx; b.vy += fy; }
      }
    }

    for (const edge of graph.edges) {
      const a = graph.nodeMap.get(edge.source);
      const b = graph.nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 105) * 0.035;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (a !== draggedNode) { a.vx += fx; a.vy += fy; }
      if (b !== draggedNode) { b.vx -= fx; b.vy -= fy; }
    }

    for (const n of nodes) {
      if (n === draggedNode) continue;
      n.vx = (n.vx - n.x * 0.006) * 0.82;
      n.vy = (n.vy - n.y * 0.006) * 0.82;
      n.x += n.vx;
      n.y += n.vy;
    }
  };

  const fitCamera = () => {
    const { w, h } = syncCanvasSize();
    if (!graph.nodes.length) {
      cam = { x: 0, y: 0, scale: 1 };
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of graph.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const spanX = Math.max(120, maxX - minX);
    const spanY = Math.max(120, maxY - minY);
    const padX = w < 440 ? 96 : 140;
    const padY = 80;
    const scale = Math.min(1.15, Math.max(0.38, Math.min((w - padX) / spanX, (h - padY) / spanY)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    cam = { x: -cx * scale, y: -cy * scale, scale };
  };

  const draw = () => {
    if (!ctx) return;
    const { w, h, dpr } = syncCanvasSize();
    const colors = getThemeColors();
    const activeTitle = app.getActiveCard();
    const maxLabel = w < 440 ? 15 : 22;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
    ctx.scale(cam.scale, cam.scale);

    for (const edge of graph.edges) {
      const a = graph.nodeMap.get(edge.source);
      const b = graph.nodeMap.get(edge.target);
      if (!a || !b) continue;
      const highlight = hovered && (hovered.id === a.id || hovered.id === b.id);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = highlight ? colors.accent : colors.border;
      ctx.lineWidth = highlight ? 2 : 1.2;
      ctx.stroke();
    }

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const n of graph.nodes) {
      const r = 7 + Math.min(7, n.degree * 1.4);
      const isHighlight = n === hovered || n.id === activeTitle;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHighlight ? colors.accent : (n.missing ? colors.bg : colors.surface);
      ctx.fill();
      ctx.lineWidth = isHighlight ? 2.5 : 1.5;
      ctx.strokeStyle = n.missing ? colors.muted : colors.accent;
      ctx.stroke();

      ctx.fillStyle = isHighlight ? colors.accent : colors.ink;
      const label = n.id.length > maxLabel ? n.id.slice(0, maxLabel - 2) + '…' : n.id;
      ctx.fillText(label, n.x, n.y + r + 4);
    }

    ctx.restore();
  };

  const renderAccessibleList = () => {
    listView.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'side-list';
    for (const n of graph.nodes) {
      const li = document.createElement('li');
      li.className = 'side-list-item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'side-link';
      const targets = app.store.getLinksFrom(n.id);
      btn.textContent = n.id + (targets.length ? ' -> ' + targets.join(', ') : '');
      btn.addEventListener('click', () => {
        close();
        app.openCard(n.id);
      });
      li.appendChild(btn);
      ul.appendChild(li);
    }
    listView.appendChild(ul);
  };

  const reloadGraph = () => {
    graph = buildGraphData(app.store, { mode, centerTitle: app.getActiveCard(), tagFilter });
    statsEl.textContent = t('graphNodesCount', lang, { nodes: graph.nodes.length, edges: graph.edges.length });
    for (let i = 0; i < (reducedMotion ? 160 : 80); i++) stepPhysics();
    fitCamera();
    renderAccessibleList();
    draw();
  };

  let ticks = 0;
  const tick = () => {
    if (!listMode && (ticks < 220 || draggedNode)) {
      stepPhysics();
      ticks++;
    }
    draw();
    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    activePointers.set(e.pointerId, { x: sx, y: sy });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      draggedNode = null;
      panning = false;
      return;
    }

    pointerDownPos = { x: sx, y: sy };
    movedPx = 0;
    const wPos = screenToWorld(sx, sy, rect.width, rect.height);
    const hit = findNodeAt(wPos.x, wPos.y);
    if (hit) {
      draggedNode = hit;
    } else {
      panning = true;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const prev = activePointers.get(e.pointerId);
    activePointers.set(e.pointerId, { x: sx, y: sy });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist > 0) {
        cam.scale = Math.min(3, Math.max(0.35, cam.scale * (dist / lastPinchDist)));
        if (reducedMotion) draw();
      }
      lastPinchDist = dist;
      return;
    }

    if (pointerDownPos) {
      movedPx = Math.max(movedPx, Math.hypot(sx - pointerDownPos.x, sy - pointerDownPos.y));
    }

    if (draggedNode) {
      const wPos = screenToWorld(sx, sy, rect.width, rect.height);
      draggedNode.x = wPos.x;
      draggedNode.y = wPos.y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
      if (reducedMotion) draw();
    } else if (panning && prev) {
      cam.x += sx - prev.x;
      cam.y += sy - prev.y;
      if (reducedMotion) draw();
    } else {
      const wPos = screenToWorld(sx, sy, rect.width, rect.height);
      hovered = findNodeAt(wPos.x, wPos.y);
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
      if (reducedMotion) draw();
    }
  });

  const endPointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    activePointers.delete(e.pointerId);
    lastPinchDist = 0;

    if (draggedNode && movedPx < 6) {
      const targetId = draggedNode.id;
      draggedNode = null;
      panning = false;
      close();
      app.openCard(targetId);
      return;
    }
    if (!draggedNode && panning && movedPx < 6) {
      const wPos = screenToWorld(sx, sy, rect.width, rect.height);
      const hit = findNodeAt(wPos.x, wPos.y);
      if (hit) {
        draggedNode = null;
        panning = false;
        close();
        app.openCard(hit.id);
        return;
      }
    }
    draggedNode = null;
    panning = false;
    pointerDownPos = null;
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    cam.scale = Math.min(3, Math.max(0.35, cam.scale * factor));
    if (reducedMotion) draw();
  }, { passive: false });

  toolbar.querySelectorAll('[data-g-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.getAttribute('data-g-mode');
      toolbar.querySelectorAll('[data-g-mode]').forEach((b) => {
        b.classList.toggle('btn-primary', b.getAttribute('data-g-mode') === mode);
      });
      ticks = 0;
      reloadGraph();
    });
  });

  toolbar.querySelector('[data-g-tag]').addEventListener('change', (e) => {
    tagFilter = e.target.value;
    ticks = 0;
    reloadGraph();
  });

  toolbar.querySelector('[data-g-fit]').addEventListener('click', () => {
    fitCamera();
    draw();
  });

  const listToggleBtn = toolbar.querySelector('[data-g-list]');
  listToggleBtn.addEventListener('click', () => {
    listMode = !listMode;
    canvas.style.display = listMode ? 'none' : 'block';
    listView.style.display = listMode ? 'block' : 'none';
    listToggleBtn.textContent = listMode ? t('graphCanvasMode', lang) : t('graphListMode', lang);
  });

  reloadGraph();
  if (!reducedMotion) {
    rafId = requestAnimationFrame(tick);
  }
}
