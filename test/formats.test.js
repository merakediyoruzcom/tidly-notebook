import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportJson,
  importJson,
  exportTid,
  importTid,
  exportMarkdown,
  importMarkdown,
  importHtml
} from '../src/core/formats.js';

test('JSON export and import round-trip', () => {
  const cards = [
    { title: 'Bir', text: 'İçerik 1', tags: ['Etiket A', 'Etiket B'], fields: { durum: 'aktif' } }
  ];
  const json = exportJson(cards);
  const imported = importJson(json);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].title, 'Bir');
  assert.deepEqual(imported[0].tags, ['Etiket A', 'Etiket B']);
  assert.equal(imported[0].fields.durum, 'aktif');
});

test('TW5 .tid export and import round-trip with spaced tags and custom fields', () => {
  const card = {
    title: 'Proje Notu',
    text: 'İlk satır\nİkinci satır',
    tags: ['Genel', 'Önemli İş'],
    type: 'text/vnd.tidly',
    created: '20261124100000000',
    modified: '20261124110000000',
    fields: { durum: 'aktif', sorumlu: 'Ayşe' }
  };

  const tidText = exportTid(card);
  assert.match(tidText, /^created: 20261124100000000/m);
  assert.match(tidText, /^tags: Genel \[\[Önemli İş\]\]/m);
  assert.match(tidText, /^durum: aktif/m);

  const parsed = importTid(tidText);
  assert.equal(parsed.title, 'Proje Notu');
  assert.deepEqual(parsed.tags, ['Genel', 'Önemli İş']);
  assert.equal(parsed.fields.durum, 'aktif');
  assert.equal(parsed.fields.sorumlu, 'Ayşe');
  assert.equal(parsed.text, 'İlk satır\nİkinci satır');
});

test('Markdown YAML frontmatter export and import round-trip', () => {
  const card = {
    title: 'Günlük',
    text: '# Merhaba\nBugün verimli geçti.',
    tags: ['Günlük', 'Kişisel Not'],
    created: '20261124100000000',
    modified: '20261124110000000',
    fields: { ruh: 'sakin' }
  };

  const md = exportMarkdown(card);
  const parsed = importMarkdown(md);
  assert.equal(parsed.title, 'Günlük');
  assert.deepEqual(parsed.tags, ['Günlük', 'Kişisel Not']);
  assert.equal(parsed.fields.ruh, 'sakin');
  assert.equal(parsed.text, '# Merhaba\nBugün verimli geçti.');
});

test('importHtml parses both Tidly Notebook HTML and unencrypted TiddlyWiki5 HTML', () => {
  const tw5Html = [
    '<!DOCTYPE html><html><head></head><body>',
    '<script class="tiddlywiki-tiddler-store" type="application/json">',
    JSON.stringify([
      {
        title: 'TW5 Notu',
        text: 'Merhaba TW5',
        tags: 'Proje [[Uzun Etiket]]',
        created: '20250101120000000',
        modified: '20250101123000000',
        custom_key: 'deger'
      }
    ]),
    '<' + '/script></body></html>'
  ].join('\n');

  const res = importHtml(tw5Html);
  assert.equal(res.source, 'tiddlywiki5');
  assert.equal(res.encrypted, false);
  assert.equal(res.tiddlers.length, 1);
  assert.equal(res.tiddlers[0].title, 'TW5 Notu');
  assert.deepEqual(res.tiddlers[0].tags, ['Proje', 'Uzun Etiket']);
  assert.equal(res.tiddlers[0].fields.custom_key, 'deger');
});
