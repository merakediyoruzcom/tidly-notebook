import test from 'node:test';
import assert from 'node:assert/strict';
import { TiddlerStore, extractLinksFromText, rewriteLinksInText } from '../src/core/store.js';

test('CRUD, normalization, and system tiddler separation', () => {
  const store = new TiddlerStore({
    tiddlers: [
      { title: 'İlk Kart', text: 'Merhaba [[İkinci Kart]]', tags: ['Genel'], fields: { durum: 'taslak' } },
      { title: '$:/CustomNote', text: 'Sistem notu' }
    ]
  });

  assert.equal(store.has('İlk Kart'), true);
  assert.equal(store.has('Olmayan'), false);
  assert.equal(store.get('İlk Kart').type, 'text/vnd.tidly');
  assert.equal(store.get('İlk Kart').fields.durum, 'taslak');

  // Cloning prevents external mutation of internal state
  const copy = store.get('İlk Kart');
  copy.tags.push('Sahte');
  assert.deepEqual(store.get('İlk Kart').tags, ['Genel']);

  // Non-system vs system listing
  assert.deepEqual(store.getAll().map((x) => x.title), ['İlk Kart']);
  assert.deepEqual(store.getAll({ includeSystem: true }).map((x) => x.title).sort(), ['$:/CustomNote', 'İlk Kart']);

  // Delete removes user tiddler
  store.delete('İlk Kart');
  assert.equal(store.has('İlk Kart'), false);
});

test('shadow tiddlers can be overridden and reset on delete', () => {
  const store = new TiddlerStore({
    shadows: [
      { title: '$:/SiteTitle', text: 'Tidly Notebook' }
    ]
  });

  assert.equal(store.isShadow('$:/SiteTitle'), true);
  assert.equal(store.isOverriddenShadow('$:/SiteTitle'), false);
  assert.equal(store.getText('$:/SiteTitle'), 'Tidly Notebook');
  assert.equal(store.getUserTiddlers().length, 0);

  store.put({ title: '$:/SiteTitle', text: 'Benim Defterim' });
  assert.equal(store.isOverriddenShadow('$:/SiteTitle'), true);
  assert.equal(store.getText('$:/SiteTitle'), 'Benim Defterim');
  assert.equal(store.getUserTiddlers().length, 1);

  // Deleting user override restores shadow default
  store.delete('$:/SiteTitle');
  assert.equal(store.isOverriddenShadow('$:/SiteTitle'), false);
  assert.equal(store.getText('$:/SiteTitle'), 'Tidly Notebook');
});

test('extractLinksFromText and getBacklinks ignore fenced and inline code', () => {
  const text = [
    'Normal [[Hedef Bir]] ve [[Görünen|Hedef İki]] ile {{Gömülen Kart}} ve {{Alan Kart!!durum}}.',
    '```js',
    'const ignored = "[[Kod İçi]] {{Kod Gömme}}";',
    '```',
    'Satır içi `[[Satır İçi Kod]]` da yok sayılmalı.'
  ].join('\n');

  assert.deepEqual(extractLinksFromText(text), ['Hedef Bir', 'Hedef İki', 'Gömülen Kart', 'Alan Kart']);

  const store = new TiddlerStore({
    tiddlers: [
      { title: 'Kaynak', text },
      { title: 'Hedef Bir', text: 'Hedef içerik' },
      { title: 'Başka', text: 'Sadece [[Hedef Bir]]' }
    ]
  });

  assert.deepEqual(store.getBacklinks('Hedef Bir').sort(), ['Başka', 'Kaynak']);
  assert.deepEqual(store.getBacklinks('Kod İçi'), []);
});

test('surgical rename updates [[links]], [[label|target]], {{transclusion}}, {{target!!field}}, and tags without touching code blocks or substring titles', () => {
  const store = new TiddlerStore({
    tiddlers: [
      { title: 'Not', text: 'Ana not' },
      { title: 'Not Defteri', text: 'Ayrı kart' },
      {
        title: 'İndeks',
        tags: ['Not', 'Diğer'],
        text: [
          'Bakınız [[Not]], ayrıca [[Detay|Not]] ve [[Not Defteri]].',
          'Gömme: {{Not}} ve alan: {{Not!!durum}}.',
          '```md',
          '[[Not]] ve {{Not}} kod bloğunda korunmalı.',
          '```',
          'Satır içi `[[Not]]` da korunmalı.'
        ].join('\n')
      }
    ]
  });

  const renamed = store.rename('Not', 'Yeni Not', { updateLinks: true });
  assert.equal(renamed.title, 'Yeni Not');
  assert.equal(store.has('Not'), false);
  assert.equal(store.has('Yeni Not'), true);

  const idx = store.get('İndeks');
  assert.deepEqual(idx.tags, ['Yeni Not', 'Diğer']);
  assert.match(idx.text, /\[\[Yeni Not\]\]/);
  assert.match(idx.text, /\[\[Detay\|Yeni Not\]\]/);
  assert.match(idx.text, /\[\[Not Defteri\]\]/);
  assert.match(idx.text, /\{\{Yeni Not\}\}/);
  assert.match(idx.text, /\{\{Yeni Not!!durum\}\}/);
  assert.match(idx.text, /```md\n\[\[Not\]\] ve \{\{Not\}\} kod bloğunda korunmalı\.\n```/);
  assert.match(idx.text, /`\[\[Not\]\]`/);

  // Rejects empty or duplicate rename
  assert.throws(() => store.rename('Yeni Not', ''));
  assert.throws(() => store.rename('Yeni Not', 'Not Defteri'));
});

test('rewriteLinksInText handles piped labels and field transclusions cleanly', () => {
  const input = '[[A]] [[Etiket|A]] {{A}} {{A!!status}} [[AB]]';
  const out = rewriteLinksInText(input, 'A', 'B');
  assert.equal(out, '[[B]] [[Etiket|B]] {{B}} {{B!!status}} [[AB]]');
});

test('setField and undo/redo cap at 50 steps', () => {
  const store = new TiddlerStore({
    tiddlers: [{ title: 'Sayaç', text: '0' }]
  });

  store.setField('Sayaç', 'durum', 'aktif');
  assert.equal(store.get('Sayaç').fields.durum, 'aktif');

  for (let i = 1; i <= 55; i++) {
    store.put({ title: 'Sayaç', text: String(i) });
  }
  assert.equal(store.getText('Sayaç'), '55');
  assert.equal(store.canUndo(), true);

  let steps = 0;
  while (store.undo()) steps++;
  assert.equal(steps, 50);
  assert.equal(store.getText('Sayaç'), '5');

  assert.equal(store.canRedo(), true);
  assert.equal(store.redo(), true);
  assert.equal(store.getText('Sayaç'), '6');
});
