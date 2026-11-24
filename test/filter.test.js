import test from 'node:test';
import assert from 'node:assert/strict';
import { TiddlerStore } from '../src/core/store.js';
import { parseFilter, runFilter, FilterSyntaxError } from '../src/core/filter.js';

function makeFixtureStore() {
  return new TiddlerStore({
    tiddlers: [
      {
        title: 'İstanbul Gezisi',
        text: 'Boğaz hattı ve müze planı. Bkz. [[Ankara]] ve [[Eksik Kart]].',
        tags: ['Gezi', 'Proje'],
        modified: '20261124100000000',
        fields: { durum: 'aktif', oncelik: '2' }
      },
      {
        title: 'Isparta Notları',
        text: 'Gül bahçeleri notu.',
        tags: ['Gezi'],
        modified: '20261124110000000',
        fields: { durum: 'bitti', oncelik: '10' }
      },
      {
        title: 'Bursa',
        text: 'Marmara rotası, devamı [[İstanbul Gezisi]] içinde.',
        tags: ['Gezi'],
        modified: '20261124113000000',
        fields: {}
      },
      {
        title: 'Ankara',
        text: 'Başkent notları.',
        tags: ['Şehir'],
        modified: '20261124090000000',
        fields: { oncelik: '1' }
      },
      {
        title: 'Çalışma Planı',
        text: 'Tek başına yetim kart.',
        tags: ['Proje'],
        modified: '20261124120000000',
        fields: { durum: 'aktif', oncelik: '3' }
      },
      {
        title: 'Özet',
        text: 'Harf sırası testi.',
        tags: [],
        modified: '20261124080000000',
        fields: {}
      },
      {
        title: 'Şiir',
        text: 'Ş harfi.',
        tags: [],
        modified: '20261124070000000',
        fields: {}
      },
      {
        title: 'Ütopya',
        text: 'Ü harfi.',
        tags: [],
        modified: '20261124060000000',
        fields: {}
      },
      {
        title: '$:/SiteTitle',
        text: 'Tidly Notebook',
        tags: [],
        modified: '20261124050000000'
      }
    ],
    shadows: [
      { title: '$:/ShadowOnly', text: 'Gölge' }
    ]
  });
}

test('basic tag, field, has, and negation operators', () => {
  const store = makeFixtureStore();

  const proj = runFilter('[tag[Proje]!field:durum[bitti]sort[title]]', store);
  assert.equal(proj.error, null);
  assert.deepEqual(proj.titles, ['Çalışma Planı', 'İstanbul Gezisi']);

  const withPriority = runFilter('[has[oncelik]nsort[oncelik]]', store);
  assert.equal(withPriority.error, null);
  assert.deepEqual(withPriority.titles, ['Ankara', 'İstanbul Gezisi', 'Çalışma Planı', 'Isparta Notları']);

  const noPriority = runFilter('[all[tiddlers]!has[oncelik]sort[title]]', store);
  assert.deepEqual(noPriority.titles, ['Bursa', 'Özet', 'Şiir', 'Ütopya']);
});

test('multi-run union, subtract (-), filter (+), bare titles, and slicing', () => {
  const store = makeFixtureStore();

  const res = runFilter('[[Ankara]] [tag[Gezi]] -[title[Isparta Notları]] -[title[Bursa]] +[!sort[modified]]', store);
  assert.equal(res.error, null);
  assert.deepEqual(res.titles, ['İstanbul Gezisi', 'Ankara']);

  const limited = runFilter('[all[tiddlers]sort[modified]limit[2]]', store);
  assert.deepEqual(limited.titles, ['Ütopya', 'Şiir']);

  const lastOne = runFilter('[all[tiddlers]sort[modified]last[1]]', store);
  assert.deepEqual(lastOne.titles, ['Çalışma Planı']);

  const cnt = runFilter('[tag[Gezi]count[]]', store);
  assert.deepEqual(cnt.titles, ['3']);
});

test('Turkish locale search and Turkish alphabetical sort', () => {
  const store = makeFixtureStore();

  // Review Focus #5: Turkish İ/I/ı/i case folding
  const ist = runFilter('[search[istanbul]]', store);
  assert.deepEqual(ist.titles.sort(), ['Bursa', 'İstanbul Gezisi'].sort());

  const isp = runFilter('[search[ısparta]]', store);
  assert.deepEqual(isp.titles, ['Isparta Notları']);

  // Turkish alphabetical sort: Ankara < Bursa < Çalışma < Isparta < İstanbul < Özet < Şiir < Ütopya
  const sorted = runFilter('[all[tiddlers]sort[title]]', store);
  assert.deepEqual(sorted.titles, [
    'Ankara',
    'Bursa',
    'Çalışma Planı',
    'Isparta Notları',
    'İstanbul Gezisi',
    'Özet',
    'Şiir',
    'Ütopya'
  ]);
});

test('links, backlinks, currentTiddler, orphans, missing, system, and shadows', () => {
  const store = makeFixtureStore();

  const back = runFilter('[all[current]backlinks[]]', store, { currentTiddler: 'İstanbul Gezisi' });
  assert.deepEqual(back.titles, ['Bursa']);

  const links = runFilter('[title[İstanbul Gezisi]links[]]', store);
  assert.deepEqual(links.titles, ['Ankara', 'Eksik Kart']);

  const missing = runFilter('[missing[]]', store);
  assert.deepEqual(missing.titles, ['Eksik Kart']);

  const orphans = runFilter('[orphans[]sort[title]]', store);
  assert.ok(orphans.titles.includes('Çalışma Planı'));
  assert.ok(!orphans.titles.includes('Ankara'));

  const sys = runFilter('[all[system]prefix[$:/S]sort[title]]', store);
  assert.deepEqual(sys.titles, ['$:/ShadowOnly', '$:/SiteTitle']);

  const tags = runFilter('[all[tags]sort[title]]', store);
  assert.deepEqual(tags.titles, ['Gezi', 'Proje', 'Şehir']);
});

test('malformed filter expressions throw FilterSyntaxError in parseFilter and return clean error in runFilter', () => {
  const store = makeFixtureStore();

  assert.throws(() => parseFilter('[tag[Unclosed]'), FilterSyntaxError);
  assert.throws(() => parseFilter('[[Unclosed'), FilterSyntaxError);
  assert.throws(() => parseFilter('[]'), FilterSyntaxError);

  const bad = runFilter('[tag[Broken', store);
  assert.deepEqual(bad.titles, []);
  assert.ok(typeof bad.error === 'string' && bad.error.length > 0);
});
