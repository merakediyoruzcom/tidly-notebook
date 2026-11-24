import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { escapeHtml } from './src/core/utils.js';
import { serializeSingleHtml } from './src/storage/serializer.js';
import { WORKSPACE_PACKS, buildEditionStoreData } from './src/packs/index.js';

const ROOT = path.resolve('.');

const CSS_FILES = [
  'src/styles/tokens.css',
  'src/styles/layout.css',
  'src/styles/components.css'
];

const JS_FILES = [
  'src/core/utils.js',
  'src/core/i18n.js',
  'src/core/attachments.js',
  'src/core/store.js',
  'src/core/filter.js',
  'src/core/widgets.js',
  'src/core/parser.js',
  'src/core/crypto.js',
  'src/storage/serializer.js',
  'src/core/formats.js',
  'src/storage/persistence.js',
  'src/seed/starter-tiddlers.js',
  'src/packs/teacher.js',
  'src/packs/doctor.js',
  'src/packs/chef.js',
  'src/packs/student.js',
  'src/packs/index.js',
  'src/ui/icons.js',
  'src/ui/theme.js',
  'src/ui/widgets.js',
  'src/ui/modals.js',
  'src/ui/editor.js',
  'src/ui/river.js',
  'src/ui/sidebar.js',
  'src/ui/graph.js',
  'src/ui/app.js'
];

function transformModule(relPath, code) {
  const dir = path.posix.dirname(relPath);
  const exportsList = [];
  const outLines = [];

  for (const line of code.split(/\r?\n/)) {
    const impMatch = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/.exec(line);
    if (impMatch) {
      const bindings = impMatch[1].trim();
      const spec = impMatch[2].trim();
      const resolved = path.posix.normalize(path.posix.join(dir, spec));
      outLines.push(`const { ${bindings} } = __req(${JSON.stringify(resolved)});`);
      continue;
    }

    const expFn = /^export\s+(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (expFn) {
      exportsList.push(expFn[2]);
      outLines.push(line.replace(/^export\s+/, ''));
      continue;
    }

    const expClass = /^export\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (expClass) {
      exportsList.push(expClass[1]);
      outLines.push(line.replace(/^export\s+/, ''));
      continue;
    }

    const expConst = /^export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (expConst) {
      exportsList.push(expConst[1]);
      outLines.push(line.replace(/^export\s+/, ''));
      continue;
    }

    outLines.push(line);
  }

  for (const sym of exportsList) {
    outLines.push(`__exp.${sym} = ${sym};`);
  }

  return outLines.join('\n');
}

function bundleCss() {
  const parts = [];
  for (const rel of CSS_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      throw new Error('Missing CSS file: ' + rel);
    }
    const content = fs.readFileSync(full, 'utf8');
    if (/<\/style/i.test(content)) {
      throw new Error('Forbidden </style sequence in ' + rel);
    }
    parts.push('/* ' + rel + ' */\n' + content);
  }
  return parts.join('\n\n');
}

function bundleJs() {
  const entries = [];
  for (const rel of JS_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      throw new Error('Missing JS file: ' + rel);
    }
    const raw = fs.readFileSync(full, 'utf8');
    const transformed = transformModule(rel, raw);
    entries.push(
      `${JSON.stringify(rel)}: function (__req, __exp) {\n${transformed}\n}`
    );
  }

  const bundle = [
    '(function () {',
    "  'use strict';",
    '  const __mods = {',
    entries.join(',\n'),
    '  };',
    '  const __cache = {};',
    '  function __req(id) {',
    '    if (__cache[id]) return __cache[id];',
    '    const fn = __mods[id];',
    '    if (!fn) throw new Error("Module not found: " + id);',
    '    const exp = {};',
    '    __cache[id] = exp;',
    '    fn(__req, exp);',
    '    return exp;',
    '  }',
    '  __req("src/ui/app.js");',
    '})();'
  ].join('\n');

  if (new RegExp('<' + '/script', 'i').test(bundle)) {
    throw new Error('Forbidden closing script tag detected inside JS bundle.');
  }

  new vm.Script(bundle, { filename: 'tidly-core-js.bundle.js' });
  return bundle;
}

function buildLandingIndexHtml(packs) {
  const paletteSwatches = {
    paper: '#B8432E',
    classroom: '#1F6B48',
    clinic: '#145D8B',
    sepia: '#8C4A1C',
    night: '#E07258',
    forest: '#68B88E'
  };

  const cardsHtml = packs.map((pack) => {
    const accent = paletteSwatches[pack.palette] || '#B8432E';
    return [
      '<article class="ed-card" style="border-top-color:' + accent + ';">',
      '  <div class="ed-head">',
      '    <h2>' + escapeHtml(pack.nameTr) + '</h2>',
      '    <span class="ed-badge">' + escapeHtml(pack.badgeTr) + '</span>',
      '  </div>',
      '  <p class="ed-desc">' + escapeHtml(pack.descTr) + '</p>',
      '  <div class="ed-meta">Dosya: <code>' + escapeHtml(pack.filename) + '</code></div>',
      '  <div class="ed-actions">',
      '    <a class="btn btn-primary" href="./' + encodeURIComponent(pack.filename) + '">Tarayıcıda Aç</a>',
      '    <a class="btn" href="./' + encodeURIComponent(pack.filename) + '" download="' + escapeHtml(pack.filename) + '">Tek Dosya İndir</a>',
      '  </div>',
      '</article>'
    ].join('\n');
  }).join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="tr">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Tidly Notebook — Tek-Dosya Kişisel ve Mesleki Wiki</title>',
    '  <style>',
    '    :root { --bg:#F3EFE6; --surface:#FAF8F3; --surface2:#ECE6D9; --ink:#1F1C18; --muted:#5C554B; --border:#DDD5C7; --accent:#B8432E; }',
    '    * { box-sizing:border-box; }',
    '    body { margin:0; font-family:"Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.6; }',
    '    .wrap { max-width:1040px; margin:0 auto; padding:36px 20px 64px; }',
    '    header { border-bottom:1px solid var(--border); padding-bottom:24px; margin-bottom:28px; }',
    '    .eyebrow { font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent); margin-bottom:6px; }',
    '    h1 { margin:0 0 10px; font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif; font-size:clamp(1.9rem,4vw,2.75rem); line-height:1.15; letter-spacing:-0.02em; }',
    '    .lead { margin:0; max-width:680px; color:var(--muted); font-size:1.05rem; }',
    '    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }',
    '    .ed-card { background:var(--surface); border:1px solid var(--border); border-top:4px solid var(--accent); border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:10px; box-shadow:0 1px 2px rgba(20,16,10,0.04); }',
    '    .ed-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }',
    '    .ed-head h2 { margin:0; font-family:"Iowan Old Style",Georgia,serif; font-size:1.25rem; }',
    '    .ed-badge { font-size:0.75rem; font-weight:600; padding:3px 9px; border-radius:999px; background:var(--surface2); border:1px solid var(--border); }',
    '    .ed-desc { margin:0; color:var(--muted); font-size:0.93rem; }',
    '    .ed-meta { font-size:0.8rem; color:var(--muted); }',
    '    code { font-family:Consolas,monospace; background:var(--surface2); padding:2px 5px; border-radius:4px; }',
    '    .ed-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:auto; padding-top:6px; }',
    '    .btn { display:inline-flex; align-items:center; justify-content:center; min-height:38px; padding:7px 13px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--ink); text-decoration:none; font-size:0.875rem; font-weight:600; }',
    '    .btn:hover { background:var(--surface2); border-color:var(--muted); }',
    '    .btn-primary { background:var(--accent); border-color:var(--accent); color:#FFFFFF; }',
    '    .btn-primary:hover { filter:brightness(0.92); background:var(--accent); border-color:var(--accent); }',
    '    .facts { margin-top:32px; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; }',
    '    .facts h3 { margin:0 0 10px; font-family:"Iowan Old Style",Georgia,serif; font-size:1.2rem; }',
    '    .facts ul { margin:0; padding-left:1.3em; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:6px 20px; color:var(--muted); font-size:0.92rem; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="wrap">',
    '    <header>',
    '      <div class="eyebrow">Sıfır Sunucu · Çevrimdışı · Tek HTML Dosyası</div>',
    '      <h1>Tidly Notebook</h1>',
    '      <p class="lead">TiddlyWiki5 ruhunda, tüm notlarını, ekli materyallerini ve şablonlarını tek bir taşınabilir <code>.html</code> dosyasında saklayan kişisel ve mesleki bilgi defteri.</p>',
    '    </header>',
    '    <section class="grid">',
    cardsHtml,
    '    </section>',
    '    <section class="facts">',
    '      <h3>Neden Tek Dosya?</h3>',
    '      <ul>',
    '        <li>Kurulum, hesap veya bulut veritabanı gerekmez; tek <code>.html</code> dosyasını tarayıcıda açmak yeterlidir.</li>',
    '        <li><code>[[Bağlantı]]</code>, <code>{{İç İçe Gömme}}</code>, dinamik filtre dili ve bağlantı grafiği yerleşiktir.</li>',
    '        <li>Kartlara PDF, Word, Excel, görsel, ses (maks. 5 MB) ve Türkçe Excel <code>.csv</code> tabloları gömülebilir.</li>',
    '        <li>İsteğe bağlı <code>AES-256-GCM</code> parola şifreleme ve IndexedDB yerel otomatik yedekleme içerir.</li>',
    '      </ul>',
    '    </section>',
    '  </div>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function main() {
  const coreCss = bundleCss();
  const coreJs = bundleJs();
  const outDir = path.join(ROOT, 'dist');
  fs.mkdirSync(outDir, { recursive: true });

  for (const pack of WORKSPACE_PACKS) {
    const storeData = buildEditionStoreData(pack.id);
    const html = serializeSingleHtml({
      title: pack.siteTitle,
      lang: 'tr',
      palette: pack.palette,
      coreCss,
      coreJs,
      storeData
    });
    const outPath = path.join(outDir, pack.filename);
    fs.writeFileSync(outPath, html, 'utf8');
    const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
    console.log(`Built ${outPath} (${kb} KB)`);
  }

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, buildLandingIndexHtml(WORKSPACE_PACKS), 'utf8');
  console.log(`Built ${indexPath}`);
}

main();
