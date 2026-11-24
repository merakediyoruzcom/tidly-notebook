import test from 'node:test';
import assert from 'node:assert/strict';
import { TiddlerStore } from '../src/core/store.js';
import { renderWikiText, toggleTaskCheckbox, expandTemplatePlaceholders, extractMacros } from '../src/core/parser.js';

function makeStore() {
  return new TiddlerStore({
    tiddlers: [
      {
        title: 'Örnek Not',
        text: 'İçerik satırı **kalın** ve ==vurgulu==.',
        tags: ['Rehber'],
        fields: { durum: 'aktif', puan: '9' }
      },
      {
        title: 'Alt Bölüm',
        text: 'Alt bölüm metni.',
        tags: ['Rehber']
      },
      {
        title: 'Torun',
        text: 'Torun metni.',
        tags: ['Alt Bölüm']
      },
      {
        title: 'Satır Şablonu',
        text: 'Kart: [[{{!!title}}]] — Durum: {{!!durum}}'
      },
      {
        title: 'Kullanıcı Makroları',
        tags: ['$:/tags/Macro'],
        text: [
          '\\define selam(kisi)',
          'Merhaba **$kisi$**!',
          '\\end',
          '',
          '\\define sonsuz()',
          '<<sonsuz>>',
          '\\end'
        ].join('\n')
      },
      { title: 'Döngü A', text: 'Başlangıç {{Döngü B}}' },
      { title: 'Döngü B', text: 'Devam {{Döngü A}}' },
      { title: 'Kendine', text: '{{Kendine}}' }
    ]
  });
}

test('Markdown headings, formatting, callouts, tables, and copyable code blocks', () => {
  const store = makeStore();
  const md = [
    '# Ana Başlık',
    '',
    'Metin **kalın**, *italik*, ~~çizili~~ ve ==vurgulu==.',
    '',
    '> [!NOT]',
    '> Önemli bir bilgi.',
    '',
    '| Ad | Değer |',
    '| --- | --- |',
    '| Bir | 1 |',
    '',
    '```js',
    'const x = "[[link]]";',
    '```'
  ].join('\n');

  const html = renderWikiText(md, store);
  assert.match(html, /<h1>Ana Başlık<\/h1>/);
  assert.match(html, /<strong>kalın<\/strong>/);
  assert.match(html, /<em>italik<\/em>/);
  assert.match(html, /<del>çizili<\/del>/);
  assert.match(html, /<mark>vurgulu<\/mark>/);
  assert.match(html, /class="callout callout-note"/);
  assert.match(html, /<table>/);
  assert.match(html, /data-copy-code/);
  assert.match(html, /const x = &quot;\[\[link\]\]&quot;;/);
});

test('interactive task checklists and toggleTaskCheckbox', () => {
  const store = makeStore();
  const src = [
    '# Liste',
    '- [ ] Birinci iş',
    '- [x] İkinci iş'
  ].join('\n');

  const html = renderWikiText(src, store, { currentTiddler: 'Görevler' });
  assert.match(html, /data-task-line="1"/);
  assert.match(html, /data-task-line="2"[^>]*checked/);

  const toggled1 = toggleTaskCheckbox(src, 1);
  assert.equal(toggled1.split('\n')[1], '- [x] Birinci iş');
  const toggled2 = toggleTaskCheckbox(toggled1, 2);
  assert.equal(toggled2.split('\n')[2], '- [ ] İkinci iş');
});

test('wiki links, missing links, field transclusion, and live transclusion', () => {
  const store = makeStore();
  const src = [
    'Bkz. [[Örnek Not]] ve [[Etiket|Olmayan Kart]].',
    '',
    'Durum: {{Örnek Not!!durum}} | Kendi alanı: {{!!puan}}',
    '',
    '{{Örnek Not}}'
  ].join('\n');

  const html = renderWikiText(src, store, { currentTiddler: 'Örnek Not' });
  assert.match(html, /class="wiki-link" data-tiddler="Örnek Not"/);
  assert.match(html, /class="wiki-link is-missing" data-tiddler="Olmayan Kart"[^>]*>Etiket<\/a>/);
  assert.match(html, /Durum: aktif \| Kendi alanı: 9/);
  assert.match(html, /class="transclusion" data-transcluded="Örnek Not"/);
  assert.match(html, /İçerik satırı <strong>kalın<\/strong>/);
});

test('built-in macros: list (with template), count, toc, fields, new-card, set-field, and user \\define macros', () => {
  const store = makeStore();
  const macros = extractMacros(store);
  assert.equal(macros.has('selam'), true);

  const src = [
    'Sayı: <<count filter="[tag[Rehber]]">>',
    '',
    '<<list filter="[tag[Rehber]sort[title]]">>',
    '',
    '<<list filter="[title[Örnek Not]]" template="Satır Şablonu">>',
    '',
    '<<toc tag="Rehber">>',
    '',
    '<<fields>>',
    '',
    '<<new-card label="Günlük Ekle" template="Şablon: Günlük" tags="Günlük">>',
    '',
    '<<set-field tiddler="Örnek Not" field="durum" value="bitti" label="Tamamla">>',
    '',
    '<<selam "Dünya">>'
  ].join('\n');

  const html = renderWikiText(src, store, { currentTiddler: 'Örnek Not' });
  assert.match(html, />2</);
  assert.match(html, /data-tiddler="Alt Bölüm"/);
  assert.match(html, /Durum: aktif/);
  assert.match(html, /class="toc-tree"[\s\S]*Torun/);
  assert.match(html, /class="fields-table"[\s\S]*durum[\s\S]*aktif/);
  assert.match(html, /data-action="new-card"[^>]*data-template="Şablon: Günlük"/);
  assert.match(html, /data-action="set-field"[^>]*data-field="durum"[^>]*data-value="bitti"/);
  assert.match(html, /Merhaba <strong>Dünya<\/strong>!/);
});

test('XSS payloads and unsafe URLs/data URIs are neutralized (Review Focus #2)', () => {
  const store = makeStore();
  const evil = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[tıkla](javascript:alert(1))',
    '![svg](data:image/svg+xml;base64,PHN2Zz4=)',
    '![ok](data:image/png;base64,iVBORw0KGgo=)',
    '[güvenli](https://example.com)'
  ].join('\n\n');

  const html = renderWikiText(evil, store);
  assert.equal(/<script/i.test(html), false);
  assert.equal(/<img[^>]*onerror/i.test(html), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(/href="javascript:/i.test(html), false);
  assert.equal(/src="data:image\/svg\+xml/i.test(html), false);
  assert.match(html, /<img[^>]*src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /<a[^>]*href="https:\/\/example\.com"[^>]*>güvenli<\/a>/);
});

test('cyclic transclusions and recursive macros terminate cleanly without crashing (Review Focus #3)', () => {
  const store = makeStore();

  const ab = renderWikiText('{{Döngü A}}', store, { currentTiddler: 'Kök' });
  assert.match(ab, /transclusion-cycle/);

  const self = renderWikiText('{{Kendine}}', store, { currentTiddler: 'Kendine' });
  assert.match(self, /transclusion-cycle/);

  const recMacro = renderWikiText('<<sonsuz>>', store);
  assert.match(recMacro, /transclusion-cycle/);
});

test('expandTemplatePlaceholders formats date, time, and title without touching {{transclusions}}', () => {
  const d = new Date(2026, 10, 24, 9, 5); // Nov 24 2026, 09:05 local
  const out = expandTemplatePlaceholders('# ${baslik}\nTarih: ${tarih} ${saat}\n{{Örnek Not}}', {
    title: 'Toplantı',
    now: d
  });
  assert.equal(out, '# Toplantı\nTarih: 2026-11-24 09:05\n{{Örnek Not}}');
});
