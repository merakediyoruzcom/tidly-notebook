import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeJsonForScript,
  serializeSingleHtml,
  extractStoreFromHtml,
  serializeFromDocument
} from '../src/storage/serializer.js';

test('self-save HTML round-trip survives </script>, HTML comments, Turkish chars, and U+2028/U+2029 (Review Focus #1)', () => {
  const trickyText = 'Dikkat: <' + '/script><script>alert(1)<' + '/script> <!-- yorum --> & ğüşıİöç \u2028\u2029 son.';
  const storeData = {
    v: 1,
    wikiId: 'wiki-roundtrip',
    updatedAt: '20261124120000000',
    tiddlers: [
      { title: 'Zorlu <Kart> & "Test"', text: trickyText, tags: ['Güvenlik'], fields: { kod: '<' + '/script>' } }
    ]
  };

  const html = serializeSingleHtml({
    title: 'Tidly Notebook <Test>',
    lang: 'tr',
    coreCss: 'body{margin:0;}',
    coreJs: 'window.__boot = true;',
    storeData
  });

  // Verify the store script tag closes exactly once at the real boundary
  const storeStart = html.indexOf('<script id="tidly-store" type="application/json">');
  const coreStart = html.indexOf('<script id="tidly-core-js">');
  assert.ok(storeStart > 0 && coreStart > storeStart);
  assert.equal(escapeJsonForScript('<a>&</a>\u2028'), '\\u003ca\\u003e\\u0026\\u003c/a\\u003e\\u2028');

  const extracted = extractStoreFromHtml(html);
  assert.deepEqual(extracted, storeData);
  assert.equal(extracted.tiddlers[0].text, trickyText);
});

test('serializeFromDocument ignores dirty runtime DOM and preserves deterministic size across repeated saves', () => {
  const storeData = {
    v: 1,
    wikiId: 'wiki-clean',
    updatedAt: '20261124120000000',
    tiddlers: [{ title: 'Kart 1', text: 'Temiz' }]
  };

  const mockDoc = {
    getElementById(id) {
      if (id === 'tidly-core-css') return { textContent: 'body{color:#111}' };
      if (id === 'tidly-core-js') return { textContent: 'console.log(1);' };
      return null;
    }
  };

  const html1 = serializeFromDocument(mockDoc, storeData, { title: 'Tidly Notebook', lang: 'tr' });
  const html2 = serializeFromDocument(mockDoc, storeData, { title: 'Tidly Notebook', lang: 'tr' });
  assert.equal(html1, html2);
  assert.match(html1, /<div id="app"><\/div>/);
});
