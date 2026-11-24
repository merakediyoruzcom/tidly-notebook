import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCryptoAvailable,
  isEncryptedEnvelope,
  encryptStorePayload,
  encryptWithDerivedKey,
  decryptStoreEnvelope
} from '../src/core/crypto.js';

test('AES-256-GCM encryption hides all tiddler content, round-trips cleanly, and rejects wrong passwords (Review Focus #4)', async () => {
  assert.equal(isCryptoAvailable(), true);

  const secretPayload = {
    v: 1,
    wikiId: 'wiki-test-1',
    updatedAt: '20261124120000000',
    tiddlers: [
      { title: 'Gizli Günlük Başlığı', text: 'Çok gizli kasa notu içeriği', tags: ['Özel'], fields: { pin: '9988' } }
    ]
  };

  const meta = { wikiId: 'wiki-test-1', updatedAt: '20261124120000000', lang: 'tr', palette: 'night' };
  const { envelope, key, salt } = await encryptStorePayload(secretPayload, 'GucLu-Parola-123!', meta);

  assert.equal(isEncryptedEnvelope(envelope), true);
  assert.deepEqual(Object.keys(envelope.meta).sort(), ['lang', 'palette', 'updatedAt', 'wikiId']);

  // Zero plaintext leakage check across serialized envelope
  const rawEnvelope = JSON.stringify(envelope);
  assert.equal(rawEnvelope.includes('Gizli Günlük'), false);
  assert.equal(rawEnvelope.includes('kasa notu'), false);
  assert.equal(rawEnvelope.includes('9988'), false);

  // Decrypt with correct password
  const decrypted = await decryptStoreEnvelope(envelope, 'GucLu-Parola-123!');
  assert.deepEqual(decrypted.payload, secretPayload);

  // Fast re-encrypt with derived key uses a fresh IV
  const envelope2 = await encryptWithDerivedKey(secretPayload, key, salt, meta);
  assert.notEqual(envelope2.iv, envelope.iv);
  const decrypted2 = await decryptStoreEnvelope(envelope2, 'GucLu-Parola-123!');
  assert.deepEqual(decrypted2.payload, secretPayload);

  // Wrong password fails with INVALID_PASSWORD code
  await assert.rejects(
    () => decryptStoreEnvelope(envelope, 'YanlisParola'),
    (err) => err && err.code === 'INVALID_PASSWORD'
  );
});
