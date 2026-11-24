import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { extractStoreFromHtml } from '../src/storage/serializer.js';
import { WORKSPACE_PACKS } from '../src/packs/index.js';

test('all 5 built single-file editions are self-contained, offline, valid JS, and embed their mode starter cards', () => {
  for (const pack of WORKSPACE_PACKS) {
    const distFile = path.resolve('dist', pack.filename);
    assert.equal(fs.existsSync(distFile), true, `dist/${pack.filename} must exist (run npm run build)`);
    const html = fs.readFileSync(distFile, 'utf8');

    assert.match(html, /^<!DOCTYPE html>/i);
    assert.ok(html.includes('<title>' + pack.siteTitle + '</title>'));
    assert.match(html, /<style id="tidly-core-css">/);
    assert.match(html, /<script id="tidly-store" type="application\/json">/);
    assert.match(html, /<script id="tidly-core-js">/);

    // Zero external dependencies
    assert.equal(/<script[^>]+src=/i.test(html), false);
    assert.equal(/<link[^>]+href=["']https?:/i.test(html), false);
    assert.equal(/@import\s+url\(/i.test(html), false);

    // Embedded store matches pack
    const storeData = extractStoreFromHtml(html);
    assert.ok(storeData && Array.isArray(storeData.tiddlers));
    assert.ok(storeData.tiddlers.some((t) => t.title === pack.landingCard));
    assert.ok(storeData.tiddlers.some((t) => t.title === '$:/ActiveMode' && t.text === pack.id));

    // Core JS parses cleanly without premature </script>
    const marker = '<script id="tidly-core-js">';
    const start = html.indexOf(marker) + marker.length;
    const close = '<' + '/script>';
    const end = html.indexOf(close, start);
    assert.ok(end > start);
    new vm.Script(html.slice(start, end), { filename: pack.filename + ':core-js' });
  }

  const indexFile = path.resolve('dist', 'index.html');
  assert.equal(fs.existsSync(indexFile), true, 'dist/index.html portal must exist');
  const indexHtml = fs.readFileSync(indexFile, 'utf8');
  assert.equal(/<script[^>]+src=/i.test(indexHtml), false);
  assert.equal(/<link[^>]+href=["']https?:/i.test(indexHtml), false);
  for (const pack of WORKSPACE_PACKS) {
    assert.ok(indexHtml.includes(pack.filename), `index.html must link to ${pack.filename}`);
  }
});
