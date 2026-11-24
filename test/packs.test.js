import test from 'node:test';
import assert from 'node:assert/strict';
import { TiddlerStore } from '../src/core/store.js';
import { SHADOW_TIDDLERS } from '../src/seed/starter-tiddlers.js';
import {
  WORKSPACE_PACKS,
  getPackById,
  buildEditionStoreData,
  mergePackIntoStore
} from '../src/packs/index.js';

test('all 5 workspace packs expose valid metadata, starter cards, templates, and sidebar tabs', () => {
  const ids = WORKSPACE_PACKS.map((p) => p.id);
  assert.deepEqual(ids, ['general', 'teacher', 'doctor', 'chef', 'student']);

  for (const pack of WORKSPACE_PACKS) {
    assert.ok(pack.filename.endsWith('.html'));
    assert.ok(pack.siteTitle.length > 0);
    assert.ok(pack.palette.length > 0);
    assert.ok(pack.landingCard.length > 0);

    const storeData = buildEditionStoreData(pack.id);
    assert.ok(Array.isArray(storeData.tiddlers) && storeData.tiddlers.length >= 4);
    assert.ok(storeData.tiddlers.some((t) => t.title === pack.landingCard));
    assert.ok(storeData.tiddlers.some((t) => t.title === '$:/SiteTitle' && t.text === pack.siteTitle));
    assert.ok(storeData.tiddlers.some((t) => t.title === '$:/Palette' && t.text === pack.palette));
    assert.ok(storeData.tiddlers.some((t) => t.title === '$:/ActiveMode' && t.text === pack.id));
  }

  const teacher = getPackById('teacher');
  const teacherCards = teacher.createTiddlers();
  assert.ok(teacherCards.some((t) => t.title === '10-A Matematik Not Çizelgesi' && t.text.includes('<<gradebook')));
  assert.ok(teacherCards.some((t) => t.tags.includes('$:/tags/Template') && t.title === 'Şablon: Ders Planı'));
  assert.ok(teacherCards.some((t) => t.tags.includes('$:/tags/SideBar') && t.fields.caption === 'Ödevler'));
});

test('mergePackIntoStore merges teacher pack non-destructively without overwriting existing user notes (Review Focus #5)', () => {
  const store = new TiddlerStore({
    tiddlers: [
      { title: 'Kişisel Günlüğüm', text: 'Bu not korunmalı.', tags: ['Kişisel'] },
      { title: 'Öğretmen Panosu', text: 'Kullanıcının kendi panosu korunmalı.' }
    ],
    shadows: SHADOW_TIDDLERS
  });

  const added = mergePackIntoStore(store, 'teacher', { applyTheme: true });
  assert.ok(added.length > 0);

  // Pre-existing notes remain completely intact
  assert.equal(store.getText('Kişisel Günlüğüm'), 'Bu not korunmalı.');
  assert.equal(store.getText('Öğretmen Panosu'), 'Kullanıcının kendi panosu korunmalı.');

  // New teacher templates, gradebook, and sidebar tabs were added
  assert.equal(store.has('10-A Matematik Not Çizelgesi'), true);
  assert.equal(store.has('Şablon: Ders Planı'), true);
  assert.equal(store.has('Sekme: Ödev Takibi'), true);
  assert.equal(store.getText('$:/Palette'), 'classroom');
  assert.equal(store.getText('$:/ActiveMode'), 'teacher');
});
