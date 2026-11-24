import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ATTACHMENT_BYTES,
  isAllowedAttachmentMime,
  validateAttachment,
  formatBytes,
  csvToMarkdownTable,
  markdownTableToCsv
} from '../src/core/attachments.js';
import { TiddlerStore } from '../src/core/store.js';
import { exportJson, importJson, importCsv } from '../src/core/formats.js';
import { serializeSingleHtml, extractStoreFromHtml } from '../src/storage/serializer.js';

test('validateAttachment blocks XSS MIME types, dangerous extensions, and oversized files (Review Focus #1)', () => {
  assert.equal(isAllowedAttachmentMime('text/html', 'evil.html'), false);
  assert.equal(isAllowedAttachmentMime('image/svg+xml', 'logo.svg'), false);
  assert.equal(isAllowedAttachmentMime('application/javascript', 'run.js'), false);
  assert.equal(isAllowedAttachmentMime('application/octet-stream', 'payload.html'), false);
  assert.equal(isAllowedAttachmentMime('text/plain', 'script.bat'), false);

  const htmlAtt = validateAttachment({ name: 'page.html', mime: 'text/html', size: 100, dataUrl: 'data:text/html;base64,PGgxPkE8L2gxPg==' });
  assert.equal(htmlAtt.ok, false);

  const svgAtt = validateAttachment({ name: 'icon.svg', mime: 'image/svg+xml', size: 100, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' });
  assert.equal(svgAtt.ok, false);

  const bigAtt = validateAttachment({ name: 'huge.pdf', mime: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1, dataUrl: 'data:application/pdf;base64,AA==' });
  assert.equal(bigAtt.ok, false);

  const pdfOk = validateAttachment({ name: 'Ders Notu.pdf', mime: 'application/pdf', size: 2048, dataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=' });
  assert.equal(pdfOk.ok, true);
  assert.equal(pdfOk.attachment.name, 'Ders Notu.pdf');
  assert.equal(pdfOk.attachment.mime, 'application/pdf');
  assert.equal(pdfOk.attachment.size, 2048);
  assert.ok(pdfOk.attachment.id);

  const docxOk = validateAttachment({
    name: 'Ödev 1.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 4096,
    dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQ='
  });
  assert.equal(docxOk.ok, true);

  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
});

test('attachments persist through TiddlerStore put/rename/undo, JSON import/export, and HTML serializer', () => {
  const att = validateAttachment({
    name: 'Deney Föyü.pdf',
    mime: 'application/pdf',
    size: 1024,
    dataUrl: 'data:application/pdf;base64,JVBERi0='
  }).attachment;

  const store = new TiddlerStore({
    tiddlers: [{ title: 'Fizik Ders 1', text: 'Föy ektedir.', tags: ['Ders'], attachments: [att] }]
  });

  assert.equal(store.get('Fizik Ders 1').attachments.length, 1);
  assert.equal(store.get('Fizik Ders 1').attachments[0].name, 'Deney Föyü.pdf');

  store.rename('Fizik Ders 1', 'Fizik Ders 2');
  assert.equal(store.get('Fizik Ders 2').attachments[0].name, 'Deney Föyü.pdf');

  store.undo();
  assert.equal(store.get('Fizik Ders 1').attachments[0].name, 'Deney Föyü.pdf');

  const json = exportJson(store.getUserTiddlers());
  const reimported = importJson(json);
  assert.equal(reimported[0].attachments.length, 1);
  assert.equal(reimported[0].attachments[0].dataUrl, 'data:application/pdf;base64,JVBERi0=');

  const html = serializeSingleHtml({
    title: 'Test',
    lang: 'tr',
    coreCss: '',
    coreJs: '',
    storeData: { v: 1, wikiId: 'w1', updatedAt: '20261124', tiddlers: store.getUserTiddlers() }
  });
  const extracted = extractStoreFromHtml(html);
  assert.equal(extracted.tiddlers[0].attachments[0].name, 'Deney Föyü.pdf');
});

test('Turkish Excel CSV import/export handles BOM, semicolons, quotes, and Turkish chars (Review Focus #2)', () => {
  const csv = '\uFEFFÖğrenci Adı;Vize;Final;Açıklama\r\n"Yılmaz, Ayşe";85;90;"Çok iyi; düzenli"\r\nMehmet Öz;72,5;80;Katılım tam\r\n';
  const md = csvToMarkdownTable(csv);

  assert.match(md, /\| Öğrenci Adı \| Vize \| Final \| Açıklama \|/);
  assert.match(md, /\| Yılmaz, Ayşe \| 85 \| 90 \| Çok iyi; düzenli \|/);
  assert.match(md, /\| Mehmet Öz \| 72,5 \| 80 \| Katılım tam \|/);

  const backCsv = markdownTableToCsv(md, ';');
  assert.equal(backCsv.startsWith('\uFEFF'), true);
  assert.match(backCsv, /Yılmaz, Ayşe;85;90;"Çok iyi; düzenli"/);
  assert.match(backCsv, /Mehmet Öz;72,5;80;Katılım tam/);

  const commaCsv = markdownTableToCsv(md, ',');
  assert.match(commaCsv, /"Yılmaz, Ayşe",85,90,Çok iyi; düzenli/);

  const card = importCsv(csv, '10-A Notlar');
  assert.equal(card.title, '10-A Notlar');
  assert.match(card.text, /<<gradebook pass="50">>/);
  assert.match(card.text, /\| Mehmet Öz \| 72,5 \| 80 \| Katılım tam \|/);
});
